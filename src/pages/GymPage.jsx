import { motion, AnimatePresence } from 'framer-motion'
import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayISO, formatTime, seedDefaultSplits, initializeBlankSplits } from '../db'
import { useDailyLog } from '../hooks/useDailyLog'

const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.3, ease: 'easeOut' },
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function GymPage() {
  const [calorieGoal, setCalorieGoal] = useState(() => parseInt(localStorage.getItem('gymCalorieGoal') || '2500', 10))
  const [proteinGoal, setProteinGoal] = useState(() => parseInt(localStorage.getItem('gymProteinGoal') || '150', 10))
  const [isEditingTargets, setIsEditingTargets] = useState(false)
  const [calInput, setCalInput] = useState('')
  const [proInput, setProInput] = useState('')
  const today = DAYS[new Date().getDay()]
  const todayDate = todayISO()

  const [isEditingSplitName, setIsEditingSplitName] = useState(false)
  const [newSplitName, setNewSplitName] = useState('')

  // Custom Workout Split
  const todaySplit = useLiveQuery(
    () => db.gymSplits.get(today)
  )
  const splitsCount = useLiveQuery(() => db.gymSplits.count())

  // Meals from Dexie
  const meals = useLiveQuery(
    () => db.gymMeals.where('date').equals(todayDate).toArray(),
    [todayDate]
  ) ?? []

  const [mealForm, setMealForm] = useState({ name: '', calories: '', protein: '' })
  
  // Exercise Add form
  const [isAddingEx, setIsAddingEx] = useState(false)
  const [exForm, setExForm] = useState({ name: '', sets: '', reps: '', weight: '', imageUrl: '' })
  const [selectedImage, setSelectedImage] = useState(null)

  // Exercise completion from Dexie
  const completedRecords = useLiveQuery(
    () => db.gymCompleted.where('date').equals(todayDate).toArray(),
    [todayDate]
  ) ?? []

  const completed = useMemo(() => {
    const map = {}
    completedRecords.forEach((r) => { map[r.exerciseIndex] = r.completed })
    return map
  }, [completedRecords])

  // Nutrition totals
  const totals = useMemo(() => ({
    calories: meals.reduce((sum, m) => sum + m.calories, 0),
    protein: meals.reduce((sum, m) => sum + m.protein, 0),
  }), [meals])

  const calPercent = Math.min((totals.calories / calorieGoal) * 100, 100)
  const proPercent = Math.min((totals.protein / proteinGoal) * 100, 100)

  useDailyLog('gym', {
    meals,
    totals,
    completed,
    exercises: todaySplit?.exercises || [],
    split: splitsCount === 0 ? 'None' : (todaySplit?.name || 'Loading...'),
  })

  const logMeal = async () => {
    if (!mealForm.name || !mealForm.calories) return
    await db.gymMeals.add({
      name: mealForm.name,
      calories: parseInt(mealForm.calories) || 0,
      protein: parseInt(mealForm.protein) || 0,
      date: todayDate,
    })
    setMealForm({ name: '', calories: '', protein: '' })
  }

  const deleteMeal = async (id) => {
    await db.gymMeals.delete(id)
  }

  const toggleExercise = async (index) => {
    const existing = completedRecords.find((r) => r.exerciseIndex === index)
    if (existing) {
      await db.gymCompleted.update(existing.id, { completed: !existing.completed })
    } else {
      await db.gymCompleted.add({ exerciseIndex: index, completed: true, date: todayDate })
    }
  }

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setExForm((f) => ({ ...f, imageUrl: reader.result }))
    }
    reader.readAsDataURL(file)
  }

  const addExercise = async () => {
    if (!todaySplit || !exForm.name) return
    const newEx = {
      name: exForm.name,
      sets: exForm.sets || 0,
      reps: exForm.reps || 0,
      weight: exForm.weight || 'BW',
      imageUrl: exForm.imageUrl || null,
    }
    const updatedExercises = [...(todaySplit.exercises || []), newEx]
    await db.gymSplits.update(today, { exercises: updatedExercises })
    setExForm({ name: '', sets: '', reps: '', weight: '', imageUrl: '' })
    setIsAddingEx(false)
  }

  const deleteExercise = async (index) => {
    if (!todaySplit) return
    const updatedExercises = (todaySplit.exercises || []).filter((_, i) => i !== index)
    await db.gymSplits.update(today, { exercises: updatedExercises })
    // Also remove any completion record for this index (and shift indices if necessary, 
    // but for simplicity we'll just clear today's completions to avoid index mismatch)
    const existingIds = completedRecords.map(r => r.id)
    if (existingIds.length > 0) {
      await db.gymCompleted.bulkDelete(existingIds)
    }
  }

  const handleRenameSplit = async () => {
    if (!todaySplit || !newSplitName.trim()) return
    await db.gymSplits.update(today, { name: newSplitName.trim() })
    setIsEditingSplitName(false)
  }

  return (
    <motion.div {...pageTransition} className="px-[var(--spacing-container-margin)]">
      {/* Header */}
      <section className="pt-6 pb-4">
        <h1 className="font-[var(--font-headline)] text-3xl font-semibold text-on-surface tracking-wide">
          Gym Dashboard
        </h1>
        <p className="text-on-surface-variant text-sm mt-1 font-light">
          Track your nutrition and log today's workout.
        </p>
      </section>

      {/* Daily Nutrition */}
      <section className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-[var(--font-headline)] text-base font-semibold text-on-surface">
            Daily Nutrition
          </h2>
          <button 
            onClick={() => {
              setCalInput(calorieGoal.toString())
              setProInput(proteinGoal.toString())
              setIsEditingTargets(prev => !prev)
            }}
            className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs font-semibold"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
            Edit Targets
          </button>
        </div>

        {/* Edit Targets Form */}
        <AnimatePresence>
          {isEditingTargets && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="card-elegant p-4 mb-3 space-y-3 overflow-hidden border border-primary/30"
            >
              <h3 className="text-xs font-semibold text-on-surface uppercase tracking-wider">Edit Nutrition Targets</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-on-surface-variant block mb-1">Calories (kcal)</label>
                  <input
                    type="number"
                    value={calInput}
                    onChange={(e) => setCalInput(e.target.value)}
                    className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-on-surface-variant block mb-1">Protein (g)</label>
                  <input
                    type="number"
                    value={proInput}
                    onChange={(e) => setProInput(e.target.value)}
                    className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    const c = parseInt(calInput, 10)
                    const p = parseInt(proInput, 10)
                    if (c > 0 && p > 0) {
                      setCalorieGoal(c)
                      setProteinGoal(p)
                      localStorage.setItem('gymCalorieGoal', c.toString())
                      localStorage.setItem('gymProteinGoal', p.toString())
                      setIsEditingTargets(false)
                    }
                  }}
                  className="flex-1 bg-primary text-background text-xs font-semibold py-2.5 rounded-lg"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditingTargets(false)}
                  className="flex-1 bg-surface-container-high text-on-surface-variant text-xs font-semibold py-2.5 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Calories Card */}
        <div className="card-elegant p-4 mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Calories</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[18px]">local_fire_department</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="font-[var(--font-headline)] text-3xl font-semibold text-on-surface">
              {totals.calories}
            </span>
            <span className="text-on-surface-variant text-sm">/ {calorieGoal} kcal</span>
          </div>
          <div className="progress-track h-2 mb-1">
            <motion.div
              className="progress-gold h-full"
              initial={{ width: 0 }}
              animate={{ width: `${calPercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[11px] text-on-surface-variant">
            {Math.max(calorieGoal - totals.calories, 0)} kcal remaining
          </span>
        </div>

        {/* Protein Card */}
        <div className="card-elegant p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Protein</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[18px]">egg_alt</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="font-[var(--font-headline)] text-3xl font-semibold text-on-surface">
              {totals.protein}
            </span>
            <span className="text-on-surface-variant text-sm">/ {proteinGoal} g</span>
          </div>
          <div className="progress-track h-2 mb-1">
            <motion.div
              className="progress-gold h-full"
              initial={{ width: 0 }}
              animate={{ width: `${proPercent}%` }}
              transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[11px] text-on-surface-variant">
            {Math.max(proteinGoal - totals.protein, 0)}g remaining
          </span>
        </div>
      </section>

      {/* Log Meal */}
      <section className="mb-5">
        <h2 className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest mb-3">
          Log Meal
        </h2>
        <div className="card-elegant p-4 space-y-3">
          <input
            type="text"
            placeholder="Meal Name (e.g., Chicken Salad)"
            value={mealForm.name}
            onChange={(e) => setMealForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3.5 py-3 border border-outline-variant focus:outline-none focus:border-primary/50 transition-colors"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              placeholder="Calories"
              value={mealForm.calories}
              onChange={(e) => setMealForm((f) => ({ ...f, calories: e.target.value }))}
              className="bg-surface-container-high text-on-surface text-sm rounded-lg px-3.5 py-3 border border-outline-variant focus:outline-none focus:border-primary/50 transition-colors"
            />
            <input
              type="number"
              placeholder="Protein (g)"
              value={mealForm.protein}
              onChange={(e) => setMealForm((f) => ({ ...f, protein: e.target.value }))}
              className="bg-surface-container-high text-on-surface text-sm rounded-lg px-3.5 py-3 border border-outline-variant focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <button
            onClick={logMeal}
            disabled={!mealForm.name || !mealForm.calories}
            className="w-full bg-primary text-background font-medium text-sm py-3 rounded-lg hover:bg-primary/90 btn-press disabled:opacity-40 disabled:pointer-events-none"
          >
            + Log
          </button>
        </div>
      </section>

      {/* Today's Logs */}
      {meals.length > 0 && (
        <section className="mb-[var(--spacing-section-gap)]">
          <h2 className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest mb-3">
            Today's Logs
          </h2>
          <div className="card-elegant overflow-hidden divide-y divide-outline-variant/40">
            <AnimatePresence initial={false}>
              {meals.map((meal) => (
                <motion.div
                  key={meal.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-between px-4 py-3.5"
                >
                  <div>
                    <span className="text-sm font-normal text-on-surface">{meal.name}</span>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      {meal.calories} kcal | {meal.protein}g Protein
                    </p>
                  </div>
                  <button
                    onClick={() => deleteMeal(meal.id)}
                    className="text-on-surface-variant hover:text-error transition-colors p-1"
                    aria-label={`Delete ${meal.name}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Today's Workout */}
      <section className="pb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-[var(--font-headline)] text-base font-semibold text-on-surface">
            Today's Workout
          </h2>
          {splitsCount > 0 && todaySplit && (
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[18px]">calendar_today</span>
              {isEditingSplitName ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newSplitName}
                    onChange={(e) => setNewSplitName(e.target.value)}
                    className="bg-surface-container-high text-on-surface text-xs rounded-lg px-2 py-1 border border-primary/40 focus:outline-none w-24 focus:border-primary"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRenameSplit()
                      } else if (e.key === 'Escape') {
                        setIsEditingSplitName(false)
                      }
                    }}
                  />
                  <button
                    onClick={handleRenameSplit}
                    className="text-primary hover:text-primary/80 p-0.5"
                    aria-label="Save split name"
                  >
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  </button>
                  <button
                    onClick={() => setIsEditingSplitName(false)}
                    className="text-on-surface-variant hover:text-error p-0.5"
                    aria-label="Cancel rename"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setNewSplitName(todaySplit.name)
                    setIsEditingSplitName(true)
                  }}
                  className="text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors btn-press text-left"
                  title="Click to rename split"
                >
                  {today}: {todaySplit.name}
                  <span className="material-symbols-outlined text-[10px] opacity-75">edit</span>
                </button>
              )}
            </div>
          )}
        </div>

        {splitsCount === undefined ? (
          <div className="card-elegant p-8 text-center text-on-surface-variant font-light text-sm">
            <span className="material-symbols-outlined text-primary text-[28px] animate-spin mb-2 block">progress_activity</span>
            Loading split...
          </div>
        ) : splitsCount === 0 ? (
          <div className="card-elegant p-8 text-center border border-dashed border-primary/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
            <span className="material-symbols-outlined text-primary text-[44px] mb-3 block">fitness_center</span>
            <h3 className="font-[var(--font-headline)] text-lg font-semibold text-on-surface">No Workout Splits Setup</h3>
            <p className="text-xs text-on-surface-variant mt-1.5 mb-5 max-w-[280px] mx-auto font-light leading-relaxed">
              Your workout routine is currently blank. Load our default weekly split template or initialize a clean schedule.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-2">
              <button
                onClick={async () => {
                  try {
                    await seedDefaultSplits()
                  } catch (err) {
                    console.error('Failed to load default splits:', err)
                  }
                }}
                className="bg-primary text-background text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-primary/90 btn-press inline-flex items-center justify-center gap-1.5 shadow-lg shadow-primary/15 transition-all duration-200"
              >
                <span className="material-symbols-outlined text-[16px]">build</span>
                Load Default Template
              </button>
              <button
                onClick={async () => {
                  try {
                    await initializeBlankSplits()
                  } catch (err) {
                    console.error('Failed to initialize blank splits:', err)
                  }
                }}
                className="bg-surface-container-high text-on-surface-variant text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-surface-container-highest btn-press inline-flex items-center justify-center gap-1.5 transition-all duration-200"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                Start Clean (Blank)
              </button>
            </div>
          </div>
        ) : !todaySplit ? (
          <div className="card-elegant p-8 text-center text-on-surface-variant font-light text-sm">
            <span className="material-symbols-outlined text-primary text-[28px] animate-spin mb-2 block">progress_activity</span>
            Loading split...
          </div>
        ) : todaySplit.name === 'Rest' ? (
          <div className="card-elegant p-8 text-center">
            <span className="material-symbols-outlined text-primary text-[40px] mb-2 block">self_improvement</span>
            <h3 className="font-[var(--font-headline)] text-lg font-semibold text-on-surface">Rest Day</h3>
            <p className="text-sm text-on-surface-variant mt-1 font-light">
              Take it easy. Recovery is part of the process. 💪
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {(todaySplit.exercises || []).map((ex, i) => {
                const isDone = completed[i]
                return (
                  <motion.div
                    key={i}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-full flex items-center gap-2"
                  >
                    <div
                      className="flex-1 flex items-center gap-3 card-elegant p-4 text-left"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleExercise(i)
                        }}
                        className={`checkbox-gold ${isDone ? 'checked' : ''} shrink-0 btn-press`}
                      >
                        {isDone && (
                          <span className="material-symbols-outlined check-icon">check</span>
                        )}
                      </button>
                      <button 
                        onClick={() => ex.imageUrl && setSelectedImage(ex.imageUrl)}
                        className={`flex-1 min-w-0 flex items-center justify-between ${ex.imageUrl ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                        disabled={!ex.imageUrl}
                      >
                        <div className="text-left">
                          <span className={`text-sm font-normal block ${isDone ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                            {ex.name}
                          </span>
                          <span className="text-[11px] text-on-surface-variant">
                            {ex.sets} sets x {ex.reps} reps · {ex.weight}
                          </span>
                        </div>
                        {ex.imageUrl && (
                          <span className="material-symbols-outlined text-primary/60 text-[20px] ml-2 shrink-0">image</span>
                        )}
                      </button>
                    </div>
                    <button
                      onClick={() => deleteExercise(i)}
                      className="w-12 h-full card-elegant flex items-center justify-center text-on-surface-variant hover:text-error transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            <AnimatePresence>
              {isAddingEx && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="card-elegant p-4 overflow-hidden"
                >
                  <input
                    type="text"
                    placeholder="Exercise Name"
                    value={exForm.name}
                    onChange={(e) => setExForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant focus:outline-none focus:border-primary/50 mb-2"
                    autoFocus
                  />
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <input
                      type="number"
                      placeholder="Sets"
                      value={exForm.sets}
                      onChange={(e) => setExForm((f) => ({ ...f, sets: e.target.value }))}
                      className="bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant focus:outline-none focus:border-primary/50"
                    />
                    <input
                      type="text"
                      placeholder="Reps"
                      value={exForm.reps}
                      onChange={(e) => setExForm((f) => ({ ...f, reps: e.target.value }))}
                      className="bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant focus:outline-none focus:border-primary/50"
                    />
                      <input
                        type="text"
                        placeholder="Weight"
                        value={exForm.weight}
                        onChange={(e) => setExForm((f) => ({ ...f, weight: e.target.value }))}
                        className="bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-outline-variant focus:outline-none focus:border-primary/50"
                      />
                    </div>
                    <div className="flex gap-2 items-center mb-3">
                      <label className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-dashed border-outline-variant rounded-lg text-on-surface-variant text-xs cursor-pointer hover:border-primary/50 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
                        {exForm.imageUrl ? 'Change Image' : 'Attach Image'}
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                      {exForm.imageUrl && (
                        <div className="w-8 h-8 rounded shrink-0 overflow-hidden border border-outline-variant">
                          <img src={exForm.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                    <button
                      onClick={addExercise}
                      disabled={!exForm.name}
                      className="flex-1 bg-primary text-background text-xs font-medium py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsAddingEx(false)}
                      className="flex-1 bg-surface-container-high text-on-surface-variant text-xs font-medium py-2 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!isAddingEx && (
              <button 
                onClick={() => setIsAddingEx(true)}
                className="w-full flex items-center justify-center gap-2 py-3.5 text-primary text-sm font-medium border border-dashed border-primary/30 rounded-2xl hover:bg-primary/5 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add Exercise
              </button>
            )}
          </div>
        )}
      </section>

      {/* Image Modal Popup */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative max-w-sm w-full bg-surface-container rounded-2xl overflow-hidden shadow-2xl border border-outline-variant/30"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 z-10 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
              <img src={selectedImage} alt="Workout" className="w-full h-auto max-h-[70vh] object-contain" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
