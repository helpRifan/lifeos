import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { registerPlugin, Capacitor } from '@capacitor/core'
import TopBar from './components/TopBar'
import CurvedBottomNav from './components/CurvedBottomNav/CurvedBottomNav'
import HomePage from './pages/HomePage'
import CollegePage from './pages/CollegePage'
import GymPage from './pages/GymPage'
import SkincarePage from './pages/SkincarePage'
import SkillsPage from './pages/SkillsPage'
import WaterPage from './pages/WaterPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'
import { syncAllNotifications } from './lib/notifications'

export default function App() {
  const location = useLocation()
  const hideBottomNav = ['/water', '/settings', '/history'].includes(location.pathname)

  useEffect(() => {
    const initApp = async () => {
      // 1. Load background-synced VTOP data if on native Android
      if (Capacitor.isNativePlatform()) {
        try {
          const VTOPBackground = registerPlugin('VTOPBackground')
          const cached = await VTOPBackground.getBackgroundCachedData()
          if (cached) {
            if (cached.attendance) localStorage.setItem('unicc_attendance', cached.attendance)
            if (cached.grades) localStorage.setItem('unicc_grades', cached.grades)
            if (cached.schedule) localStorage.setItem('unicc_schedule', cached.schedule)
            if (cached.allGrades) localStorage.setItem('unicc_allGrades', cached.allGrades)
          }
          await VTOPBackground.requestBatteryExemption()
        } catch (e) {
          console.error('Failed to load background cached data:', e)
        }
      }
      // 2. Schedule local alarms (classes, water, deadlines, exams)
      await syncAllNotifications()
    }
    initApp()
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-background text-on-background">
      <TopBar />

      <main className="flex-1 pt-[calc(4rem+env(safe-area-inset-top,0px))] pb-24 overflow-y-auto scrollbar-hide">
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/college" element={<CollegePage />} />
            <Route path="/gym" element={<GymPage />} />
            <Route path="/skincare" element={<SkincarePage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/water" element={<WaterPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </main>

      {!hideBottomNav && <CurvedBottomNav />}
    </div>
  )
}
