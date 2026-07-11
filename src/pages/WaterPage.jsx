import { motion } from 'framer-motion'
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import WaterCircle from '../components/WaterCircle'
import { db, todayISO, formatTime } from '../db'
import { useDailyLog } from '../hooks/useDailyLog'
import { syncAllNotifications } from '../lib/notifications'

const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
  transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
}

const QUICK_AMOUNTS = [
  { ml: 100, icon: 'local_cafe', label: '100ml' },
  { ml: 150, icon: 'coffee', label: '150ml' },
  { ml: 200, icon: 'water_full', label: '200ml' },
  { ml: 250, icon: 'local_drink', label: '250ml' },
  { ml: 300, icon: 'water_drop', label: '300ml' },
]

export default function WaterPage() {
  const navigate = useNavigate()
  const [dailyGoal, setDailyGoal] = useState(() => parseInt(localStorage.getItem('waterGoal') || '1790', 10))
  const [isEditingGoal, setIsEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const todayDate = todayISO()

  const records = useLiveQuery(
    () => db.waterRecords.where('date').equals(todayDate).reverse().toArray(),
    [todayDate]
  ) ?? []

  const currentIntake = useMemo(
    () => records.reduce((sum, r) => sum + r.ml, 0),
    [records]
  )
  const percent = Math.min((currentIntake / dailyGoal) * 100, 100)

  useDailyLog('water', { currentIntake, dailyGoal, records })

  const nextReminderText = useMemo(() => {
    if (currentIntake >= dailyGoal) return 'Goal Met!'
    const hour = new Date().getHours()
    if (hour < 10) return '10:00 AM'
    if (hour < 12) return '12:00 PM'
    if (hour < 14) return '2:00 PM'
    if (hour < 16) return '4:00 PM'
    if (hour < 18) return '6:00 PM'
    if (hour < 20) return '8:00 PM'
    return 'Tomorrow'
  }, [currentIntake, dailyGoal, new Date().getHours()])

  const addWater = async (ml, icon) => {
    await db.waterRecords.add({
      ml,
      time: formatTime(),
      icon,
      date: todayDate,
    })
    syncAllNotifications()
  }

  const removeRecord = async (id) => {
    await db.waterRecords.delete(id)
    syncAllNotifications()
  }

  const handleSaveGoal = () => {
    const val = parseInt(goalInput, 10)
    if (val > 0) {
      setDailyGoal(val)
      localStorage.setItem('waterGoal', val.toString())
      setIsEditingGoal(false)
      syncAllNotifications()
    }
  }

  const addCustomWater = async () => {
    const amountStr = prompt('Enter custom water amount in ml:')
    if (!amountStr) return
    const ml = parseInt(amountStr, 10)
    if (ml > 0) {
      await addWater(ml, 'local_drink')
    }
  }

  return (
    <motion.div {...pageTransition} className="px-[var(--spacing-container-margin)] min-h-[calc(100vh-4rem)]">
      {/* Back + Title */}
      <section className="pt-4 pb-2 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div>
          <h1 className="font-[var(--font-headline)] text-xl font-semibold text-on-surface tracking-wide">
            Water Intake
          </h1>
          <p className="text-on-surface-variant text-xs font-light">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
      </section>

      {/* Large Water Circle */}
      <motion.div
        className="flex flex-col items-center py-6"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        <WaterCircle percent={percent} size={200} />

        <div className="mt-5 text-center">
          <div className="flex items-baseline justify-center gap-1">
            <span className="font-[var(--font-headline)] text-3xl font-semibold text-primary">
              {currentIntake}
            </span>
            <span className="text-on-surface-variant text-lg">/</span>
            <span className="font-[var(--font-headline)] text-3xl font-semibold text-on-surface">
              {dailyGoal}
            </span>
            <span className="text-on-surface-variant text-sm ml-1">ml</span>
          </div>
          <div className="flex items-center justify-center gap-1 mt-1 text-on-surface-variant text-xs">
            {isEditingGoal ? (
              <div className="flex items-center gap-1.5 bg-surface-container-high px-2.5 py-1 rounded-lg border border-outline-variant">
                <input
                  type="number"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  className="w-16 bg-transparent text-center text-xs font-semibold text-on-surface focus:outline-none border-b border-primary/50"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveGoal()
                    if (e.key === 'Escape') setIsEditingGoal(false)
                  }}
                />
                <button onClick={handleSaveGoal} className="text-primary hover:text-primary/80 flex items-center">
                  <span className="material-symbols-outlined text-[16px]">check</span>
                </button>
                <button onClick={() => setIsEditingGoal(false)} className="text-on-surface-variant hover:text-on-surface flex items-center">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            ) : (
              <>
                <span>Daily goal</span>
                <button
                  onClick={() => {
                    setGoalInput(dailyGoal.toString())
                    setIsEditingGoal(true)
                  }}
                  className="hover:text-primary transition-colors flex items-center"
                >
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Quick Add Buttons */}
      <motion.section
        className="card-elegant p-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <div className="flex justify-between items-end">
          {QUICK_AMOUNTS.map((amt) => (
            <button
              key={amt.ml}
              onClick={() => addWater(amt.ml, amt.icon)}
              className="flex flex-col items-center gap-1.5 group"
            >
              <div className="w-11 h-11 rounded-xl bg-surface-container-high group-hover:bg-primary/15 group-active:scale-90 flex items-center justify-center transition-all duration-200">
                <span className="material-symbols-outlined text-primary text-[20px]">{amt.icon}</span>
              </div>
              <span className="text-[10px] text-on-surface-variant font-normal">{amt.label}</span>
            </button>
          ))}
          <button onClick={addCustomWater} className="flex flex-col items-center gap-1.5 group">
            <div className="w-11 h-11 rounded-xl border border-dashed border-outline-variant group-hover:border-primary flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary text-[20px]">add</span>
            </div>
            <span className="text-[10px] text-on-surface-variant font-normal">Custom</span>
          </button>
        </div>
      </motion.section>

      {/* Today's Records */}
      <motion.section
        className="mt-[var(--spacing-section-gap)] pb-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-[var(--font-headline)] text-base font-semibold text-on-surface">
            Today's Records
          </h2>
          <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            {records.length} cups
          </span>
        </div>

        {/* Next reminder */}
        <div className="card-elegant p-3.5 flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[18px]">alarm</span>
          </div>
          <div className="flex-1">
            <span className="text-sm text-on-surface font-normal">Upcoming Reminder</span>
          </div>
          <span className={`text-xs ${currentIntake >= dailyGoal ? 'text-[#4CAF82] font-semibold' : 'text-on-surface-variant'}`}>
            {nextReminderText}
          </span>
        </div>

        {/* Records list */}
        <div className="space-y-2">
          {records.map((record) => (
            <motion.div
              key={record.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="card-elegant p-3.5 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[18px]">{record.icon}</span>
              </div>
              <div className="flex-1">
                <span className="text-sm text-on-surface font-normal">{record.ml}ml</span>
              </div>
              <span className="text-xs text-on-surface-variant">{record.time}</span>
              <button
                onClick={() => removeRecord(record.id)}
                className="text-on-surface-variant hover:text-error transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </motion.div>
          ))}
        </div>

        {records.length === 0 && (
          <div className="text-center py-8 text-on-surface-variant text-sm font-light">
            No water logged yet today. Stay hydrated! 💧
          </div>
        )}
      </motion.section>
    </motion.div>
  )
}
