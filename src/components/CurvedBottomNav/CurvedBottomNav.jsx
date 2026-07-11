import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import './CurvedBottomNav.css'

const NAV_ITEMS = [
  { path: '/', icon: 'home', label: 'Home' },
  { path: '/college', icon: 'school', label: 'College' },
  { path: '/gym', icon: 'fitness_center', label: 'Gym' },
  { path: '/skincare', icon: 'spa', label: 'Skincare' },
  { path: '/skills', icon: 'task_alt', label: 'Skills' },
]

const BAR_HEIGHT = 80
const NOTCH_DEPTH = 22
const CURVE_SPREAD = 40
const NOTCH_R = 30

function generateBarPath(width, notchCenterX) {
  const h = BAR_HEIGHT
  const d = NOTCH_DEPTH
  const s = CURVE_SPREAD
  const r = NOTCH_R

  const notchStart = notchCenterX - s - r * 0.5
  const notchEnd = notchCenterX + s + r * 0.5

  return `
    M 0,0
    L ${notchStart},0
    C ${notchStart + s * 0.45},0 ${notchCenterX - s * 0.35},${d} ${notchCenterX},${d}
    C ${notchCenterX + s * 0.35},${d} ${notchEnd - s * 0.45},0 ${notchEnd},0
    L ${width},0
    L ${width},${h}
    L 0,${h}
    Z
  `
}

export default function CurvedBottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeIndex = NAV_ITEMS.findIndex((item) => item.path === location.pathname)
  const currentIndex = activeIndex === -1 ? 0 : activeIndex

  const getNotchX = (index) => {
    const slotWidth = 100 / NAV_ITEMS.length
    return slotWidth * index + slotWidth / 2
  }

  const notchPercent = getNotchX(currentIndex)

  return (
    <nav className="curved-bottom-nav md:hidden" role="navigation" aria-label="Main navigation">
      {/* Layer 1: Frosted glass rectangle (blurs content behind) */}
      <div className="curved-bottom-nav__glass" />

      {/* Layer 2: SVG shape with notch cutout */}
      <svg
        className="curved-bottom-nav__bg"
        viewBox={`0 0 100 ${BAR_HEIGHT}`}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.path
          d={generateBarPath(100, notchPercent)}
          fill="#141418"
          initial={false}
          animate={{ d: generateBarPath(100, notchPercent) }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
        />
        {/* Subtle top border lines */}
        <motion.path
          d={`M 0,0.5 L ${notchPercent - CURVE_SPREAD - NOTCH_R * 0.5},0.5`}
          stroke="rgba(201, 168, 76, 0.15)"
          strokeWidth="0.5"
          fill="none"
          initial={false}
          animate={{ d: `M 0,0.5 L ${notchPercent - CURVE_SPREAD - NOTCH_R * 0.5},0.5` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
        <motion.path
          d={`M ${notchPercent + CURVE_SPREAD + NOTCH_R * 0.5},0.5 L 100,0.5`}
          stroke="rgba(201, 168, 76, 0.15)"
          strokeWidth="0.5"
          fill="none"
          initial={false}
          animate={{ d: `M ${notchPercent + CURVE_SPREAD + NOTCH_R * 0.5},0.5 L 100,0.5` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      </svg>

      {/* Layer 3: Interactive tabs (no background) */}
      <div className="curved-bottom-nav__tabs">
        {NAV_ITEMS.map((item, index) => {
          const isActive = index === currentIndex
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`curved-bottom-nav__tab ${isActive ? 'curved-bottom-nav__tab--active' : ''}`}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active floating bubble */}
              {isActive && (
                <motion.div
                  className="curved-bottom-nav__bubble"
                  layoutId="nav-bubble"
                  transition={{ type: 'spring', stiffness: 350, damping: 28, mass: 0.8 }}
                >
                  <span className="material-symbols-outlined filled text-[22px]">
                    {item.icon}
                  </span>
                </motion.div>
              )}

              {/* Inactive icon + label */}
              {!isActive && (
                <motion.div
                  className="curved-bottom-nav__inactive"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="material-symbols-outlined text-[22px]">
                    {item.icon}
                  </span>
                  <span className="curved-bottom-nav__label">{item.label}</span>
                </motion.div>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
