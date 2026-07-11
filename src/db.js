import Dexie from 'dexie'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

// ─── Database ────────────────────────────────────────────────────────
export const db = new Dexie('LifeOSDatabase')

db.version(1).stores({
  notes:                  '++id, date, pinned',
  gymMeals:               '++id, date',
  gymCompleted:           '++id, date, exerciseIndex',
  waterRecords:           '++id, date',
  skincareMorning:        '++id, date',
  skincareEvening:        '++id, date',
  skincareMorningChecked: '++id, itemId, date',
  skincareEveningChecked: '++id, itemId, date',
  skillTasks:             '++id, date',
  skillDeadlines:         '++id, date',
  skillMilestones:        '++id, date',
  dailyLogs:              '++id, [date+moduleName], date, moduleName',
})

db.version(2).stores({
  gymSplits:              'dayOfWeek',
})

db.version(3).stores({
  gymSplits:              'dayOfWeek',
})

db.version(4).stores({
  notes:                  '++id, date, pinned',
  gymMeals:               '++id, date',
  gymCompleted:           '++id, date, exerciseIndex',
  waterRecords:           '++id, date',
  skincareMorning:        '++id, date',
  skincareEvening:        '++id, date',
  skincareMorningChecked: '++id, itemId, date',
  skincareEveningChecked: '++id, itemId, date',
  skillTasks:             '++id, date',
  skillDeadlines:         '++id, date',
  skillMilestones:        '++id, date',
  dailyLogs:              '++id, [date+moduleName], date, moduleName',
  gymSplits:              'dayOfWeek',
})

// ─── Helpers ─────────────────────────────────────────────────────────

/** Today's date as YYYY-MM-DD in local time */
export function todayISO() {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
}

/** Format a Date to 12-hour time string */
export function formatTime(d = new Date()) {
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// ─── Seed defaults (first run only) ─────────────────────────────────

export async function seedDefaultSplits() {
  await db.gymSplits.bulkAdd([
    {
      dayOfWeek: 'Monday',
      name: 'Push',
      exercises: [
        { name: 'Barbell Bench Press', sets: 4, reps: '8-10', weight: '65kg' },
        { name: 'Overhead Press', sets: 3, reps: '10-12', weight: '40kg' },
        { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', weight: '24kg' },
        { name: 'Tricep Pushdowns', sets: 4, reps: '12-15', weight: '15kg' },
        { name: 'Lateral Raises', sets: 3, reps: '15', weight: '8kg' },
      ],
    },
    {
      dayOfWeek: 'Tuesday',
      name: 'Pull',
      exercises: [
        { name: 'Deadlift', sets: 4, reps: '6-8', weight: '100kg' },
        { name: 'Barbell Rows', sets: 4, reps: '8-10', weight: '60kg' },
        { name: 'Pull-ups', sets: 3, reps: '8-10', weight: 'BW' },
        { name: 'Face Pulls', sets: 3, reps: '15', weight: '12kg' },
        { name: 'Barbell Curls', sets: 3, reps: '10-12', weight: '25kg' },
      ],
    },
    {
      dayOfWeek: 'Wednesday',
      name: 'Legs',
      exercises: [
        { name: 'Barbell Squat', sets: 4, reps: '8-10', weight: '80kg' },
        { name: 'Romanian Deadlift', sets: 3, reps: '10-12', weight: '60kg' },
        { name: 'Leg Press', sets: 3, reps: '12', weight: '120kg' },
        { name: 'Leg Curls', sets: 3, reps: '12-15', weight: '30kg' },
        { name: 'Calf Raises', sets: 4, reps: '15-20', weight: '40kg' },
      ],
    },
    {
      dayOfWeek: 'Thursday',
      name: 'Push',
      exercises: [
        { name: 'Dumbbell Bench Press', sets: 4, reps: '10-12', weight: '28kg' },
        { name: 'Arnold Press', sets: 3, reps: '10-12', weight: '16kg' },
        { name: 'Cable Flyes', sets: 3, reps: '12-15', weight: '10kg' },
        { name: 'Skull Crushers', sets: 3, reps: '10-12', weight: '20kg' },
        { name: 'Front Raises', sets: 3, reps: '12', weight: '8kg' },
      ],
    },
    {
      dayOfWeek: 'Friday',
      name: 'Pull',
      exercises: [
        { name: 'Lat Pulldowns', sets: 4, reps: '10-12', weight: '50kg' },
        { name: 'Seated Cable Rows', sets: 4, reps: '10-12', weight: '45kg' },
        { name: 'Dumbbell Rows', sets: 3, reps: '10', weight: '24kg' },
        { name: 'Reverse Flyes', sets: 3, reps: '15', weight: '8kg' },
        { name: 'Hammer Curls', sets: 3, reps: '10-12', weight: '14kg' },
      ],
    },
    {
      dayOfWeek: 'Saturday',
      name: 'Legs',
      exercises: [
        { name: 'Front Squat', sets: 4, reps: '8-10', weight: '60kg' },
        { name: 'Bulgarian Split Squat', sets: 3, reps: '10/leg', weight: '16kg' },
        { name: 'Leg Extensions', sets: 3, reps: '12-15', weight: '35kg' },
        { name: 'Glute Bridge', sets: 3, reps: '12', weight: '60kg' },
        { name: 'Seated Calf Raises', sets: 4, reps: '15-20', weight: '30kg' },
      ],
    },
    { dayOfWeek: 'Sunday', name: 'Rest', exercises: [] },
  ])
}

export async function initializeBlankSplits() {
  await db.gymSplits.bulkAdd([
    { dayOfWeek: 'Monday', name: 'Rest', exercises: [] },
    { dayOfWeek: 'Tuesday', name: 'Rest', exercises: [] },
    { dayOfWeek: 'Wednesday', name: 'Rest', exercises: [] },
    { dayOfWeek: 'Thursday', name: 'Rest', exercises: [] },
    { dayOfWeek: 'Friday', name: 'Rest', exercises: [] },
    { dayOfWeek: 'Saturday', name: 'Rest', exercises: [] },
    { dayOfWeek: 'Sunday', name: 'Rest', exercises: [] },
  ])
}

export async function seedDefaults() {
  const today = todayISO()
  const hasSeeded = localStorage.getItem('hasSeeded') === 'true'

  // 1. Seed demo and structural data only on first run
  if (!hasSeeded) {
    // Notes
    const noteCount = await db.notes.count()
    if (noteCount === 0) {
      await db.notes.bulkAdd([
        { title: 'Places to Visit in Summer', body: 'Manali, Pondicherry, Meghalaya — check flight prices by end of month.', time: '3:15 PM', pinned: true, date: today },
        { title: 'Project Ideas', body: 'Build a habit tracker app with streaks, build a recipe organizer with nutritional info, portfolio redesign.', time: '1:54 PM', pinned: false, date: today },
        { title: 'Books to Read', body: 'Atomic Habits, Deep Work, The Pragmatic Programmer, Designing Data-Intensive Applications.', time: '12:30 PM', pinned: false, date: today },
        { title: 'Grocery List', body: 'Eggs, chicken breast, rice, oats, peanut butter, bananas, spinach, milk.', time: '9:00 AM', pinned: false, date: today },
      ])
    }

    // Gym meals
    const mealCount = await db.gymMeals.count()
    if (mealCount === 0) {
      await db.gymMeals.bulkAdd([
        { name: 'Chicken Salad', calories: 450, protein: 35, date: today },
        { name: 'Protein Shake', calories: 180, protein: 25, date: today },
      ])
    }

    // Water records
    const waterCount = await db.waterRecords.count()
    if (waterCount === 0) {
      await db.waterRecords.bulkAdd([
        { ml: 200, time: '07:30 AM', icon: 'water_full', date: today },
        { ml: 150, time: '09:15 AM', icon: 'coffee', date: today },
        { ml: 150, time: '11:00 AM', icon: 'coffee', date: today },
      ])
    }

    // Skill tasks
    const stCount = await db.skillTasks.count()
    if (stCount === 0) {
      await db.skillTasks.bulkAdd([
        { title: 'Design Mockups for App', category: 'Web Design', date: today },
        { title: 'Practice Fingerpicking Patterns', category: 'Guitar', date: today },
        { title: 'Complete Duolingo Unit 5', category: 'Spanish', date: today },
      ])
    }

    // Skill deadlines
    const sdCount = await db.skillDeadlines.count()
    if (sdCount === 0) {
      await db.skillDeadlines.bulkAdd([
        { title: 'Portfolio Website V1', category: 'Web Design', due: 'Tomorrow', time: '11:59 PM', urgent: true, date: today },
        { title: 'Record Cover Song', category: 'Guitar', due: 'Oct 25', time: '5:00 PM', urgent: false, date: today },
      ])
    }

    // Skill milestones
    const smilCount = await db.skillMilestones.count()
    if (smilCount === 0) {
      await db.skillMilestones.bulkAdd([
        { title: "Dean's List — Fall Semester", dateLabel: 'November 15', icon: 'school', color: 'gold', date: today },
        { title: 'Guitar Performance Night', dateLabel: 'December 5', icon: 'music_note', color: 'gold', date: today },
      ])
    }

    // Skincare
    try {
      const smCount = await db.skincareMorning.count()
      if (smCount === 0) {
        await db.skincareMorning.bulkAdd([
          { name: 'Gentle Cleanser', note: '', required: false, date: today },
          { name: 'Vitamin C Serum', note: '15% concentration', required: false, date: today },
          { name: 'Lightweight Moisturizer', note: '', required: false, date: today },
          { name: 'SPF 50+ Sunscreen', note: '', required: true, date: today },
        ])
      }

      const seCount = await db.skincareEvening.count()
      if (seCount === 0) {
        await db.skincareEvening.bulkAdd([
          { name: 'Cleansing Balm (Double Cleanse)', note: '', required: false, date: today },
          { name: 'Water-based Cleanser', note: '', required: false, date: today },
          { name: 'Retinol Serum', note: '0.5% — every other night', required: false, date: today },
          { name: 'Night Recovery Cream', note: '', required: false, date: today },
        ])
      }
    } catch (err) {
      console.error('Failed to seed skincare:', err)
    }

    // Gym splits
    try {
      const gymSplitsCount = await db.gymSplits.count()
      if (gymSplitsCount === 0) {
        await seedDefaultSplits()
      }
    } catch (err) {
      console.error('Failed to seed gym splits:', err)
    }
  }

  localStorage.setItem('hasSeeded', 'true')
}

// ─── Export ───────────────────────────────────────────────────────────

export async function exportAllData() {
  const zip = new JSZip()

  const tables = [
    'notes',
    'gymMeals',
    'gymCompleted',
    'waterRecords',
    'skincareMorning',
    'skincareEvening',
    'skincareMorningChecked',
    'skincareEveningChecked',
    'skillTasks',
    'skillDeadlines',
    'skillMilestones',
    'dailyLogs',
    'gymSplits',
  ]

  for (const name of tables) {
    const data = await db[name].toArray()
    zip.file(`${name}.json`, JSON.stringify(data, null, 2))
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  saveAs(blob, `lifeos-export-${todayISO()}.zip`)
}

// ─── Clear all data ──────────────────────────────────────────────────

export async function clearAllData() {
  await Promise.all(db.tables.map((t) => t.clear()))
}
