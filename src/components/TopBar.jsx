import { useLocation, useNavigate } from 'react-router-dom'

const NAV_ITEMS = [
  { path: '/', label: 'Home' },
  { path: '/college', label: 'College' },
  { path: '/gym', label: 'Gym' },
  { path: '/skincare', label: 'Skincare' },
  { path: '/skills', label: 'Skills' },
]

export default function TopBar() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <header className="fixed top-0 w-full z-50 bg-background/90 backdrop-blur-md border-b border-outline-variant flex items-center justify-between px-[var(--spacing-container-margin)] h-[calc(4rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] transition-colors duration-200">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full overflow-hidden border border-primary/30 flex items-center justify-center">
          <img src="/pfp.jpg" alt="Profile" className="w-full h-full object-cover" />
        </div>
        <span className="font-[var(--font-headline)] text-xl font-semibold text-primary tracking-wide">
          Life OS
        </span>
      </div>

      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <a
              key={item.path}
              href={`#${item.path}`}
              className={`px-3 py-2 rounded-lg text-sm font-normal transition-colors duration-200 ${
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              {item.label}
            </a>
          )
        })}
      </nav>

      {/* Settings */}
      <button
        onClick={() => navigate('/settings')}
        aria-label="Settings"
        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors duration-200 text-on-surface-variant"
      >
        <span className="material-symbols-outlined">settings</span>
      </button>
    </header>
  )
}
