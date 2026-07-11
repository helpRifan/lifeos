import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { db } from '../db'
import slotMapData from '../slotMap.json'

// Check if Local Notifications plugin is available (failsafe for desktop browser)
const isLocalNotificationsAvailable = () => {
  return Capacitor.isPluginAvailable('LocalNotifications')
}

// Deterministic string to 32-bit integer hash for notification IDs
function stringToId(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * Request notification permissions from the OS
 */
export async function requestNotificationPermission() {
  if (!isLocalNotificationsAvailable()) {
    console.log('[Notifications] LocalNotifications plugin not available in this environment.')
    return false
  }
  try {
    const perm = await LocalNotifications.requestPermissions()
    return perm.display === 'granted'
  } catch (err) {
    console.error('[Notifications] Failed to request permissions:', err)
    return false
  }
}

/**
 * Parses relative human dates (like "Today", "Tomorrow", "Oct 25") and time ("11:59 PM", "5:00 PM")
 */
function parseDateTime(dueStr, timeStr) {
  if (!dueStr) return null
  let date = new Date()
  const lower = dueStr.toLowerCase().trim()

  if (lower === 'today') {
    // defaults to today
  } else if (lower === 'tomorrow') {
    date.setDate(date.getDate() + 1)
  } else {
    // Try to parse standard format
    const parsed = Date.parse(dueStr)
    if (!isNaN(parsed)) {
      date = new Date(parsed)
    } else {
      // Try parts like "Oct 25" or "25-Oct"
      const parts = dueStr.split(/[-/\s]/)
      if (parts.length >= 2) {
        let d = parseInt(parts[0], 10)
        let m = parts[1]
        if (isNaN(d)) {
          d = parseInt(parts[1], 10)
          m = parts[0]
        }
        if (!isNaN(d)) {
          const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
          const mIdx = monthNames.findIndex(x => x === m.toLowerCase().slice(0,3))
          if (mIdx !== -1) {
            date.setDate(d)
            date.setMonth(mIdx)
          }
        }
      }
    }
  }

  // Set time
  if (timeStr) {
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
    if (match) {
      let hours = parseInt(match[1], 10)
      const minutes = parseInt(match[2], 10)
      const ampm = match[3]?.toUpperCase()

      if (ampm === 'PM' && hours < 12) hours += 12
      if (ampm === 'AM' && hours === 12) hours = 0

      date.setHours(hours, minutes, 0, 0)
    } else {
      const parts = timeStr.split(':')
      if (parts.length >= 2) {
        const hours = parseInt(parts[0], 10)
        const minutes = parseInt(parts[1], 10)
        if (!isNaN(hours) && !isNaN(minutes)) {
          date.setHours(hours, minutes, 0, 0)
        }
      }
    }
  } else {
    // Default to 12:00 PM if no time is specified
    date.setHours(12, 0, 0, 0)
  }

  return date
}

/**
 * Re-schedule all local notifications based on current DB state & college cache
 */
export async function syncAllNotifications() {
  if (!isLocalNotificationsAvailable()) return

  try {
    // Request permission (non-intrusive if already granted)
    const hasPerm = await requestNotificationPermission()
    if (!hasPerm) {
      console.log('[Notifications] Permission denied, skipping schedule.')
      return
    }

    // 1. Cancel all previously scheduled notifications to prevent duplicates/stale alerts
    const pending = await LocalNotifications.getPending()
    if (pending.notifications?.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map(n => ({ id: n.id }))
      })
    }

    const notificationsToSchedule = []
    const now = new Date()

    // ─── 2. DEADLINE NOTIFICATIONS ──────────────────────────────────────────
    const deadlines = await db.skillDeadlines.toArray()
    for (const dl of deadlines) {
      const targetDate = parseDateTime(dl.due, dl.time)
      if (targetDate && targetDate > now) {
        // Warning on the morning of due date (e.g. 9:00 AM)
        const morningOf = new Date(targetDate)
        morningOf.setHours(9, 0, 0, 0)

        if (morningOf > now) {
          notificationsToSchedule.push({
            id: stringToId(`deadline-day-${dl.id}`),
            title: `Deadline Today: ${dl.title}`,
            body: `Category: ${dl.category}. Due by ${dl.time || 'end of day'}.`,
            schedule: { at: morningOf }
          })
        }

        // Warning the night before (e.g. 8:00 PM) if urgent
        if (dl.urgent) {
          const nightBefore = new Date(targetDate)
          nightBefore.setDate(nightBefore.getDate() - 1)
          nightBefore.setHours(20, 0, 0, 0)

          if (nightBefore > now) {
            notificationsToSchedule.push({
              id: stringToId(`deadline-night-${dl.id}`),
              title: `Urgent Deadline Tomorrow: ${dl.title}`,
              body: `Category: ${dl.category}. Make sure to complete it by ${dl.time || 'tomorrow'}.`,
              schedule: { at: nightBefore }
            })
          }
        }
      }
    }

    // ─── 3. NOTES DEADLINES ────────────────────────────────────────────────
    try {
      const notes = await db.notes.toArray()
      for (const note of notes) {
        if (note.due) {
          const targetDate = parseDateTime(note.due, note.dueTime)
          if (targetDate && targetDate > now) {
            notificationsToSchedule.push({
              id: stringToId(`note-${note.id}`),
              title: `Note Reminder: ${note.title}`,
              body: note.body || 'You have a reminder for this note.',
              schedule: { at: targetDate }
            })
          }
        }
      }
    } catch (err) {
      console.error('[Notifications] Failed to schedule note alerts:', err)
    }

    // ─── 4. WATER REMINDERS ──────────────────────────────────────────────────
    // Load today's intake
    const todayISOStr = new Date().toLocaleDateString('en-CA')
    const waterRecords = await db.waterRecords.where('date').equals(todayISOStr).toArray()
    const waterCurrent = waterRecords.reduce((sum, r) => sum + r.ml, 0)
    const waterGoal = parseInt(localStorage.getItem('waterGoal') || '1790', 10)

    if (waterCurrent < waterGoal) {
      // Schedule alarms for the rest of today
      const alertHours = [10, 12, 14, 16, 18, 20]
      const currentHour = now.getHours()

      alertHours.forEach(h => {
        if (h > currentHour) {
          const scheduledTime = new Date()
          scheduledTime.setHours(h, 0, 0, 0)

          notificationsToSchedule.push({
            id: stringToId(`water-reminder-${h}`),
            title: 'Time to Hydrate! 💧',
            body: `You are currently at ${waterCurrent}/${waterGoal}ml. Keep it up!`,
            schedule: { at: scheduledTime }
          })
        }
      })
    }

    // ─── 4. COLLEGE CLASSES (VTOP SCHEDULE) ──────────────────────────────────
    try {
      const attendanceCached = localStorage.getItem('unicc_attendance')
      if (attendanceCached) {
        const attendance = JSON.parse(attendanceCached)
        const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

        // Loop over the next 7 days (including today)
        for (let offset = 0; offset < 7; offset++) {
          const targetDay = new Date()
          targetDay.setDate(now.getDate() + offset)

          const dayKey = daysOfWeek[targetDay.getDay()]
          const daySlots = slotMapData[dayKey]

          if (daySlots && attendance?.length > 0) {
            attendance.forEach(course => {
              const slots = (course.slotName || '').split('+').map(s => s.trim())
              slots.forEach(slot => {
                const slotInfo = daySlots[slot]
                if (slotInfo) {
                  // Format: "8:00-8:50"
                  const startTimeStr = slotInfo.time.split('-')[0]
                  const [h, m] = startTimeStr.split(':').map(Number)

                  const classTime = new Date(targetDay)
                  classTime.setHours(h, m, 0, 0)

                  // Alert 10 minutes before class
                  const alertTime = new Date(classTime.getTime() - 10 * 60 * 1000)

                  if (alertTime > now) {
                    notificationsToSchedule.push({
                      id: stringToId(`class-${offset}-${slot}-${course.courseCode}`),
                      title: `Upcoming Class: ${course.courseTitle || course.courseCode}`,
                      body: `Class starts in 10 min (at ${startTimeStr}) in hall ${course.slotVenue || slot}.`,
                      schedule: { at: alertTime }
                    })
                  }
                }
              })
            })
          }
        }
      }
    } catch (err) {
      console.error('[Notifications] Failed to parse class schedule for alerts:', err)
    }

    // ─── 5. EXAMS NOTIFICATIONS ─────────────────────────────────────────────
    try {
      const scheduleCached = localStorage.getItem('unicc_schedule')
      if (scheduleCached) {
        const scheduleRes = JSON.parse(scheduleCached)
        const examSchedule = scheduleRes?.Schedule || {}

        // Helper to parse "25-Oct-2026"
        const parseExamDateLocal = (dateStr) => {
          if (!dateStr) return null
          const parts = dateStr.split(/[-/]/)
          if (parts.length === 3) {
            let [d, m, y] = parts
            d = parseInt(d)
            if (isNaN(d)) return null
            if (isNaN(m)) {
              const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
              const mIdx = monthNames.findIndex(x => x === m.toLowerCase().slice(0,3))
              if (mIdx === -1) return null
              return new Date(y, mIdx, d)
            }
            return new Date(y, m-1, d)
          }
          return new Date(dateStr)
        }

        Object.entries(examSchedule).forEach(([examType, subjects]) => {
          if (Array.isArray(subjects)) {
            subjects.forEach(subj => {
              const examDate = parseExamDateLocal(subj.examDate)
              if (examDate) {
                // Morning of the exam (e.g. 7:30 AM)
                const examAlertTime = new Date(examDate)
                examAlertTime.setHours(7, 30, 0, 0)

                if (examAlertTime > now) {
                  notificationsToSchedule.push({
                    id: stringToId(`exam-${examType}-${subj.courseCode}`),
                    title: `Exam Today: ${subj.courseCode} (${examType})`,
                    body: `Subject: ${subj.courseTitle}. Time: ${subj.examTime || ''} in room ${subj.venue || 'TBA'}.`,
                    schedule: { at: examAlertTime }
                  })
                }
              }
            })
          }
        })
      }
    } catch (err) {
      console.error('[Notifications] Failed to schedule exam alerts:', err)
    }

    // ─── 6. SCHEDULE ALL IN CAPACITOR ────────────────────────────────────────
    if (notificationsToSchedule.length > 0) {
      // Capacitor can schedule up to 64 local notifications at a time.
      const sliced = notificationsToSchedule.slice(0, 64)
      await LocalNotifications.schedule({ notifications: sliced })
      console.log(`[Notifications] Successfully scheduled ${sliced.length} local alerts.`)
    }
  } catch (err) {
    console.error('[Notifications] Error in syncAllNotifications:', err)
  }
}
