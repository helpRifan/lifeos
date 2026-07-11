import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayISO, formatTime } from '../db'
import { useUniCC } from '../hooks/useUniCC'
import slotMapData from '../slotMap.json'

// ─── Next class helper (from attendance slots + slot map) ────────────

function parseSlotTime(timeStr) {
  if (!timeStr) return -1
  // Format: "8:00-8:50" or "14:00-14:50"
  const start = timeStr.split('-')[0]
  const match = start?.match(/(\d{1,2}):(\d{2})/)
  if (!match) return -1
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
}

function findNextClass(attendance) {
  if (!attendance?.length) return null

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const shortDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const dayKey = shortDays[now.getDay()]
  const daySlots = slotMapData[dayKey]
  if (!daySlots) return null

  const classes = []
  attendance.forEach((course) => {
    const slots = (course.slotName || '').split('+').map((s) => s.trim())
    slots.forEach((slot) => {
      if (daySlots[slot]) {
        classes.push({
          name: course.courseTitle || course.courseCode || 'Class',
          time: daySlots[slot].time,
          venue: course.slotVenue || slot,
          _minutes: parseSlotTime(daySlots[slot].time),
        })
      }
    })
  })

  const upcoming = classes
    .filter((c) => c._minutes > currentMinutes)
    .sort((a, b) => a._minutes - b._minutes)

  if (!upcoming.length) return null

  const next = upcoming[0]
  const diffMin = next._minutes - currentMinutes
  const diffText = diffMin < 60 ? `In ${diffMin} min` : `In ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`

  return { name: next.name, time: next.time, hall: next.venue, diffText }
}

const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.3, ease: 'easeOut' },
}

export default function HomePage() {
  const navigate = useNavigate()
  const today = new Date()
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const todayDate = todayISO()

  // UniCC schedule for "Next Up" card
  const { isLoggedIn } = useUniCC()
  const [attendanceList, setAttendanceList] = useState(null)

  useEffect(() => {
    if (!isLoggedIn) return
    // Read attendance from the UniCC cache (set by CollegePage)
    try {
      const cached = localStorage.getItem('unicc_cache__api_attendance')
      if (cached) {
        const parsed = JSON.parse(cached)
        setAttendanceList(parsed?.attRes?.attendance || parsed?.attendance || [])
      }
    } catch { /* ignore */ }
  }, [isLoggedIn])

  const nextClass = useMemo(() => findNextClass(attendanceList), [attendanceList])

  // Notes from Dexie
  const notes = useLiveQuery(() => db.notes.toArray(), []) ?? []
  const [expandedNote, setExpandedNote] = useState(null)
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [newNote, setNewNote] = useState({ title: '', body: '', due: '', time: '' })

  // Water from Dexie
  const waterRecords = useLiveQuery(
    () => db.waterRecords.where('date').equals(todayDate).toArray(),
    [todayDate]
  ) ?? []
  const waterCurrent = waterRecords.reduce((sum, r) => sum + r.ml, 0)
  const waterGoal = useMemo(() => parseInt(localStorage.getItem('waterGoal') || '1790', 10), [])
  const waterPercent = Math.round((waterCurrent / waterGoal) * 100)

  // Gym & Diet from Dexie
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const todayName = DAYS[today.getDay()]
  const gymCompleted = useLiveQuery(() => db.gymCompleted.where('date').equals(todayDate).toArray(), [todayDate]) ?? []
  const gymMeals = useLiveQuery(() => db.gymMeals.where('date').equals(todayDate).toArray(), [todayDate]) ?? []
  const gymDoneCount = gymCompleted.filter(r => r.completed).length
  const totalCalories = gymMeals.reduce((sum, m) => sum + m.calories, 0)

  // Skincare from Dexie
  const morningSkincare = useLiveQuery(() => db.skincareMorning.toArray(), []) ?? []
  const eveningSkincare = useLiveQuery(() => db.skincareEvening.toArray(), []) ?? []
  const morningChecked = useLiveQuery(() => db.skincareMorningChecked.where('date').equals(todayDate).toArray(), [todayDate]) ?? []
  const eveningChecked = useLiveQuery(() => db.skincareEveningChecked.where('date').equals(todayDate).toArray(), [todayDate]) ?? []
  const totalSkinSteps = morningSkincare.length + eveningSkincare.length
  const doneSkinSteps = morningChecked.filter(r => r.checked).length + eveningChecked.filter(r => r.checked).length

  // Deadlines from Dexie
  const deadlines = useLiveQuery(() => db.skillDeadlines.toArray(), []) ?? []
  const closestDeadline = useMemo(() => {
    if (!deadlines.length) return null
    const todayMidnight = new Date()
    todayMidnight.setHours(0, 0, 0, 0)

    const upcoming = deadlines.map(dl => {
      let parsedDate = new Date()
      const lower = (dl.due || '').toLowerCase().trim()
      if (lower === 'tomorrow') {
        parsedDate.setDate(parsedDate.getDate() + 1)
      } else if (lower !== 'today' && lower !== 'tbd') {
        const d = Date.parse(dl.due)
        if (!isNaN(d)) parsedDate = new Date(d)
      }
      return { ...dl, parsedDate }
    }).filter(dl => dl.parsedDate >= todayMidnight)
    
    upcoming.sort((a, b) => a.parsedDate - b.parsedDate)
    return upcoming.length > 0 ? upcoming[0] : null
  }, [deadlines])

  const addNote = async () => {
    if (!newNote.title.trim() && !newNote.body.trim()) return
    await db.notes.add({
      title: newNote.title.trim() || 'Untitled',
      body: newNote.body.trim(),
      time: formatTime(),
      pinned: false,
      date: todayDate,
      due: newNote.due,
      dueTime: newNote.time,
    })
    setNewNote({ title: '', body: '', due: '', time: '' })
    setIsAddingNote(false)
    // Synchronise notifications since we might have added a deadline
    import('../lib/notifications').then(mod => mod.syncAllNotifications())
  }

  const deleteNote = async (id, e) => {
    e.stopPropagation()
    await db.notes.delete(id)
    if (expandedNote === id) setExpandedNote(null)
  }

  const togglePin = async (id, e) => {
    e.stopPropagation()
    const note = await db.notes.get(id)
    if (note) await db.notes.update(id, { pinned: !note.pinned })
  }

  // Sort: pinned first, then by id (newest first)
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return b.id - a.id
  })

  return (
    <motion.div {...pageTransition} className="px-[var(--spacing-container-margin)]">
      {/* Greeting */}
      <section className="pt-6 pb-5">
        <p className="text-on-surface-variant text-sm font-light">{dayName}, {dateStr}</p>
        <h1 className="font-[var(--font-headline)] text-3xl font-semibold text-on-surface tracking-wide mt-0.5">
          Hello Rifan
        </h1>
      </section>

      {/* Dashboard Grid — Row 1 */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Next Up — live from UniCC */}
        <button
          onClick={() => navigate('/college')}
          className="card-elegant p-4 text-left btn-press"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <span className="material-symbols-outlined text-primary text-[16px]">schedule</span>
            <span className="text-[10px] font-medium text-primary uppercase tracking-widest">Next Up</span>
          </div>
          {nextClass ? (
            <>
              <h3 className="font-[var(--font-headline)] text-sm font-semibold text-on-surface leading-tight">
                {nextClass.name}
              </h3>
              <p className="text-[11px] text-on-surface-variant mt-1">
                {nextClass.time}{nextClass.hall ? ` · ${nextClass.hall}` : ''}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] text-primary font-medium">{nextClass.diffText}</span>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-[var(--font-headline)] text-sm font-semibold text-on-surface leading-tight">
                {isLoggedIn ? 'No more classes' : 'Connect VTOP'}
              </h3>
              <p className="text-[11px] text-on-surface-variant mt-1">
                {isLoggedIn ? 'You\'re done for today ✨' : 'Tap to sync schedule'}
              </p>
            </>
          )}
        </button>

        {/* Water Intake */}
        <button
          onClick={() => navigate('/water')}
          className="card-elegant p-4 text-left btn-press"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <span className="material-symbols-outlined text-primary text-[16px]">water_drop</span>
            <span className="text-[10px] font-medium text-primary uppercase tracking-widest">Water</span>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="font-[var(--font-headline)] text-2xl font-semibold text-on-surface">{waterCurrent}</span>
            <span className="text-on-surface-variant text-xs">/ {waterGoal} ml</span>
          </div>
          <div className="progress-track h-1.5 mt-2">
            <motion.div
              className="progress-gold h-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(waterPercent, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[10px] text-on-surface-variant mt-1 block">{waterPercent}% of daily goal</span>
        </button>
      </div>

      {/* Dashboard Grid — Row 2 */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <button onClick={() => navigate('/gym')} className="card-elegant p-3.5 text-left btn-press">
          <span className="material-symbols-outlined text-primary text-[20px]">fitness_center</span>
          <p className="font-[var(--font-headline)] text-sm font-semibold text-on-surface mt-1.5">{todayName}</p>
          <p className="text-[10px] text-on-surface-variant">{gymDoneCount} exercises done</p>
        </button>

        <button onClick={() => navigate('/skincare')} className="card-elegant p-3.5 text-left btn-press">
          <span className="material-symbols-outlined text-primary text-[20px]">spa</span>
          <p className="font-[var(--font-headline)] text-sm font-semibold text-on-surface mt-1.5">{doneSkinSteps}/{totalSkinSteps}</p>
          <p className="text-[10px] text-on-surface-variant">Steps done</p>
        </button>

        <button onClick={() => navigate('/gym')} className="card-elegant p-3.5 text-left btn-press">
          <span className="material-symbols-outlined text-primary text-[20px]">local_fire_department</span>
          <p className="font-[var(--font-headline)] text-sm font-semibold text-on-surface mt-1.5">{totalCalories}</p>
          <p className="text-[10px] text-on-surface-variant">kcal eaten</p>
        </button>
      </div>

      {/* Closest Deadline */}
      {closestDeadline ? (
        <button
          onClick={() => navigate('/skills')}
          className="w-full card-elegant p-4 flex items-center gap-3 mb-[var(--spacing-section-gap)] text-left btn-press"
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${closestDeadline.urgent ? 'bg-error/10' : 'bg-primary/10'}`}>
            <span className={`material-symbols-outlined text-[20px] ${closestDeadline.urgent ? 'text-error' : 'text-primary'}`}>
              {closestDeadline.urgent ? 'warning' : 'event_upcoming'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] font-medium uppercase tracking-widest ${closestDeadline.urgent ? 'text-error' : 'text-primary'}`}>
              Closest Deadline
            </p>
            <h3 className="text-sm font-normal text-on-surface mt-0.5 truncate">{closestDeadline.title}</h3>
            <p className="text-[11px] text-on-surface-variant">
              {closestDeadline.category} · Due {closestDeadline.due}{closestDeadline.time ? `, ${closestDeadline.time}` : ''}
            </p>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[18px] shrink-0">chevron_right</span>
        </button>
      ) : (
        <button
          onClick={() => navigate('/skills')}
          className="w-full card-elegant p-4 flex items-center gap-3 mb-[var(--spacing-section-gap)] text-left btn-press"
        >
          <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">task</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest">No Deadlines</p>
            <h3 className="text-sm font-normal text-on-surface mt-0.5 truncate">You're all caught up!</h3>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[18px] shrink-0">chevron_right</span>
        </button>
      )}

      {/* Notes Section */}
      <section className="pb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">note</span>
            <h2 className="font-[var(--font-headline)] text-lg font-semibold text-on-surface">Notes</h2>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-on-surface-variant">{notes.length} Notes</span>
            <button
              onClick={() => {
                setIsAddingNote(true)
                setNewNote({ title: '', body: '', due: '', time: '' })
              }}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-background ml-2 btn-press"
              aria-label="New Note"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
          </div>
        </div>

        {/* New Note Form */}
        <AnimatePresence>
          {isAddingNote && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="card-elegant border-primary/30 p-4 mb-3 overflow-hidden"
            >
              <input
                type="text"
                value={newNote.title}
                onChange={(e) => setNewNote((n) => ({ ...n, title: e.target.value }))}
                placeholder="Title"
                autoFocus
                className="w-full bg-transparent text-on-surface font-[var(--font-headline)] font-semibold text-base focus:outline-none mb-2"
              />
              <textarea
                value={newNote.body}
                onChange={(e) => setNewNote((n) => ({ ...n, body: e.target.value }))}
                placeholder="Start writing..."
                rows={3}
                className="w-full bg-transparent text-on-surface text-sm focus:outline-none resize-none mb-2"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newNote.due}
                  onChange={(e) => setNewNote((n) => ({ ...n, due: e.target.value }))}
                  className="flex-1 bg-surface-container text-on-surface text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <input
                  type="time"
                  value={newNote.time}
                  onChange={(e) => setNewNote((n) => ({ ...n, time: e.target.value }))}
                  className="flex-1 bg-surface-container text-on-surface text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={addNote}
                  className="flex-1 bg-primary text-background text-xs font-medium py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsAddingNote(false)}
                  className="flex-1 bg-surface-container-high text-on-surface-variant text-xs font-medium py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notes List */}
        <div className="card-elegant overflow-hidden divide-y divide-outline-variant/40">
          <AnimatePresence initial={false}>
            {sortedNotes.map((note) => {
              const isExpanded = expandedNote === note.id
              return (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <button
                    onClick={() => setExpandedNote(isExpanded ? null : note.id)}
                    className="w-full text-left px-4 py-3.5 flex gap-3 items-start active:bg-surface-container-high/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {note.pinned && (
                          <span className="material-symbols-outlined text-primary text-[14px]">push_pin</span>
                        )}
                        <h3 className="text-sm font-normal text-on-surface truncate">{note.title}</h3>
                      </div>
                      {!isExpanded && (
                        <p className="text-[12px] text-on-surface-variant mt-0.5 line-clamp-1">{note.body}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-on-surface-variant/60 block">{note.time}</span>
                        {note.due && (
                          <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <span className="material-symbols-outlined text-[10px]">alarm</span>
                            {note.due} {note.dueTime || ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`material-symbols-outlined text-on-surface-variant text-[16px] mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-3.5">
                          <p className="text-sm text-on-surface/80 leading-relaxed whitespace-pre-wrap">
                            {note.body}
                          </p>
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={(e) => togglePin(note.id, e)}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                                note.pinned
                                  ? 'bg-primary/15 text-primary'
                                  : 'bg-surface-container-high text-on-surface-variant'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]">push_pin</span>
                              {note.pinned ? 'Unpin' : 'Pin'}
                            </button>
                            <button
                              onClick={(e) => deleteNote(note.id, e)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-surface-container-high text-on-surface-variant hover:text-error transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                              Delete
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </section>
    </motion.div>
  )
}
