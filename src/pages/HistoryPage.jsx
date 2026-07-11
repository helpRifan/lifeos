import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

const pageTransition = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 },
  transition: { duration: 0.3, ease: 'easeOut' },
}

export default function HistoryPage() {
  const navigate = useNavigate()

  // Read daily logs from Dexie
  const allLogs = useLiveQuery(() => db.dailyLogs.toArray(), []) ?? []

  const [selectedMonth, setSelectedMonth] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [activeTab, setActiveTab] = useState('all') // 'all', 'gym', 'water', 'skincare', 'skills'

  // Build logs grouped by date → module
  const logsByDate = {}
  allLogs.forEach((log) => {
    if (!logsByDate[log.date]) logsByDate[log.date] = {}
    logsByDate[log.date][log.moduleName] = log.data
  })

  // Group by month
  const groupedLogs = Object.keys(logsByDate).reduce((acc, dateStr) => {
    const [year, month, day] = dateStr.split('-')
    const date = new Date(year, month - 1, day)
    const monthKey = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    if (!acc[monthKey]) acc[monthKey] = []
    acc[monthKey].push(dateStr)
    return acc
  }, {})

  Object.keys(groupedLogs).forEach((m) => {
    groupedLogs[m].sort((a, b) => new Date(b) - new Date(a))
  })

  const months = Object.keys(groupedLogs).sort((a, b) => new Date(b) - new Date(a))

  const handleBack = () => {
    if (selectedDate) setSelectedDate(null)
    else if (selectedMonth) setSelectedMonth(null)
    else navigate('/settings')
  }

  const renderDailyDetails = () => {
    const data = logsByDate[selectedDate] || {}
    const [year, month, day] = selectedDate.split('-')
    const displayDate = new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

    const tabs = [
      { id: 'all', label: 'Overview', icon: 'dashboard' },
      { id: 'gym', label: 'Gym', icon: 'fitness_center', enabled: !!data.gym },
      { id: 'water', label: 'Water', icon: 'water_drop', enabled: !!data.water },
      { id: 'skincare', label: 'Skincare', icon: 'spa', enabled: !!data.skincare },
      { id: 'skills', label: 'Skills', icon: 'checklist', enabled: !!data.skills },
    ].filter(t => t.id === 'all' || t.enabled)

    return (
      <motion.div key="details" {...pageTransition} className="space-y-4 pb-12">
        <section className="mb-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3 border border-primary/20">
            <span className="material-symbols-outlined text-[28px] text-primary">calendar_month</span>
          </div>
          <h2 className="font-[var(--font-headline)] text-xl font-bold text-on-surface">{displayDate}</h2>
          <p className="text-[10px] text-on-surface-variant mt-1 uppercase tracking-widest font-semibold">Daily Tracking Log</p>
        </section>

        {/* Custom Tabs */}
        {tabs.length > 1 && (
          <div className="flex gap-1 bg-surface-container rounded-xl p-1 overflow-x-auto scrollbar-hide border border-outline-variant/30">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all shrink-0 ${
                  activeTab === t.id
                    ? 'bg-primary text-background shadow-md'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-4 mt-2">
          {/* GYM & NUTRITION DETAIL */}
          {data.gym && (activeTab === 'all' || activeTab === 'gym') && (
            <div className="card-elegant p-4 border border-outline-variant/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-[18px]">fitness_center</span>
                  </div>
                  <h3 className="font-[var(--font-headline)] text-sm font-semibold text-on-surface">Gym & Nutrition</h3>
                </div>
                <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  Split: {data.gym.split}
                </span>
              </div>

              {/* Nutrition Summary */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-surface-container-high rounded-xl p-3 border border-outline-variant/20">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold block">Calories</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold text-on-surface">{data.gym.totals?.calories || 0}</span>
                    <span className="text-[10px] text-on-surface-variant">kcal</span>
                  </div>
                </div>
                <div className="bg-surface-container-high rounded-xl p-3 border border-outline-variant/20">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold block">Protein</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold text-primary">{data.gym.totals?.protein || 0}</span>
                    <span className="text-[10px] text-on-surface-variant">g</span>
                  </div>
                </div>
              </div>

              {/* Meals Details */}
              {data.gym.meals && data.gym.meals.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-2">Meals Logged</h4>
                  <div className="space-y-1.5">
                    {data.gym.meals.map((meal, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs py-1.5 border-b border-outline-variant/20 last:border-0">
                        <span className="text-on-surface font-medium">{meal.name}</span>
                        <span className="text-on-surface-variant text-[11px] font-light">{meal.calories} kcal | {meal.protein}g P</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Workout Exercises Details */}
              {data.gym.exercises && data.gym.exercises.length > 0 && (
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-2">Exercises Done</h4>
                  <div className="space-y-2">
                    {data.gym.exercises.map((ex, idx) => {
                      const isCompleted = data.gym.completed?.[idx]
                      return (
                        <div key={idx} className="flex items-center gap-2 bg-surface-container-low/50 px-3 py-2 rounded-lg border border-outline-variant/10">
                          <span className={`material-symbols-outlined text-[16px] ${isCompleted ? 'text-primary' : 'text-on-surface-variant/40'}`}>
                            {isCompleted ? 'check_circle' : 'circle'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-normal truncate ${isCompleted ? 'text-on-surface font-medium' : 'text-on-surface-variant/60'}`}>
                              {ex.name}
                            </p>
                            <p className="text-[10px] text-on-surface-variant mt-0.5">
                              {ex.sets} sets x {ex.reps} reps · {ex.weight}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HYDRATION DETAIL */}
          {data.water && (activeTab === 'all' || activeTab === 'water') && (
            <div className="card-elegant p-4 border border-outline-variant/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-[18px]">water_drop</span>
                  </div>
                  <h3 className="font-[var(--font-headline)] text-sm font-semibold text-on-surface">Hydration Log</h3>
                </div>
                <span className="text-[11px] font-semibold text-primary">
                  {data.water.currentIntake} / {data.water.dailyGoal} ml
                </span>
              </div>

              {/* Progress bar */}
              <div className="progress-track h-2 mb-4 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="progress-gold h-full bg-primary"
                  style={{ width: `${Math.min((data.water.currentIntake / data.water.dailyGoal) * 100, 100)}%` }}
                />
              </div>

              {/* Water Log Timeline */}
              {data.water.records && data.water.records.length > 0 && (
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-3">Timeline</h4>
                  <div className="relative pl-4 border-l border-outline-variant/50 ml-1.5 space-y-3.5">
                    {data.water.records.map((r, idx) => (
                      <div key={idx} className="relative text-xs">
                        {/* Dot on line */}
                        <div className="absolute -left-[20.5px] top-1 w-2.5 h-2.5 rounded-full bg-primary border border-background" />
                        <div className="flex justify-between items-center">
                          <span className="font-normal text-on-surface flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-primary">{r.icon || 'water_drop'}</span>
                            {r.ml} ml
                          </span>
                          <span className="text-[10px] text-on-surface-variant">{r.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SKINCARE DETAIL */}
          {data.skincare && (activeTab === 'all' || activeTab === 'skincare') && (
            <div className="card-elegant p-4 border border-outline-variant/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-[18px]">spa</span>
                  </div>
                  <h3 className="font-[var(--font-headline)] text-sm font-semibold text-on-surface">Skincare Regimen</h3>
                </div>
                <span className="text-[11px] font-semibold text-primary">
                  {data.skincare.doneCount} / {data.skincare.totalCount} completed
                </span>
              </div>

              {/* Progress bar */}
              <div className="progress-track h-2 mb-4 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="progress-gold h-full bg-primary"
                  style={{ width: `${data.skincare.percent || 0}%` }}
                />
              </div>

              {/* Morning products */}
              {data.skincare.morningProducts && data.skincare.morningProducts.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-2">Morning Routine</h4>
                  <div className="space-y-2">
                    {data.skincare.morningProducts.map((p) => {
                      const isChecked = data.skincare.morningChecked?.[p.id]
                      return (
                        <div key={p.id} className="flex items-center gap-2 bg-surface-container-low/50 px-3 py-2 rounded-lg border border-outline-variant/10">
                          <span className={`material-symbols-outlined text-[16px] ${isChecked ? 'text-primary' : 'text-on-surface-variant/40'}`}>
                            {isChecked ? 'check_circle' : 'circle'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-normal text-on-surface truncate">{p.name}</p>
                            {p.note && <p className="text-[10px] text-on-surface-variant truncate">{p.note}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Evening products */}
              {data.skincare.eveningProducts && data.skincare.eveningProducts.length > 0 && (
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-2">Evening Routine</h4>
                  <div className="space-y-2">
                    {data.skincare.eveningProducts.map((p) => {
                      const isChecked = data.skincare.eveningChecked?.[p.id]
                      return (
                        <div key={p.id} className="flex items-center gap-2 bg-surface-container-low/50 px-3 py-2 rounded-lg border border-outline-variant/10">
                          <span className={`material-symbols-outlined text-[16px] ${isChecked ? 'text-primary' : 'text-on-surface-variant/40'}`}>
                            {isChecked ? 'check_circle' : 'circle'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-normal text-on-surface truncate">{p.name}</p>
                            {p.note && <p className="text-[10px] text-on-surface-variant truncate">{p.note}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TASKS & SKILLS DETAIL */}
          {data.skills && (activeTab === 'all' || activeTab === 'skills') && (
            <div className="card-elegant p-4 border border-outline-variant/30 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[18px]">checklist</span>
                </div>
                <h3 className="font-[var(--font-headline)] text-sm font-semibold text-on-surface">Tasks & Skills</h3>
              </div>

              {/* Tasks List */}
              {data.skills.tasks && data.skills.tasks.length > 0 && (
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-2">Daily Tasks</h4>
                  <div className="space-y-2">
                    {data.skills.tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2 bg-surface-container-low/50 px-3 py-2.5 rounded-lg border border-outline-variant/10">
                        <span className={`material-symbols-outlined text-[16px] ${task.completed ? 'text-primary' : 'text-on-surface-variant/40'}`}>
                          {task.completed ? 'check_circle' : 'circle'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-normal text-on-surface truncate">{task.title}</p>
                          <span className="text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium mt-1 inline-block">
                            {task.category}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Deadlines List */}
              {data.skills.deadlines && data.skills.deadlines.length > 0 && (
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-2">Skill Deadlines</h4>
                  <div className="space-y-2">
                    {data.skills.deadlines.map((dl) => (
                      <div key={dl.id} className="flex items-start gap-2 bg-surface-container-low/50 px-3 py-2.5 rounded-lg border border-outline-variant/10">
                        <span className={`material-symbols-outlined text-[16px] mt-0.5 ${dl.urgent ? 'text-error' : 'text-primary'}`}>
                          {dl.urgent ? 'warning' : 'event_upcoming'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-normal text-on-surface truncate">{dl.title}</p>
                          <p className="text-[9px] text-on-surface-variant mt-0.5">
                            Due {dl.due} {dl.time ? `@ ${dl.time}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Goals List */}
              {data.skills.milestones && data.skills.milestones.length > 0 && (
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-2">Milestones & Goals</h4>
                  <div className="space-y-2">
                    {data.skills.milestones.map((ms) => (
                      <div key={ms.id} className="flex items-center gap-3 bg-surface-container-low/50 px-3 py-2.5 rounded-lg border border-outline-variant/10">
                        <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center border border-outline-variant/30">
                          <span className="material-symbols-outlined text-primary text-[18px]">{ms.icon || 'flag'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-normal text-on-surface truncate">{ms.title}</p>
                          <p className="text-[9px] text-on-surface-variant mt-0.5">{ms.dateLabel}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {Object.keys(data).length === 0 && (
            <div className="text-center py-12 text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-50">history_toggle_off</span>
              <p className="font-light">No data logged for this day.</p>
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  const renderDaysList = () => {
    const dates = groupedLogs[selectedMonth]
    return (
      <motion.div key="days" {...pageTransition} className="pb-12">
        <div className="mb-4 px-1">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">Selected Month</p>
          <h2 className="font-[var(--font-headline)] text-2xl font-bold text-on-surface mt-0.5">{selectedMonth}</h2>
        </div>
        <div className="space-y-2.5">
          {dates.map((dateStr) => {
            const [year, month, day] = dateStr.split('-')
            const displayDate = new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'long', month: 'short' })
            const dayData = logsByDate[dateStr] || {}

            return (
              <button
                key={dateStr}
                onClick={() => {
                  setSelectedDate(dateStr)
                  setActiveTab('all')
                }}
                className="w-full flex items-center justify-between card-elegant p-4 btn-press text-left border border-outline-variant/20 hover:border-primary/20"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base font-[var(--font-headline)] border border-primary/20 shrink-0">
                    {day}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-on-surface block">{displayDate}</span>
                    {/* Tiny summary badges */}
                    <div className="flex gap-1.5 mt-1.5">
                      {dayData.gym && (
                        <span className="material-symbols-outlined text-[12px] text-primary/70">fitness_center</span>
                      )}
                      {dayData.water && (
                        <span className="material-symbols-outlined text-[12px] text-primary/70">water_drop</span>
                      )}
                      {dayData.skincare && (
                        <span className="material-symbols-outlined text-[12px] text-primary/70">spa</span>
                      )}
                      {dayData.skills && (
                        <span className="material-symbols-outlined text-[12px] text-primary/70">checklist</span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant text-[18px]">chevron_right</span>
              </button>
            )
          })}
        </div>
      </motion.div>
    )
  }

  const renderMonthsList = () => {
    if (months.length === 0) {
      return (
        <motion.div key="empty" {...pageTransition} className="text-center py-20 text-on-surface-variant bg-surface-container/50 rounded-3xl p-6 border border-dashed border-outline-variant/40">
          <span className="material-symbols-outlined text-5xl mb-4 text-primary/50">calendar_month</span>
          <h3 className="font-[var(--font-headline)] text-base font-semibold text-on-surface">Log History Empty</h3>
          <p className="text-xs mt-1.5 font-light text-on-surface-variant/80 max-w-xs mx-auto leading-relaxed">
            Your offline database does not have any log snapshots yet. Try checking off some skincare tasks or logging your water intake to seed logs!
          </p>
        </motion.div>
      )
    }

    return (
      <motion.div key="months" {...pageTransition} className="grid grid-cols-2 gap-3.5 pb-12">
        {months.map((month) => {
          const count = groupedLogs[month].length
          const [mName, yName] = month.split(' ')
          return (
            <button
              key={month}
              onClick={() => setSelectedMonth(month)}
              className="flex flex-col items-start p-4 card-elegant btn-press group border border-outline-variant/20 hover:border-primary/20 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
                <span className="material-symbols-outlined text-[20px]">folder_open</span>
              </div>
              <span className="text-base font-[var(--font-headline)] font-bold text-on-surface block leading-tight">{mName}</span>
              <span className="text-[10px] text-on-surface-variant font-medium mt-0.5">{yName}</span>
              <div className="w-full flex items-center justify-between mt-5 pt-2.5 border-t border-outline-variant/30 text-[10px] text-on-surface-variant">
                <span>Total logs</span>
                <span className="font-semibold text-primary">{count}</span>
              </div>
            </button>
          )
        })}
      </motion.div>
    )
  }

  return (
    <div className="px-[var(--spacing-container-margin)] min-h-[calc(100vh-4rem)]">
      <section className="pt-4 pb-6 flex items-center gap-3">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors btn-press"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <h1 className="font-[var(--font-headline)] text-xl font-semibold text-on-surface tracking-wide">
          Log History
        </h1>
      </section>

      <AnimatePresence mode="wait">
        {selectedDate ? renderDailyDetails() : selectedMonth ? renderDaysList() : renderMonthsList()}
      </AnimatePresence>
    </div>
  )
}
