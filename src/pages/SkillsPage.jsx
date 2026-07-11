import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayISO } from '../db'
import { useDailyLog } from '../hooks/useDailyLog'
import { syncAllNotifications } from '../lib/notifications'

// ─── Constants ───────────────────────────────────────────────────────

const TABS = [
  { key: 'tasks', label: 'Tasks', icon: 'task_alt' },
  { key: 'deadlines', label: 'Deadlines', icon: 'event_upcoming' },
  { key: 'milestones', label: 'Goals', icon: 'flag' },
]

// ─── Add Sheet (bottom sheet for adding items) ───────────────────────

function AddSheet({ type, onClose, onAdd }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [due, setDue] = useState('')
  const [time, setTime] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [dateLabel, setDateLabel] = useState('')
  const [icon, setIcon] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    if (type === 'tasks') onAdd({ title, category: category || 'General' })
    else if (type === 'deadlines') onAdd({ title, category: category || 'General', due: due || 'TBD', time, urgent })
    else onAdd({ title, dateLabel: dateLabel || 'TBD', icon: icon || 'flag' })
    onClose()
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[70] bg-surface-container rounded-t-3xl p-5 pb-8 border-t border-outline-variant"
      >
        <div className="w-10 h-1 bg-outline-variant/40 rounded-full mx-auto mb-4" />
        <h3 className="font-[var(--font-headline)] text-base font-semibold text-on-surface mb-4">
          {type === 'tasks' ? 'New Task' : type === 'deadlines' ? 'New Deadline' : 'New Goal'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" placeholder={type === 'milestones' ? 'Goal title' : 'Title'} value={title}
            onChange={(e) => setTitle(e.target.value)} autoFocus
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-xl px-4 py-3 border border-outline-variant focus:outline-none focus:border-primary/50 transition-colors" />

          {type !== 'milestones' && (
            <input type="text" placeholder="Category (optional)" value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-surface-container-high text-on-surface text-sm rounded-xl px-4 py-3 border border-outline-variant focus:outline-none focus:border-primary/50 transition-colors" />
          )}

          {type === 'deadlines' && (
            <>
              <div className="flex gap-2">
                <input type="date" value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="flex-1 bg-surface-container-high text-on-surface text-sm rounded-xl px-4 py-3 border border-outline-variant focus:outline-none focus:border-primary/50 transition-colors" />
                <input type="time" value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="flex-1 bg-surface-container-high text-on-surface text-sm rounded-xl px-4 py-3 border border-outline-variant focus:outline-none focus:border-primary/50 transition-colors" />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer py-1 px-1">
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${urgent ? 'bg-error border-error' : 'border-outline-variant'}`}
                  onClick={(e) => { e.preventDefault(); setUrgent(!urgent) }}>
                  {urgent && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
                </div>
                <span className="text-sm text-on-surface">Mark as urgent</span>
              </label>
            </>
          )}

          {type === 'milestones' && (
            <div className="flex gap-2">
              <input type="date" value={dateLabel}
                onChange={(e) => setDateLabel(e.target.value)}
                className="flex-[2] bg-surface-container-high text-on-surface text-sm rounded-xl px-4 py-3 border border-outline-variant focus:outline-none focus:border-primary/50 transition-colors" />
              <input type="text" placeholder="Icon (e.g. star)" value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="flex-1 bg-surface-container-high text-on-surface text-sm rounded-xl px-4 py-3 border border-outline-variant focus:outline-none focus:border-primary/50 transition-colors" />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-medium text-on-surface-variant border border-outline-variant hover:bg-surface-container-high transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!title.trim()}
              className="flex-1 py-3 rounded-xl text-sm font-medium bg-primary text-background hover:bg-primary/90 disabled:opacity-40 transition-colors">
              Add
            </button>
          </div>
        </form>
      </motion.div>
    </>
  )
}

// ─── Task Item ───────────────────────────────────────────────────────

function TaskItem({ task, onToggle, onDelete }) {
  const [swiping, setSwiping] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
      layout
      className="group"
    >
      <div className={`card-elegant p-4 flex items-center gap-3 transition-all ${task.done ? 'opacity-60' : ''}`}>
        {/* Checkbox */}
        <button onClick={onToggle}
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
            task.done ? 'bg-primary border-primary' : 'border-outline-variant hover:border-primary/50'
          }`}>
          {task.done && <span className="material-symbols-outlined text-background text-[13px]">check</span>}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm text-on-surface transition-all ${task.done ? 'line-through text-on-surface-variant' : ''}`}>
            {task.title}
          </p>
          {task.category && (
            <span className="inline-block mt-1 text-[10px] text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full border border-outline-variant/30">
              {task.category}
            </span>
          )}
        </div>

        {/* Delete */}
        <button onClick={onDelete}
          className="text-on-surface-variant hover:text-error transition-all p-1 -mr-1">
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </motion.div>
  )
}

// ─── Deadline Item ───────────────────────────────────────────────────

function DeadlineItem({ deadline, onDelete }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
      layout
      className="group"
    >
      <div className={`card-elegant p-4 flex items-center gap-3 ${deadline.urgent ? 'ring-1 ring-error/30' : ''}`}>
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          deadline.urgent ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'
        }`}>
          <span className="material-symbols-outlined text-[20px]">
            {deadline.urgent ? 'priority_high' : 'event_upcoming'}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-on-surface">{deadline.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-block text-[10px] text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full border border-outline-variant/30">
              {deadline.category}
            </span>
          </div>
        </div>

        {/* Due */}
        <div className="text-right shrink-0">
          <p className={`text-xs font-medium ${deadline.urgent ? 'text-error' : 'text-primary'}`}>
            {deadline.due}
          </p>
          {deadline.time && <p className="text-[10px] text-on-surface-variant mt-0.5">{deadline.time}</p>}
        </div>

        {/* Delete */}
        <button onClick={onDelete}
          className="text-on-surface-variant hover:text-error transition-all p-1 -mr-1">
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </motion.div>
  )
}

// ─── Milestone Item ──────────────────────────────────────────────────

function MilestoneItem({ milestone, onDelete }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
      layout
      className="group"
    >
      <div className="card-elegant p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[20px]">{milestone.icon || 'flag'}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-on-surface">{milestone.title}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">{milestone.dateLabel}</p>
        </div>
        <button onClick={onDelete}
          className="text-on-surface-variant hover:text-error transition-all p-1 -mr-1">
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </motion.div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────

function EmptyState({ type }) {
  const config = {
    tasks: { icon: 'task_alt', text: 'No tasks yet', sub: 'Tap + to add your first task' },
    deadlines: { icon: 'event_upcoming', text: 'No deadlines', sub: 'Tap + to track an upcoming deadline' },
    milestones: { icon: 'flag', text: 'No goals set', sub: 'Tap + to set a goal or milestone' },
  }
  const c = config[type]

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-primary/40 text-[32px]">{c.icon}</span>
      </div>
      <p className="text-on-surface-variant text-sm font-light">{c.text}</p>
      <p className="text-on-surface-variant/60 text-xs mt-1">{c.sub}</p>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────

export default function SkillsPage() {
  const todayDate = todayISO()

  const tasks = useLiveQuery(() => db.skillTasks.toArray(), []) ?? []
  const deadlines = useLiveQuery(() => db.skillDeadlines.toArray(), []) ?? []
  const milestones = useLiveQuery(() => db.skillMilestones.toArray(), []) ?? []

  const [activeTab, setActiveTab] = useState('tasks')
  const [showAdd, setShowAdd] = useState(false)

  useDailyLog('skills', { tasks, deadlines, milestones })

  // ─── Stats ───────────────────────────────────────────────────────

  const tasksDone = tasks.filter(t => t.done).length
  const urgentCount = deadlines.filter(d => d.urgent).length

  // ─── CRUD ────────────────────────────────────────────────────────

  const handleAdd = async (data) => {
    if (activeTab === 'tasks') {
      await db.skillTasks.add({ ...data, done: false, date: todayDate })
    } else if (activeTab === 'deadlines') {
      await db.skillDeadlines.add({ ...data, date: todayDate })
    } else {
      await db.skillMilestones.add({ ...data, color: 'gold', date: todayDate })
    }
    syncAllNotifications()
  }

  const toggleTask = async (id) => {
    const task = tasks.find(t => t.id === id)
    if (task) {
      await db.skillTasks.update(id, { done: !task.done })
      syncAllNotifications()
    }
  }

  const deleteTask = async (id) => {
    await db.skillTasks.delete(id)
    syncAllNotifications()
  }
  const deleteDeadline = async (id) => {
    await db.skillDeadlines.delete(id)
    syncAllNotifications()
  }
  const deleteMilestone = async (id) => {
    await db.skillMilestones.delete(id)
    syncAllNotifications()
  }

  // Sort: undone first, then done
  const sortedTasks = useMemo(() =>
    [...tasks].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0)),
    [tasks]
  )

  // Sort: urgent first
  const sortedDeadlines = useMemo(() =>
    [...deadlines].sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0)),
    [deadlines]
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="px-[var(--spacing-container-margin)]"
    >
      {/* Header */}
      <section className="pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="font-[var(--font-headline)] text-3xl font-semibold text-on-surface tracking-wide">
            Tasks
          </h1>
          <p className="text-on-surface-variant text-sm mt-1 font-light">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="w-10 h-10 rounded-full bg-primary text-background flex items-center justify-center shadow-lg shadow-primary/20 hover:bg-primary/90 btn-press transition-all">
          <span className="material-symbols-outlined text-[20px]">add</span>
        </button>
      </section>

      {/* Quick Stats */}
      <div className="flex gap-3 mb-5">
        <div className="card-elegant p-3 flex-1 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[18px]">checklist</span>
          </div>
          <div>
            <p className="font-[var(--font-headline)] text-lg font-semibold text-on-surface">{tasksDone}/{tasks.length}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Done</p>
          </div>
        </div>
        <div className="card-elegant p-3 flex-1 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${urgentCount > 0 ? 'bg-error/10' : 'bg-primary/10'}`}>
            <span className={`material-symbols-outlined text-[18px] ${urgentCount > 0 ? 'text-error' : 'text-primary'}`}>
              {urgentCount > 0 ? 'warning' : 'event_available'}
            </span>
          </div>
          <div>
            <p className="font-[var(--font-headline)] text-lg font-semibold text-on-surface">{urgentCount > 0 ? urgentCount : deadlines.length}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">{urgentCount > 0 ? 'Urgent' : 'Deadlines'}</p>
          </div>
        </div>
        <div className="card-elegant p-3 flex-1 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[18px]">flag</span>
          </div>
          <div>
            <p className="font-[var(--font-headline)] text-lg font-semibold text-on-surface">{milestones.length}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Goals</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-container rounded-xl p-1 gap-1 mb-4">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.key ? 'bg-primary text-background' : 'text-on-surface-variant hover:text-on-surface'
            }`}>
            <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="pb-24">
        <AnimatePresence mode="wait">
          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <motion.div key="tasks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {sortedTasks.length > 0 ? (
                <div className="space-y-2">
                  <AnimatePresence>
                    {sortedTasks.map((task) => (
                      <TaskItem key={task.id} task={task}
                        onToggle={() => toggleTask(task.id)}
                        onDelete={() => deleteTask(task.id)} />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <EmptyState type="tasks" />
              )}
            </motion.div>
          )}

          {/* Deadlines Tab */}
          {activeTab === 'deadlines' && (
            <motion.div key="deadlines" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {sortedDeadlines.length > 0 ? (
                <div className="space-y-2">
                  <AnimatePresence>
                    {sortedDeadlines.map((dl) => (
                      <DeadlineItem key={dl.id} deadline={dl} onDelete={() => deleteDeadline(dl.id)} />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <EmptyState type="deadlines" />
              )}
            </motion.div>
          )}

          {/* Milestones/Goals Tab */}
          {activeTab === 'milestones' && (
            <motion.div key="milestones" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {milestones.length > 0 ? (
                <div className="space-y-2">
                  <AnimatePresence>
                    {milestones.map((ms) => (
                      <MilestoneItem key={ms.id} milestone={ms} onDelete={() => deleteMilestone(ms.id)} />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <EmptyState type="milestones" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add Sheet */}
      <AnimatePresence>
        {showAdd && (
          <AddSheet type={activeTab} onClose={() => setShowAdd(false)} onAdd={handleAdd} />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
