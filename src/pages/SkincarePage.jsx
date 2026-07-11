import { motion, AnimatePresence } from 'framer-motion'
import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayISO } from '../db'
import { useDailyLog } from '../hooks/useDailyLog'

const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.3, ease: 'easeOut' },
}

export default function SkincarePage() {
  const todayDate = todayISO()

  // Products from Dexie
  const morning = useLiveQuery(() => db.skincareMorning.toArray(), []) ?? []
  const evening = useLiveQuery(() => db.skincareEvening.toArray(), []) ?? []

  // Check states from Dexie
  const morningCheckedRecords = useLiveQuery(
    () => db.skincareMorningChecked.where('date').equals(todayDate).toArray(),
    [todayDate]
  ) ?? []
  const eveningCheckedRecords = useLiveQuery(
    () => db.skincareEveningChecked.where('date').equals(todayDate).toArray(),
    [todayDate]
  ) ?? []

  const morningChecked = useMemo(() => {
    const map = {}
    morningCheckedRecords.forEach((r) => { map[r.itemId] = r.checked })
    return map
  }, [morningCheckedRecords])

  const eveningChecked = useMemo(() => {
    const map = {}
    eveningCheckedRecords.forEach((r) => { map[r.itemId] = r.checked })
    return map
  }, [eveningCheckedRecords])

  // Editing
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', note: '' })
  const [addingTo, setAddingTo] = useState(null)
  const [addForm, setAddForm] = useState({ name: '', note: '' })

  const allItems = [...morning, ...evening]
  const allChecked = { ...morningChecked, ...eveningChecked }
  const doneCount = allItems.filter((p) => allChecked[p.id]).length
  const totalCount = allItems.length
  const percent = totalCount > 0 ? (doneCount / totalCount) * 100 : 0

  useDailyLog('skincare', {
    doneCount,
    totalCount,
    percent,
    morningProducts: morning || [],
    eveningProducts: evening || [],
    morningChecked,
    eveningChecked
  })

  const toggleCheck = async (id, isMorning) => {
    const table = isMorning ? db.skincareMorningChecked : db.skincareEveningChecked
    const records = isMorning ? morningCheckedRecords : eveningCheckedRecords
    const existing = records.find((r) => r.itemId === id)
    if (existing) {
      await table.update(existing.id, { checked: !existing.checked })
    } else {
      await table.add({ itemId: id, checked: true, date: todayDate })
    }
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setEditForm({ name: item.name, note: item.note || '' })
  }

  const saveEdit = async (isMorning) => {
    if (!editForm.name.trim()) return
    const table = isMorning ? db.skincareMorning : db.skincareEvening
    await table.update(editingId, { name: editForm.name.trim(), note: editForm.note.trim() })
    setEditingId(null)
  }

  const deleteProduct = async (id, isMorning) => {
    const table = isMorning ? db.skincareMorning : db.skincareEvening
    await table.delete(id)
    if (editingId === id) setEditingId(null)
  }

  const addProduct = async (isMorning) => {
    if (!addForm.name.trim()) return
    const table = isMorning ? db.skincareMorning : db.skincareEvening
    await table.add({
      name: addForm.name.trim(),
      note: addForm.note.trim(),
      required: false,
      date: todayISO(),
    })
    setAddForm({ name: '', note: '' })
    setAddingTo(null)
  }

  const renderProduct = (item, isMorning) => {
    const isChecked = (isMorning ? morningChecked : eveningChecked)[item.id]
    const isEditing = editingId === item.id

    if (isEditing) {
      return (
        <motion.div key={item.id} layout className="px-4 py-3 bg-surface-container-high/50">
          <input
            type="text"
            value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-primary/40 focus:outline-none focus:border-primary mb-2"
            autoFocus
            placeholder="Product name"
          />
          <input
            type="text"
            value={editForm.note}
            onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
            className="w-full bg-surface-container-high text-on-surface text-xs rounded-lg px-3 py-2 border border-outline-variant focus:outline-none focus:border-primary mb-2"
            placeholder="Note (optional)"
          />
          <div className="flex gap-2">
            <button
              onClick={() => saveEdit(isMorning)}
              className="flex-1 bg-primary text-background text-xs font-medium py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="flex-1 bg-surface-container-high text-on-surface-variant text-xs font-medium py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )
    }

    return (
      <motion.div key={item.id} layout className="flex items-center gap-3 px-4 py-3.5 group">
        <button
          onClick={() => toggleCheck(item.id, isMorning)}
          className={`checkbox-gold ${isChecked ? 'checked' : ''}`}
        >
          {isChecked && <span className="material-symbols-outlined check-icon">check</span>}
        </button>

        <div className="flex-1 min-w-0">
          <span className={`text-sm block ${isChecked ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
            {item.name}
          </span>
          {item.note && (
            <p className="text-[11px] text-on-surface-variant mt-0.5">{item.note}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {item.required && (
            <span className="text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full font-medium uppercase">
              Required
            </span>
          )}
          <button
            onClick={() => startEdit(item)}
            className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-primary transition-all p-0.5"
            aria-label={`Edit ${item.name}`}
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
          </button>
          <button
            onClick={() => deleteProduct(item.id, isMorning)}
            className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-all p-0.5"
            aria-label={`Delete ${item.name}`}
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
          </button>
        </div>
      </motion.div>
    )
  }

  const renderAddForm = (isMorning) => {
    const target = isMorning ? 'morning' : 'evening'
    if (addingTo !== target) {
      return (
        <button
          onClick={() => {
            setAddingTo(target)
            setAddForm({ name: '', note: '' })
          }}
          className="flex items-center gap-2 px-4 py-3 text-primary text-sm font-medium w-full text-left hover:bg-primary/5 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px] border border-dashed border-primary rounded p-0.5">add</span>
          Add Product
        </button>
      )
    }

    return (
      <div className="px-4 py-3 space-y-2 bg-surface-container-high/30">
        <input
          type="text"
          value={addForm.name}
          onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full bg-surface-container-high text-on-surface text-sm rounded-lg px-3 py-2 border border-primary/40 focus:outline-none focus:border-primary"
          placeholder="Product name"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && addProduct(isMorning)}
        />
        <input
          type="text"
          value={addForm.note}
          onChange={(e) => setAddForm((f) => ({ ...f, note: e.target.value }))}
          className="w-full bg-surface-container-high text-on-surface text-xs rounded-lg px-3 py-2 border border-outline-variant focus:outline-none focus:border-primary"
          placeholder="Note (optional)"
          onKeyDown={(e) => e.key === 'Enter' && addProduct(isMorning)}
        />
        <div className="flex gap-2">
          <button
            onClick={() => addProduct(isMorning)}
            disabled={!addForm.name.trim()}
            className="flex-1 bg-primary text-background text-xs font-medium py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            Add
          </button>
          <button
            onClick={() => setAddingTo(null)}
            className="flex-1 bg-surface-container-high text-on-surface-variant text-xs font-medium py-2 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <motion.div {...pageTransition} className="px-[var(--spacing-container-margin)]">
      {/* Header */}
      <section className="pt-6 pb-4 flex items-start justify-between">
        <div>
          <h1 className="font-[var(--font-headline)] text-3xl font-semibold text-on-surface tracking-wide">
            Daily Regimen
          </h1>
          <p className="text-on-surface-variant text-sm mt-1 font-light">Stay consistent for glowing results.</p>
        </div>
        {/* Progress ring */}
        <div className="relative w-14 h-14">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="23" fill="none" stroke="#1E1E24" strokeWidth="3.5" />
            <motion.circle
              cx="28" cy="28" r="23" fill="none"
              stroke="#C9A84C"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 23}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 23 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 23 * (1 - percent / 100) }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{ filter: 'drop-shadow(0 0 6px rgba(201,168,76,0.3))' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-[var(--font-headline)] text-xs font-semibold text-on-surface">
              {doneCount}/{totalCount}
            </span>
          </div>
        </div>
      </section>

      {/* Morning Routine */}
      <section className="mb-[var(--spacing-section-gap)]">
        <div className="card-elegant overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-outline-variant/40">
            <div className="flex items-center gap-2">
              <span className="text-lg">☀️</span>
              <h2 className="font-[var(--font-headline)] text-base font-semibold text-on-surface">Morning Routine</h2>
            </div>
            <span className="text-xs text-on-surface-variant">
              {morning.filter((p) => morningChecked[p.id]).length}/{morning.length}
            </span>
          </div>
          <div className="divide-y divide-outline-variant/30">
            <AnimatePresence initial={false}>
              {morning.map((item) => renderProduct(item, true))}
            </AnimatePresence>
            {renderAddForm(true)}
          </div>
        </div>
      </section>

      {/* Evening Routine */}
      <section className="pb-8">
        <div className="card-elegant overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-outline-variant/40">
            <div className="flex items-center gap-2">
              <span className="text-lg">🌙</span>
              <h2 className="font-[var(--font-headline)] text-base font-semibold text-on-surface">Evening Routine</h2>
            </div>
            <span className="text-xs text-on-surface-variant">
              {evening.filter((p) => eveningChecked[p.id]).length}/{evening.length}
            </span>
          </div>
          <div className="divide-y divide-outline-variant/30">
            <AnimatePresence initial={false}>
              {evening.map((item) => renderProduct(item, false))}
            </AnimatePresence>
            {renderAddForm(false)}
          </div>
        </div>
      </section>
    </motion.div>
  )
}
