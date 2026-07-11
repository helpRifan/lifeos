import { motion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { exportAllData, clearAllData, seedDefaults } from '../db'

const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.3, ease: 'easeOut' },
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [exporting, setExporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportAllData()
    } catch (err) {
      console.error('Export failed:', err)
    }
    setExporting(false)
  }

  const handleClear = async () => {
    setClearing(true)
    try {
      await clearAllData()
      localStorage.clear()
      localStorage.setItem('hasSeeded', 'true')
      await seedDefaults()
    } catch (err) {
      console.error('Clear failed:', err)
    }
    setClearing(false)
    setShowClearConfirm(false)
  }

  return (
    <motion.div {...pageTransition} className="px-[var(--spacing-container-margin)] min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <section className="pt-4 pb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors btn-press"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <h1 className="font-[var(--font-headline)] text-xl font-semibold text-on-surface tracking-wide">
          Settings
        </h1>
      </section>

      {/* Data Management */}
      <section className="mb-[var(--spacing-section-gap)]">
        <h2 className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest mb-3">
          Data Management
        </h2>

        {/* Export */}
        <div className="card-elegant p-4 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-[20px]">download</span>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-normal text-on-surface">Export All Data</h3>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Download all your data as a ZIP file with individual JSON files for each module.
              </p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full bg-primary text-background font-medium text-sm py-3 rounded-lg hover:bg-primary/90 btn-press disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {exporting ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                Exporting...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">archive</span>
                Export All Data
              </>
            )}
          </button>
        </div>

        {/* Clear Data */}
        <div className="card-elegant p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-error text-[20px]">delete_forever</span>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-normal text-on-surface">Clear All Data</h3>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Permanently delete all data and reset to defaults. This cannot be undone.
              </p>
            </div>
          </div>

          {!showClearConfirm ? (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="w-full bg-surface-container-high text-error font-medium text-sm py-3 rounded-lg hover:bg-error/10 btn-press flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">warning</span>
              Clear All Data
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-error text-center font-medium">Are you sure? This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleClear}
                  disabled={clearing}
                  className="flex-1 bg-error text-white font-medium text-sm py-2.5 rounded-lg hover:bg-error/90 btn-press disabled:opacity-50"
                >
                  {clearing ? 'Clearing...' : 'Yes, Clear'}
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 bg-surface-container-high text-on-surface-variant font-medium text-sm py-2.5 rounded-lg btn-press"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Navigation */}
      <section className="mb-[var(--spacing-section-gap)]">
        <h2 className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest mb-3">
          App
        </h2>

        <button
          onClick={() => navigate('/history')}
          className="w-full card-elegant p-4 flex items-center gap-3 btn-press text-left mb-3"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[20px]">history</span>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-normal text-on-surface">Log History</h3>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Browse your daily activity logs</p>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">chevron_right</span>
        </button>
      </section>

      {/* About */}
      <section className="pb-8">
        <h2 className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest mb-3">
          About
        </h2>
        <div className="card-elegant p-5 text-center">
          <img src="/pfp.jpg" alt="Profile" className="w-12 h-12 rounded-full mx-auto mb-3 object-cover border border-primary/30" />
          <h3 className="font-[var(--font-headline)] text-lg font-semibold text-on-surface">Life OS</h3>
          <p className="text-xs text-on-surface-variant mt-1 font-light">Version 1.0.0</p>
          <p className="text-xs text-on-surface-variant mt-3 font-light leading-relaxed">
            Your quiet personal assistant for college, gym, skincare, and skill tracking.
            Built with React, Dexie.js, and Framer Motion.
          </p>
        </div>
      </section>
    </motion.div>
  )
}
