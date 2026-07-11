import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useUniCC } from '../hooks/useUniCC'
import slotMapData from '../slotMap.json'
import { syncAllNotifications } from '../lib/notifications'

// ─── Config ──────────────────────────────────────────────────────────

const SEMESTER_IDS = [
  { id: 'CH20242501', label: 'WINTERSEM 24-25' },
  { id: 'CH20242505', label: 'SUMMERSEM 24-25' },
  { id: 'CH20252601', label: 'FALLSEM 25-26' },
  { id: 'CH20252605', label: 'WINTERSEM 25-26' },
  { id: 'CH20252607', label: 'TRI-1 25-26' },
  { id: 'CH20262701', label: 'FALLSEM 26-27' },
]

const TABS = [
  { key: 'attendance', label: 'Attendance', icon: 'fact_check' },
  { key: 'exams', label: 'Exams', icon: 'quiz' },
]

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const EXAM_SUB_TABS = ['Marks', 'Schedule', 'Grades']

function getAttColor(pct) {
  if (pct >= 85) return '#4CAF82'
  if (pct >= 75) return '#C9A84C'
  return '#E05C5C'
}

// ─── Helpers ─────────────────────────────────────────────────────────

function parseTime(str) {
  let [h, m] = str.trim().split(':').map(Number)
  if (h < 8) h += 12
  return h * 60 + (m || 0)
}

const formatNumber = (num) => {
  const n = Number(num)
  if (num == null || isNaN(n)) return '-'
  return Number(n.toFixed(2)).toString()
}

function parseExamDate(dateStr) {
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

// ─── Progress Ring (inline SVG) ──────────────────────────────────────

function ProgressRing({ percent, size = 56, strokeWidth = 4, color = '#C9A84C' }) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(percent || 0, 100) / 100)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1E1E24" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-semibold text-on-surface">{Math.round(percent || 0)}%</span>
      </div>
    </div>
  )
}

// ─── Loading Overlay ─────────────────────────────────────────────────

function LoadingOverlay({ message, progress }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-surface-container rounded-2xl p-6 w-[90%] max-w-sm border border-outline-variant text-center"
      >
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-primary text-[24px] animate-spin">progress_activity</span>
        </div>
        <h3 className="font-[var(--font-headline)] text-base font-semibold text-on-surface mb-3">Syncing with VTOP</h3>
        <div className="w-full h-1.5 bg-outline-variant/30 rounded-full overflow-hidden mb-3">
          <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
        </div>
        <div className="text-xs text-on-surface-variant whitespace-pre-wrap text-left font-light max-h-32 overflow-y-auto">{message}</div>
      </motion.div>
    </motion.div>
  )
}

// ─── Login Card ──────────────────────────────────────────────────────

function LoginCard({ onLogin, loading, error }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (username.trim() && password) onLogin(username.trim(), password)
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="card-elegant p-6 mx-auto max-w-sm">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-primary text-[28px]">school</span>
        </div>
        <h2 className="font-[var(--font-headline)] text-xl font-semibold text-on-surface">Connect VTOP</h2>
        <p className="text-xs text-on-surface-variant mt-1 font-light">Sign in with your VIT credentials.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="text" placeholder="Registration Number" value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-surface-container-high text-on-surface text-sm rounded-xl px-4 py-3 border border-outline-variant focus:outline-none focus:border-primary/50 transition-colors" />
        <input type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-surface-container-high text-on-surface text-sm rounded-xl px-4 py-3 border border-outline-variant focus:outline-none focus:border-primary/50 transition-colors" />
        {error && (
          <div className="flex items-center gap-2 text-error text-xs bg-error/10 px-3 py-2 rounded-lg">
            <span className="material-symbols-outlined text-[16px]">error</span>{error}
          </div>
        )}
        <button type="submit" disabled={loading || !username.trim() || !password}
          className="w-full bg-primary text-background font-medium text-sm py-3 rounded-xl hover:bg-primary/90 btn-press disabled:opacity-40 flex items-center justify-center gap-2">
          {loading ? (
            <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Connecting...</>
          ) : (
            <><span className="material-symbols-outlined text-[18px]">link</span>Connect VTOP</>
          )}
        </button>
      </form>
    </motion.div>
  )
}

// ─── Settings Sheet ──────────────────────────────────────────────────

function SettingsSheet({ isOpen, onClose, auth, onLogout, onUpdateCreds, semesterId, onChangeSemester, onReload }) {
  const [editMode, setEditMode] = useState(false)
  const [newUser, setNewUser] = useState(auth?.username || '')
  const [newPass, setNewPass] = useState(auth?.password || '')
  const [showPass, setShowPass] = useState(false)

  if (!isOpen) return null

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[70] bg-surface-container rounded-t-3xl p-6 pb-10 border-t border-outline-variant max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-[var(--font-headline)] text-lg font-semibold text-on-surface">Settings</h3>
          <button onClick={onClose} className="text-on-surface-variant"><span className="material-symbols-outlined text-[20px]">close</span></button>
        </div>

        {/* Semester selector */}
        <div className="mb-4">
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-medium mb-2">Select Semester</p>
          <div className="flex gap-2 items-center">
            <select value={semesterId} onChange={(e) => onChangeSemester(e.target.value)}
              className="flex-1 bg-surface-container-high text-on-surface text-sm rounded-xl px-3 py-2.5 border border-outline-variant focus:outline-none focus:border-primary/50 appearance-none">
              {SEMESTER_IDS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button onClick={() => { onChangeSemester(semesterId); onReload(); }}
              className="bg-primary text-background text-xs font-medium px-4 py-2.5 rounded-xl flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">save</span>Save
            </button>
          </div>
        </div>

        <div className="w-full h-px bg-outline-variant/30 my-4" />

        {/* Credentials */}
        <div className="mb-4">
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-medium mb-2">Change VTOP Credentials</p>
          <div className="space-y-2.5">
            <input type="text" placeholder="Registration Number" value={newUser}
              onChange={(e) => { setNewUser(e.target.value); setEditMode(true) }}
              className="w-full bg-surface-container-high text-on-surface text-sm rounded-xl px-4 py-3 border border-outline-variant focus:outline-none focus:border-primary/50" />
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} placeholder="Password" value={newPass}
                onChange={(e) => { setNewPass(e.target.value); setEditMode(true) }}
                className="w-full bg-surface-container-high text-on-surface text-sm rounded-xl px-4 py-3 border border-outline-variant focus:outline-none focus:border-primary/50 pr-10" />
              <button onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]">{showPass ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
            {editMode && (
              <button onClick={() => { onUpdateCreds(newUser, newPass); setEditMode(false) }}
                className="bg-primary text-background text-xs font-medium px-4 py-2 rounded-xl flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">save</span>Save
              </button>
            )}
          </div>
        </div>

        <div className="w-full h-px bg-outline-variant/30 my-4" />

        <button onClick={onLogout}
          className="w-full bg-error/10 text-error font-medium text-sm py-3 rounded-xl btn-press flex items-center justify-center gap-2 border border-error/20">
          <span className="material-symbols-outlined text-[18px]">logout</span>Log Out
        </button>
      </motion.div>
    </>
  )
}

// ─── OD Hours Modal ──────────────────────────────────────────────────

function ODHoursModal({ odHoursData, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-surface-container rounded-2xl shadow-2xl p-5 w-[92%] max-w-md relative max-h-[90vh] overflow-hidden flex flex-col border border-outline-variant"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <h3 className="font-[var(--font-headline)] text-lg font-semibold text-on-surface mb-4">OD Hours Info</h3>

        <div className="flex-1 overflow-y-auto pr-1">
          {odHoursData && odHoursData.length > 0 ? (
            <div className="space-y-4">
              {odHoursData.map((day, idx) => (
                <div key={idx}>
                  <p className="font-semibold text-on-surface">
                    {day.date}
                    <span className="text-sm text-on-surface-variant font-normal ml-2">({day.total} Hours)</span>
                  </p>
                  <ul className="list-disc list-inside text-on-surface-variant text-sm mt-1 space-y-0.5">
                    {day.courses.map((c, i) => (
                      <li key={i}>{c.title} ({c.type})</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-on-surface-variant text-sm font-light">No OD hours recorded.</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Grade Distribution Modal ────────────────────────────────────────

function GradeDistributionModal({ gradesData, marksData, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const gradesCounts = gradesData?.cgpa?.grades || {}
  const effectiveGrades = (gradesData?.effectiveGrades || []).filter(
    eg => !isNaN(parseFloat(eg.creditsEarned))
  )

  // Group by distribution type
  const grouped = effectiveGrades.reduce((acc, g) => {
    const cat = g.distributionType || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(g)
    return acc
  }, {})

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-surface-container rounded-2xl shadow-2xl p-5 w-[92%] max-w-md relative max-h-[90vh] overflow-hidden flex flex-col border border-outline-variant"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <h3 className="font-[var(--font-headline)] text-lg font-semibold text-on-surface mb-4">Grade Distribution</h3>

        {/* Grade count grid */}
        {Object.keys(gradesCounts).length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-5">
            {Object.entries(gradesCounts).map(([grade, count]) => (
              <div key={grade} className="bg-surface-container-high rounded-xl p-3 text-center border border-outline-variant/30">
                <p className="text-sm font-bold text-on-surface">{grade}</p>
                <p className="text-on-surface-variant text-xs font-medium">{count}</p>
              </div>
            ))}
          </div>
        )}

        <div className="w-full h-px bg-outline-variant/30 mb-4" />

        {/* Effective grades list */}
        <div className="flex-1 overflow-y-auto pr-1">
          {Object.keys(grouped).length > 0 ? (
            <div className="space-y-4">
              <h4 className="font-semibold text-on-surface text-sm">Grades</h4>
              {Object.entries(grouped).map(([cat, courses]) => (
                <div key={cat}>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-medium mb-1.5">{cat}</p>
                  <div className="space-y-1">
                    {courses.sort((a, b) => (a.basketTitle || '').localeCompare(b.basketTitle || '')).map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-outline-variant/20">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-on-surface truncate">{c.basketTitle}</p>
                          <p className="text-[10px] text-on-surface-variant">{c.distributionType}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-sm font-bold text-on-surface">{c.grade || '—'}</span>
                          <span className="text-xs text-on-surface-variant">
                            {Number.isFinite(Number(c.creditsEarned)) ? `${Number(c.creditsEarned).toFixed(1)} cr` : '—'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-on-surface-variant text-sm font-light">No grade data available.</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Stat Cards ──────────────────────────────────────────────────────

function StatCards({ attPct, odHours, odHoursData, cgpa, creditsEarned, feedback, gradesData, marksData }) {
  const [odModalOpen, setOdModalOpen] = useState(false)
  const [gradeModalOpen, setGradeModalOpen] = useState(false)
  const [cgpaHidden, setCgpaHidden] = useState(false)

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory -mx-1 px-1" data-scrollable>
        {/* Attendance */}
        <div className="card-elegant p-4 min-w-[45%] snap-start shrink-0 flex flex-col items-center justify-center text-center">
          <p className="text-[11px] text-on-surface-variant font-medium uppercase tracking-widest mb-1">Attendance</p>
          <p className="font-[var(--font-headline)] text-2xl font-semibold text-on-surface">{attPct || '0'}%</p>
        </div>

        {/* OD Hours — tappable */}
        <div className="card-elegant p-4 min-w-[45%] snap-start shrink-0 flex flex-col items-center justify-center text-center cursor-pointer active:scale-[0.97] transition-transform"
          onClick={() => setOdModalOpen(true)}>
          <p className="text-[11px] text-on-surface-variant font-medium uppercase tracking-widest mb-1">OD Hours</p>
          <p className="font-[var(--font-headline)] text-2xl font-semibold text-on-surface">{odHours}/40</p>
        </div>

        {/* Feedback */}
        {feedback && (
          <div className="card-elegant p-4 min-w-[45%] snap-start shrink-0 flex flex-col items-center justify-center text-center">
            <p className="text-[11px] text-on-surface-variant font-medium uppercase tracking-widest mb-1">Feedback</p>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-on-surface-variant">Mid Sem</span>
                <span className={`text-xs font-bold ${feedback?.MidSem?.Curriculum && feedback?.MidSem?.Course ? 'text-[#4CAF82]' : 'text-error'}`}>
                  {feedback?.MidSem?.Curriculum && feedback?.MidSem?.Course ? 'Given' : 'Not Given'}
                </span>
              </div>
              <div className="w-px h-6 bg-outline-variant" />
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-on-surface-variant">End Sem</span>
                <span className={`text-xs font-bold ${feedback?.EndSem?.Curriculum && feedback?.EndSem?.Course ? 'text-[#4CAF82]' : 'text-error'}`}>
                  {feedback?.EndSem?.Curriculum && feedback?.EndSem?.Course ? 'Given' : 'Not Given'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* CGPA — tap to toggle hide */}
        {cgpa && (
          <div className="card-elegant p-4 min-w-[45%] snap-start shrink-0 flex flex-col items-center justify-center text-center cursor-pointer active:scale-[0.97] transition-transform select-none"
            onClick={() => setCgpaHidden(!cgpaHidden)}>
            <p className="text-[11px] text-on-surface-variant font-medium uppercase tracking-widest mb-1">CGPA</p>
            <p className="font-[var(--font-headline)] text-2xl font-semibold text-on-surface">{cgpaHidden ? '###' : cgpa}</p>
          </div>
        )}

        {/* Credits Earned — tappable, opens grade distribution */}
        {creditsEarned != null && (
          <div className="card-elegant p-4 min-w-[45%] snap-start shrink-0 flex flex-col items-center justify-center text-center cursor-pointer active:scale-[0.97] transition-transform"
            onClick={() => setGradeModalOpen(true)}>
            <p className="text-[11px] text-on-surface-variant font-medium uppercase tracking-widest mb-1">Credits Earned</p>
            <p className="font-[var(--font-headline)] text-2xl font-semibold text-on-surface">{creditsEarned}</p>
          </div>
        )}
      </div>

      {/* OD Hours Modal */}
      <AnimatePresence>
        {odModalOpen && <ODHoursModal odHoursData={odHoursData} onClose={() => setOdModalOpen(false)} />}
      </AnimatePresence>

      {/* Grade Distribution Modal */}
      <AnimatePresence>
        {gradeModalOpen && <GradeDistributionModal gradesData={gradesData} marksData={marksData} onClose={() => setGradeModalOpen(false)} />}
      </AnimatePresence>
    </>
  )
}

// ─── Attendance Popup (like UniCC PopupCard) ─────────────────────────

function AttendancePopup({ course, onClose }) {
  const pct = course.totalClasses > 0 ? Math.round((course.attendedClasses / course.totalClasses) * 100) : 0
  const color = getAttColor(pct)
  const lab = (course._slot || course.slotName || '').startsWith('L')
  const attended = course.attendedClasses || 0
  const total = course.totalClasses || 0

  let missText = ''
  let missColor = ''
  if (total > 0) {
    if (pct >= 75) {
      const canMiss = Math.floor(attended / 0.75 - total)
      const val = lab ? Math.floor(canMiss / 2) : canMiss
      if (val > 0) {
        missText = `Can miss ${val} ${lab ? 'lab' : 'class'}${val > 1 ? (lab ? 's' : 'es') : ''} and stay above 75%.`
        missColor = 'text-[#4CAF82]'
      } else {
        missText = `You are on the edge! Attend the next ${lab ? 'lab' : 'class'}.`
        missColor = 'text-primary'
      }
    } else {
      const needed = Math.ceil((0.75 * total - attended) / (1 - 0.75))
      const val = lab ? Math.ceil(needed / 2) : needed
      missText = `Need to attend ${val} more ${lab ? 'lab' : 'class'}${val > 1 ? (lab ? 's' : 'es') : ''} to reach 75%.`
      missColor = 'text-error'
    }
  }

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-surface-container rounded-2xl shadow-2xl p-5 w-[92%] max-w-md relative max-h-[90vh] overflow-hidden flex flex-col border border-outline-variant"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button onClick={onClose} className="absolute top-3 right-3 text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Header with progress ring */}
        <div className="flex justify-between items-start gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-on-surface pr-8">{course.courseTitle}</h3>
            <p className="text-sm text-on-surface-variant mt-0.5">{course._slot || course.slotName}</p>

            <div className="mt-3 space-y-1.5 text-sm text-on-surface-variant">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">apartment</span>
                <span>{course.slotVenue || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">schedule</span>
                <span>{course._time || '-'}</span>
              </div>
              <p><strong className="text-on-surface">Faculty:</strong> {course.faculty}</p>
              <p><strong className="text-on-surface">Course Code:</strong> {(course.courseCode || '').replace(/\(.\)$/, '')}</p>
              <p><strong className="text-on-surface">Credits:</strong> {course.credits || '-'}</p>
              <p>
                <strong className="text-on-surface">Classes Attended:</strong>{' '}
                <span className="font-semibold text-on-surface">{attended}/{total}</span>
              </p>
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-center mt-1">
            <ProgressRing percent={pct} size={72} strokeWidth={4} color={color} />
            <p className="text-[10px] font-medium text-on-surface-variant mt-1">Attendance</p>
          </div>
        </div>

        {/* Can miss / need attend */}
        {missText && <p className={`text-sm mb-3 ${missColor}`}>{missText}</p>}

        {/* Attendance history */}
        <div className="flex-1 overflow-y-auto pr-1 mt-1 border-t border-outline-variant/30 pt-3">
          <ul className="list-disc list-inside text-xs space-y-1">
            {(course.viewLink || []).map((d, i) => (
              <li key={i} className={
                d.status?.toLowerCase() === 'absent' ? 'text-error' :
                d.status?.toLowerCase() === 'present' ? 'text-[#4CAF82]' :
                d.status?.toLowerCase() === 'on duty' ? 'text-primary' :
                'text-on-surface-variant'
              }>
                {d.date} – {d.status}
              </li>
            ))}
            {(!course.viewLink || course.viewLink.length === 0) && (
              <p className="text-on-surface-variant text-xs">No attendance history available.</p>
            )}
          </ul>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Marks Modal (like UniCC MakrsModal) ─────────────────────────────

function MarksModal({ course, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const assessments = course.assessments || []
  const totals = assessments.reduce((acc, a) => {
    acc.max += Number(a.maxMark) || 0
    acc.scored += Number(a.scoredMark) || 0
    acc.weightPct += Number(a.weightagePercent) || 0
    acc.weighted += Number(a.weightageMark) || 0
    return acc
  }, { max: 0, scored: 0, weightPct: 0, weighted: 0 })

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-surface-container rounded-2xl shadow-2xl p-5 w-[95%] max-w-lg relative max-h-[90vh] overflow-y-auto border border-outline-variant"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <h3 className="text-base font-semibold text-on-surface mb-3 pr-8">
          {course.courseCode} – {course.courseTitle}
        </h3>

        <div className="text-sm text-on-surface-variant space-y-1 mb-4">
          <p><strong className="text-on-surface">Course Total:</strong> {formatNumber(totals.weighted)}/{formatNumber(totals.weightPct)}</p>
          <p><strong className="text-on-surface">Faculty:</strong> {course.faculty}</p>
          <p><strong className="text-on-surface">Slot:</strong> {course.slot}</p>
        </div>

        {/* Assessment table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-primary/10 text-on-surface">
                <th className="border border-outline-variant/40 p-2 text-left font-semibold">Test</th>
                <th className="border border-outline-variant/40 p-2 text-center font-semibold">Max</th>
                <th className="border border-outline-variant/40 p-2 text-center font-semibold">Scored</th>
                <th className="border border-outline-variant/40 p-2 text-center font-semibold">Weight %</th>
                <th className="border border-outline-variant/40 p-2 text-center font-semibold">Weighted</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a, i) => (
                <tr key={i} className="border-b border-outline-variant/20">
                  <td className="border border-outline-variant/20 p-2 text-on-surface">{a.title}</td>
                  <td className="border border-outline-variant/20 p-2 text-center text-on-surface-variant">{formatNumber(a.maxMark)}</td>
                  <td className="border border-outline-variant/20 p-2 text-center text-on-surface">{a.status === 'Present' ? formatNumber(a.scoredMark) : '-'}</td>
                  <td className="border border-outline-variant/20 p-2 text-center text-on-surface-variant">{formatNumber(a.weightagePercent)}</td>
                  <td className="border border-outline-variant/20 p-2 text-center text-primary font-medium">{a.status === 'Present' ? formatNumber(a.weightageMark) : '-'}</td>
                </tr>
              ))}
              {/* Total row */}
              <tr className="font-bold bg-primary/5">
                <td className="border border-outline-variant/20 p-2 text-on-surface">Total</td>
                <td className="border border-outline-variant/20 p-2 text-center text-on-surface-variant">{formatNumber(totals.max)}</td>
                <td className="border border-outline-variant/20 p-2 text-center text-on-surface">{formatNumber(totals.scored)}</td>
                <td className="border border-outline-variant/20 p-2 text-center text-on-surface-variant">{formatNumber(totals.weightPct)}</td>
                <td className="border border-outline-variant/20 p-2 text-center text-primary">{formatNumber(totals.weighted)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Grade Detail Modal ──────────────────────────────────────────────

function GradeDetailModal({ course, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const details = course.details || []

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-surface-container rounded-2xl shadow-2xl p-5 w-[95%] max-w-lg relative max-h-[90vh] overflow-y-auto border border-outline-variant"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <h3 className="text-base font-semibold text-on-surface mb-1 pr-8">
          {course.courseCode} – {course.courseTitle}
        </h3>
        <div className="text-sm text-on-surface-variant space-y-0.5 mb-4">
          <p><strong className="text-on-surface">Course Type:</strong> {course.courseType}</p>
          <p><strong className="text-on-surface">Grade:</strong> <span className="text-primary font-semibold">{course.grade}</span></p>
          <p><strong className="text-on-surface">Grand Total:</strong> {course.grandTotal}</p>
        </div>

        {/* Grade range table */}
        {course.range && (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-primary/10 text-on-surface">
                  {Object.keys(course.range).map(g => (
                    <th key={g} className="border border-outline-variant/40 p-2 text-center font-semibold">{g}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {Object.values(course.range).map((r, i) => (
                    <td key={i} className="border border-outline-variant/20 p-2 text-center text-on-surface-variant text-[10px]">{r}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Component breakdown */}
        {details.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-primary/10 text-on-surface">
                  <th className="border border-outline-variant/40 p-2 text-left font-semibold">Component</th>
                  <th className="border border-outline-variant/40 p-2 text-center font-semibold">Max</th>
                  <th className="border border-outline-variant/40 p-2 text-center font-semibold">Scored</th>
                  <th className="border border-outline-variant/40 p-2 text-center font-semibold">Weightage</th>
                </tr>
              </thead>
              <tbody>
                {details.map((d, i) => (
                  <tr key={i} className="border-b border-outline-variant/20">
                    <td className="border border-outline-variant/20 p-2 text-on-surface">{d.component}</td>
                    <td className="border border-outline-variant/20 p-2 text-center text-on-surface-variant">{formatNumber(d.maxMark)}</td>
                    <td className="border border-outline-variant/20 p-2 text-center text-on-surface">{formatNumber(d.scoredMark)}</td>
                    <td className="border border-outline-variant/20 p-2 text-center text-primary font-medium">{formatNumber(d.weightageMark)}</td>
                  </tr>
                ))}
                <tr className="font-bold bg-primary/5">
                  <td className="border border-outline-variant/20 p-2 text-on-surface">Total</td>
                  <td className="border border-outline-variant/20 p-2 text-center text-on-surface-variant">{formatNumber(details.reduce((s,d) => s+(Number(d.maxMark)||0), 0))}</td>
                  <td className="border border-outline-variant/20 p-2 text-center text-on-surface">{formatNumber(details.reduce((s,d) => s+(Number(d.scoredMark)||0), 0))}</td>
                  <td className="border border-outline-variant/20 p-2 text-center text-primary">{formatNumber(details.reduce((s,d) => s+(Number(d.weightageMark)||0), 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant font-light">No breakdown data available.</p>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Attendance Tab ──────────────────────────────────────────────────

function AttendanceTab({ attendance }) {
  const todayIdx = Math.min(Math.max(new Date().getDay() - 1, 0), 5)
  const [selectedDay, setSelectedDay] = useState(todayIdx)
  const [expandedCourse, setExpandedCourse] = useState(null)

  const dayKey = DAYS[selectedDay]
  const daySlots = slotMapData[dayKey] || {}

  const dayClasses = useMemo(() => {
    const classes = []
    attendance.forEach((course) => {
      const slots = (course.slotName || '').split('+').map((s) => s.trim())
      slots.forEach((slot) => {
        if (daySlots[slot]) {
          classes.push({
            ...course,
            _slot: slot,
            _time: daySlots[slot].time,
            _startMin: parseTime(daySlots[slot].time.split('-')[0]),
          })
        }
      })
    })

    classes.sort((a, b) => a._startMin - b._startMin)

    // Merge consecutive same-course slots
    const merged = []
    for (let i = 0; i < classes.length; i++) {
      const curr = classes[i]
      const next = classes[i + 1]
      if (next && curr.courseTitle === next.courseTitle && curr.courseType === next.courseType) {
        const currEnd = parseTime(curr._time.split('-')[1])
        if (next._startMin - currEnd <= 10) {
          merged.push({
            ...curr,
            _slot: `${curr._slot}+${next._slot}`,
            _time: `${curr._time.split('-')[0]}-${next._time.split('-')[1]}`,
          })
          i++
          continue
        }
      }
      merged.push(curr)
    }
    return merged
  }, [attendance, selectedDay])

  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const isToday = now.getDay() > 0 && now.getDay() <= 6 && DAYS[now.getDay() - 1] === dayKey

  return (
    <div className="space-y-4">
      {/* Day filter */}
      <div className="flex gap-1.5">
        {DAYS.map((day, i) => (
          <button key={day} onClick={() => setSelectedDay(i)}
            className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-all ${
              selectedDay === i ? 'border border-primary text-primary bg-primary/5' : 'border border-outline-variant text-on-surface-variant bg-transparent'
            }`}>{day}</button>
        ))}
      </div>

      <h3 className="text-[10px] text-on-surface-variant uppercase tracking-widest font-medium">
        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][selectedDay]} — {dayClasses.length} classes
      </h3>

      {/* Course cards */}
      <div className="space-y-2.5">
        {dayClasses.map((a, i) => {
          const pct = a.totalClasses > 0 ? Math.round((a.attendedClasses / a.totalClasses) * 100) : 0
          const color = getAttColor(pct)
          const lab = a._slot.startsWith('L')
          const attended = a.attendedClasses || 0
          const total = a.totalClasses || 0

          let missText = ''
          let missColor = ''
          if (total > 0) {
            if (pct >= 75) {
              const canMiss = Math.floor(attended / 0.75 - total)
              const val = lab ? Math.floor(canMiss / 2) : canMiss
              if (val > 0) {
                missText = `Can miss ${val} ${lab ? 'lab' : 'class'}${val > 1 ? (lab ? 's' : 'es') : ''}`
                missColor = 'text-[#4CAF82] bg-[#4CAF82]/10'
              } else {
                missText = 'On the edge!'
                missColor = 'text-primary bg-primary/10'
              }
            } else {
              const needed = Math.ceil((0.75 * total - attended) / (1 - 0.75))
              const val = lab ? Math.ceil(needed / 2) : needed
              missText = `Need ${val} more to reach 75%`
              missColor = 'text-error bg-error/10'
            }
          }

          const isOngoing = isToday && (() => {
            const [s, e] = a._time.split('-').map((t) => parseTime(t))
            return nowMin >= s && nowMin <= e
          })()

          return (
            <motion.div key={i}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`card-elegant p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform ${isOngoing ? 'ring-1 ring-primary/50 bg-primary/5' : ''}`}
              onClick={() => setExpandedCourse(a)}
            >
              <ProgressRing percent={pct} size={56} strokeWidth={3.5} color={color} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-on-surface font-normal truncate">{a.courseTitle}</p>
                  {isOngoing && <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />}
                </div>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  {a._slot} · {a._time} · {a.slotVenue || ''}
                </p>
                <p className="text-[10px] text-on-surface-variant truncate">{a.faculty}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-on-surface-variant">{attended}/{total} attended</span>
                  {missText && <span className={`text-[10px] ${missColor} px-1.5 py-0.5 rounded-full`}>{missText}</span>}
                </div>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant text-[16px] shrink-0">chevron_right</span>
            </motion.div>
          )
        })}
        {dayClasses.length === 0 && (
          <div className="text-center py-8 text-on-surface-variant text-sm font-light">No classes on this day.</div>
        )}
      </div>

      {/* Attendance detail popup */}
      <AnimatePresence>
        {expandedCourse && <AttendancePopup course={expandedCourse} onClose={() => setExpandedCourse(null)} />}
      </AnimatePresence>
    </div>
  )
}

// ─── Exams Tab ───────────────────────────────────────────────────────

function ExamsTab({ marksData, scheduleData, gradesData, allGradesData }) {
  const [subTab, setSubTab] = useState(0)
  const [openMarksCourse, setOpenMarksCourse] = useState(null)
  const [openGradeCourse, setOpenGradeCourse] = useState(null)

  const courses = marksData?.courses || []
  const cgpaInfo = marksData?.cgpa || {}

  // Schedule: data.Schedule is { FAT: [...], CAT2: [...], CAT1: [...] }
  const examSchedule = scheduleData?.Schedule || {}

  // All Grades: data.grades is { CH20242501: { gpa, grades: [...] }, ... }
  const allGrades = allGradesData?.grades || {}
  const semesterKeys = Object.keys(allGrades).filter(k => allGrades[k])
  const [activeSem, setActiveSem] = useState(semesterKeys[semesterKeys.length - 1] || '')

  const semesterData = allGrades[activeSem]
  const gpa = semesterData?.gpa || null
  const gradeList = semesterData?.grades || []

  // Today for exam schedule highlighting
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex bg-surface-container-high rounded-xl p-1 gap-1">
        {EXAM_SUB_TABS.map((tab, i) => (
          <button key={tab} onClick={() => setSubTab(i)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              subTab === i ? 'bg-primary text-background' : 'text-on-surface-variant hover:text-on-surface'
            }`}>{tab}</button>
        ))}
      </div>

      {/* ─── MARKS SUB-TAB ─── */}
      {subTab === 0 && (
        <div className="space-y-2.5">
          {courses.length > 0 ? courses.map((course, i) => {
            const totals = (course.assessments || []).reduce((acc, a) => {
              acc.weighted += Number(a.weightageMark) || 0
              acc.weightPct += Number(a.weightagePercent) || 0
              return acc
            }, { weighted: 0, weightPct: 0 })

            const pctVal = totals.weightPct > 0 ? (totals.weighted / totals.weightPct) * 100 : 0

            return (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="card-elegant p-4 cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => setOpenMarksCourse(course)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-on-surface font-normal truncate">{course.courseCode} – {course.courseTitle}</p>
                    <span className="inline-block mt-1 text-[10px] text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full border border-outline-variant/30">
                      {course.courseType}
                    </span>
                  </div>
                  <div className="shrink-0 ml-3">
                    <ProgressRing percent={pctVal} size={52} strokeWidth={3.5} color="#C9A84C" />
                  </div>
                </div>
              </motion.div>
            )
          }) : (
            <div className="text-center py-8 text-on-surface-variant text-sm font-light">No marks data.</div>
          )}
        </div>
      )}

      {/* ─── SCHEDULE SUB-TAB (like UniCC) ─── */}
      {subTab === 1 && (
        <div className="space-y-5">
          {Object.keys(examSchedule).length > 0 ? Object.entries(examSchedule).map(([examType, subjects]) => {
            const sorted = [...(Array.isArray(subjects) ? subjects : [])].sort((a, b) => {
              const da = parseExamDate(a.examDate)
              const db = parseExamDate(b.examDate)
              if (!da && !db) return 0
              if (!da) return 1
              if (!db) return -1
              return da.getTime() - db.getTime()
            })

            return (
              <motion.div key={examType} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="card-elegant p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-[var(--font-headline)] text-lg font-semibold text-on-surface">{examType}</h4>
                  <span className="text-[10px] text-on-surface-variant">{sorted.length} exams</span>
                </div>

                <div className="space-y-2">
                  {sorted.map((subj, idx) => {
                    const examDate = parseExamDate(subj.examDate)
                    const isPast = examDate && examDate < today
                    const isExamToday = examDate && examDate.getTime() === today.getTime()

                    return (
                      <div key={idx} className={`rounded-xl p-3 border transition-colors ${
                        isPast ? 'opacity-40 border-outline-variant/20' :
                        isExamToday ? 'border-[#4CAF82]/40 bg-[#4CAF82]/5' :
                        'border-outline-variant/30 hover:bg-surface-container-high'
                      }`}>
                        {/* Course title row */}
                        <p className={`text-sm font-medium mb-2 ${isPast ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                          <span className="font-mono text-on-surface-variant mr-1.5">{subj.courseCode}</span>
                          {subj.courseTitle}
                        </p>

                        {/* Details grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[13px] text-on-surface-variant">calendar_today</span>
                            <span className="text-on-surface-variant">{subj.examDate || '-'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[13px] text-on-surface-variant">schedule</span>
                            <span className="text-on-surface-variant">{subj.examTime || '-'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[13px] text-on-surface-variant">login</span>
                            <span className="text-on-surface-variant">Report: {subj.reportingTime || '-'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[13px] text-on-surface-variant">wb_twilight</span>
                            <span className="text-on-surface-variant">{subj.examSession || '-'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[13px] text-on-surface-variant">location_on</span>
                            <span className="text-on-surface-variant">{subj.venue && subj.venue !== '-' ? subj.venue : 'TBA'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[13px] text-on-surface-variant">event_seat</span>
                            <span className="text-on-surface-variant">
                              {subj.seatLocation && subj.seatLocation !== '-' ? subj.seatLocation : ''}{subj.seatNo && subj.seatNo !== '-' ? ` #${subj.seatNo}` : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {sorted.length === 0 && (
                  <p className="text-center text-on-surface-variant text-xs py-3 font-light">No exams.</p>
                )}
              </motion.div>
            )
          }) : (
            <div className="text-center py-8 text-on-surface-variant text-sm font-light">No exam schedule.</div>
          )}
        </div>
      )}

      {/* ─── GRADES SUB-TAB (semester tabs + GPA, like UniCC) ─── */}
      {subTab === 2 && (
        <div className="space-y-4">
          {/* Semester tabs */}
          {semesterKeys.length > 0 ? (
            <>
              <div className="flex overflow-x-auto gap-1 snap-x snap-mandatory pb-1" data-scrollable>
                {semesterKeys.map((sem) => {
                  const label = sem.endsWith('1') ? 'FALLSEM' : 'WINTERSEM'
                  const years = `${sem.slice(4, 6)}-${sem.slice(6, 8)}`
                  return (
                    <button key={sem} onClick={() => { setActiveSem(sem); setOpenGradeCourse(null) }}
                      className={`shrink-0 snap-start px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        activeSem === sem ? 'bg-primary text-background' : 'bg-surface-container-high text-on-surface-variant border border-outline-variant'
                      }`}
                    >{label} {years}</button>
                  )
                })}
              </div>

              {/* GPA display */}
              {gpa && (
                <div className="text-center">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-medium">GPA</span>
                  <p className="font-[var(--font-headline)] text-3xl font-semibold text-primary">{gpa}</p>
                </div>
              )}

              {/* Grade cards */}
              <div className="space-y-2.5">
                {gradeList.map((course, i) => (
                  <motion.div key={course.courseId || i}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className="card-elegant p-4 cursor-pointer active:scale-[0.98] transition-transform"
                    onClick={() => setOpenGradeCourse(course)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-on-surface font-normal">{course.courseCode} – {course.courseTitle}</p>
                        <span className="inline-block mt-1 text-[10px] text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full border border-outline-variant/30">
                          {course.courseType}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
                          Grade: {course.grade}
                        </span>
                        <span className="px-3 py-1 rounded-full bg-[#4CAF82]/10 text-[#4CAF82] text-xs font-medium border border-[#4CAF82]/20">
                          Total: {course.grandTotal}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {gradeList.length === 0 && (
                  <div className="text-center py-8 text-on-surface-variant text-sm font-light">No grade data for this semester.</div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-on-surface-variant text-sm font-light">
              No grade data. Tap <span className="text-primary">↻</span> to sync.
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {openMarksCourse && <MarksModal course={openMarksCourse} onClose={() => setOpenMarksCourse(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {openGradeCourse && <GradeDetailModal course={openGradeCourse} onClose={() => setOpenGradeCourse(null)} />}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────

export default function CollegePage() {
  const { isLoggedIn, auth, login, logout, updateCredentials, loading: authLoading, error: authError } = useUniCC()
  const [activeTab, setActiveTab] = useState('attendance')
  const [showSettings, setShowSettings] = useState(false)

  // Data states
  const [attData, setAttData] = useState(null)
  const [marksData, setMarksData] = useState(null)
  const [gradesData, setGradesData] = useState(null)
  const [scheduleData, setScheduleData] = useState(null)
  const [allGradesData, setAllGradesData] = useState(null)

  // Loading overlay
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [syncProgress, setSyncProgress] = useState(0)

  const [semesterId, setSemesterId] = useState(auth?.semesterId || 'CH20252605')

  const API_BASE = 'https://api.uni-cc.site'

  // Full login + fetch flow
  const doLoginAndFetch = useCallback(async (username, password) => {
    setSyncing(true)
    setSyncProgress(10)
    setSyncMsg('Logging in...')

    try {
      const authObj = await login(username, password)
      setSyncMsg(prev => prev + '\n✅ Login successful')
      setSyncProgress(30)

      const body = {
        cookies: authObj.cookies,
        authorizedID: authObj.authorizedID,
        csrf: authObj.csrf,
        semesterId,
      }

      const [attRes, gradesRes, scheduleRes, allGradesRes] = await Promise.all([
        fetch(`${API_BASE}/api/attendance`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then(async (r) => {
          const j = await r.json()
          setSyncMsg(prev => prev + '\n✅ Attendance & Marks fetched')
          setSyncProgress(prev => prev + 20)
          return j
        }),

        fetch(`${API_BASE}/api/grades`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then(async (r) => {
          const j = await r.json()
          setSyncMsg(prev => prev + '\n✅ Grades fetched')
          setSyncProgress(prev => prev + 10)
          return j
        }),

        fetch(`${API_BASE}/api/schedule`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then(async (r) => {
          const j = await r.json()
          setSyncMsg(prev => prev + '\n✅ Exam schedule fetched')
          setSyncProgress(prev => prev + 10)
          return j
        }),

        fetch(`${API_BASE}/api/all-grades`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then(async (r) => {
          const j = await r.json()
          setSyncMsg(prev => prev + '\n✅ All grades fetched')
          setSyncProgress(prev => prev + 10)
          return j
        }),
      ])

      // The attendance endpoint returns { semester, attendance[] } directly
      // The marks come from a separate marksRes or are embedded
      setAttData(attRes.attRes || attRes)
      setMarksData(attRes.marksRes || attRes.marks || {})
      setGradesData(gradesRes)
      setScheduleData(scheduleRes)
      setAllGradesData(allGradesRes)

      // Cache
      localStorage.setItem('unicc_attendance', JSON.stringify(attRes))
      localStorage.setItem('unicc_grades', JSON.stringify(gradesRes))
      localStorage.setItem('unicc_schedule', JSON.stringify(scheduleRes))
      localStorage.setItem('unicc_allGrades', JSON.stringify(allGradesRes))

      setSyncMsg(prev => prev + '\n✅ All data loaded!')
      setSyncProgress(100)

      // Schedule alarms for class schedules and exams
      syncAllNotifications()

      setTimeout(() => setSyncing(false), 800)
    } catch (err) {
      setSyncMsg(prev => prev + '\n❌ ' + (err.message || 'Failed'))
      setSyncProgress(0)
      setTimeout(() => setSyncing(false), 2000)
    }
  }, [login, semesterId])

  // Reload
  const handleReload = useCallback(async () => {
    if (!auth?.username || !auth?.password) return
    await doLoginAndFetch(auth.username, auth.password)
  }, [auth, doLoginAndFetch])

  // Load cached data on mount
  useEffect(() => {
    if (!isLoggedIn) return
    try {
      const att = localStorage.getItem('unicc_attendance')
      const grades = localStorage.getItem('unicc_grades')
      const schedule = localStorage.getItem('unicc_schedule')
      const allGrades = localStorage.getItem('unicc_allGrades')

      if (att) {
        const parsed = JSON.parse(att)
        setAttData(parsed.attRes || parsed)
        setMarksData(parsed.marksRes || parsed.marks || {})
      }
      if (grades) setGradesData(JSON.parse(grades))
      if (schedule) setScheduleData(JSON.parse(schedule))
      if (allGrades) setAllGradesData(JSON.parse(allGrades))
    } catch { /* ignore */ }
  }, [isLoggedIn])

  const handleLogout = () => {
    logout()
    setAttData(null); setMarksData(null); setGradesData(null)
    setScheduleData(null); setAllGradesData(null)
    ;['unicc_attendance', 'unicc_grades', 'unicc_schedule', 'unicc_allGrades'].forEach((k) => localStorage.removeItem(k))
    setShowSettings(false)
  }

  // Derived stats
  const attendance = attData?.attendance || []
  const totalAttended = attendance.reduce((s, c) => s + (c.attendedClasses || 0), 0)
  const totalClasses = attendance.reduce((s, c) => s + (c.totalClasses || 0), 0)
  const overallPct = totalClasses > 0 ? (totalAttended / totalClasses * 100).toFixed(2) : '0'

  // OD Hours total + grouped data for modal (like UniCC Main.tsx)
  const { odHours, odHoursData } = useMemo(() => {
    const odList = {}
    let total = 0
    attendance.forEach((c) => {
      if (!Array.isArray(c.viewLink)) return
      c.viewLink.forEach((d) => {
        if (d.status === 'On Duty') {
          const hours = c.slotName.startsWith('L') ? 2 : 1
          total += hours
          if (!odList[d.date]) odList[d.date] = []
          odList[d.date].push({
            title: c.courseTitle,
            type: c.slotName.startsWith('L') ? 'LAB' : 'TH',
            hours,
          })
        }
      })
    })
    const formatted = Object.entries(odList)
      .map(([date, courses]) => ({
        date,
        courses,
        total: courses.reduce((sum, c) => sum + c.hours, 0),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    return { odHours: total, odHoursData: formatted }
  }, [attendance])

  const cgpa = marksData?.cgpa?.cgpa
  const creditsEarned = marksData?.cgpa ? Number(marksData.cgpa.creditsEarned || 0) + Number(marksData.cgpa.nonGradedRequirement || 0) : null
  const feedback = gradesData?.feedback

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="px-[var(--spacing-container-margin)]"
    >
      {/* Header */}
      <section className="pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="font-[var(--font-headline)] text-3xl font-semibold text-on-surface tracking-wide">College</h1>
          <p className="text-on-surface-variant text-sm mt-1 font-light">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {isLoggedIn && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(true)}
              className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors btn-press">
              <span className="material-symbols-outlined text-[18px]">settings</span>
            </button>
            <button onClick={handleReload}
              className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors btn-press">
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>
          </div>
        )}
      </section>

      {!isLoggedIn ? (
        <div className="pt-8">
          <LoginCard onLogin={(u, p) => doLoginAndFetch(u, p)} loading={authLoading} error={authError} />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <StatCards attPct={overallPct} odHours={odHours} odHoursData={odHoursData} cgpa={cgpa} creditsEarned={creditsEarned} feedback={feedback} gradesData={gradesData} marksData={marksData} />

          {/* Tabs */}
          <div className="flex gap-1 my-4 bg-surface-container rounded-xl p-1">
            {TABS.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.key ? 'bg-primary text-background' : 'text-on-surface-variant hover:text-on-surface'
                }`}>
                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="pb-24">
            <AnimatePresence mode="wait">
              {activeTab === 'attendance' && attendance.length > 0 && (
                <motion.div key="att" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <AttendanceTab attendance={attendance} />
                </motion.div>
              )}
              {activeTab === 'attendance' && attendance.length === 0 && (
                <div className="text-center py-12 text-on-surface-variant text-sm font-light">
                  No attendance data yet. Tap <span className="text-primary">↻</span> to sync.
                </div>
              )}
              {activeTab === 'exams' && (
                <motion.div key="exams" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <ExamsTab marksData={marksData} scheduleData={scheduleData} gradesData={gradesData} allGradesData={allGradesData} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Settings */}
      <AnimatePresence>
        {showSettings && (
          <SettingsSheet isOpen onClose={() => setShowSettings(false)} auth={auth} onLogout={handleLogout}
            onUpdateCreds={updateCredentials} semesterId={semesterId}
            onChangeSemester={setSemesterId} onReload={handleReload} />
        )}
      </AnimatePresence>

      {/* Loading overlay */}
      <AnimatePresence>
        {syncing && <LoadingOverlay message={syncMsg} progress={syncProgress} />}
      </AnimatePresence>
    </motion.div>
  )
}
