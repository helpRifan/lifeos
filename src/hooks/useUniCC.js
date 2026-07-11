import { useState, useCallback, useRef } from 'react'
import { registerPlugin, Capacitor } from '@capacitor/core'

const VTOPBackground = registerPlugin('VTOPBackground')

// The REAL UniCC backend
const API_BASE = 'https://api.uni-cc.site'
const AUTH_KEY = 'unicc_auth'
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

const syncCredentialsToNative = async (authObj) => {
  if (Capacitor.isNativePlatform()) {
    try {
      if (authObj) {
        await VTOPBackground.setCredentials({
          username: authObj.username,
          password: authObj.password,
          semesterId: authObj.semesterId || 'CH20252605'
        })
      } else {
        await VTOPBackground.setCredentials({ username: '', password: '' })
      }
      console.log('[Native] Updated background sync credentials.')
    } catch (e) {
      console.error('[Native] Failed to update credentials:', e)
    }
  }
}

// Default current semester (second-to-last from config.json)
const DEFAULT_SEMESTER = 'CH20252605'

// ─── Storage helpers ─────────────────────────────────────────────────

function getStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY)) || null
  } catch { return null }
}

function setStoredAuth(auth) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth))
}

function clearStoredAuth() {
  localStorage.removeItem(AUTH_KEY)
}

function getCached(key) {
  try {
    const ts = parseInt(localStorage.getItem(`unicc_cache_${key}_ts`), 10)
    if (ts && Date.now() - ts < CACHE_TTL) {
      return JSON.parse(localStorage.getItem(`unicc_cache_${key}`))
    }
  } catch { /* ignore */ }
  return null
}

function setCache(key, data) {
  try {
    localStorage.setItem(`unicc_cache_${key}`, JSON.stringify(data))
    localStorage.setItem(`unicc_cache_${key}_ts`, String(Date.now()))
  } catch { /* quota */ }
}

function clearAllCache() {
  const toRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith('unicc_cache_')) toRemove.push(k)
  }
  toRemove.forEach((k) => localStorage.removeItem(k))
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useUniCC() {
  const [auth, setAuth] = useState(getStoredAuth)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const retryCount = useRef(0)

  const isLoggedIn = !!(auth?.cookies && auth?.authorizedID && auth?.csrf)

  // Login → POST /api/login → returns { cookies, csrf, authorizedID }
  const login = useCallback(async (username, password, retrying = false) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      // Auto-retry on captcha failure (once)
      if (data.message?.includes('Invalid Captcha') && !retrying) {
        console.warn('Captcha failed, retrying...')
        return login(username, password, true)
      }

      if (!data.success || !data.authorizedID || !data.cookies) {
        throw new Error(data.message || data.error || 'Login failed')
      }

      const authObj = {
        cookies: data.cookies,
        csrf: data.csrf,
        authorizedID: data.authorizedID,
        username,
        password,
        semesterId: DEFAULT_SEMESTER,
      }

      setStoredAuth(authObj)
      setAuth(authObj)
      retryCount.current = 0
      syncCredentialsToNative(authObj)
      return authObj
    } catch (err) {
      setError(err.message || 'Login failed')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // Logout
  const logout = useCallback(() => {
    clearStoredAuth()
    clearAllCache()
    setAuth(null)
    setError(null)
    syncCredentialsToNative(null)
  }, [])

  // Update credentials without re-login (saved for next session)
  const updateCredentials = useCallback((username, password) => {
    const newAuth = { ...getStoredAuth(), username, password }
    setStoredAuth(newAuth)
    setAuth(newAuth)
    syncCredentialsToNative(newAuth)
  }, [])

  // POST fetch with session credentials
  const apiFetch = useCallback(async (endpoint, extraBody = {}) => {
    const currentAuth = getStoredAuth()
    if (!currentAuth?.cookies) throw new Error('Not authenticated')

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cookies: currentAuth.cookies,
        authorizedID: currentAuth.authorizedID,
        csrf: currentAuth.csrf,
        semesterId: currentAuth.semesterId || DEFAULT_SEMESTER,
        ...extraBody,
      }),
    })

    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  }, [])

  // Cache-first fetch
  const apiFetchCached = useCallback(async (endpoint, extraBody = {}) => {
    const cacheKey = endpoint.replace(/\//g, '_')
    const cached = getCached(cacheKey)

    // Background refresh (fire-and-forget)
    const refresh = () => {
      apiFetch(endpoint, extraBody)
        .then((data) => setCache(cacheKey, data))
        .catch(() => {})
    }

    if (cached) {
      refresh()
      return cached
    }

    // No cache — must wait
    const data = await apiFetch(endpoint, extraBody)
    setCache(cacheKey, data)
    return data
  }, [apiFetch])

  // Re-login with stored credentials (for session refresh)
  const relogin = useCallback(async () => {
    const currentAuth = getStoredAuth()
    if (!currentAuth?.username || !currentAuth?.password) {
      throw new Error('No stored credentials')
    }
    return login(currentAuth.username, currentAuth.password)
  }, [login])

  // Full data fetch: login → fetch all endpoints in parallel
  const fetchAllData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Re-login to get fresh session
      const freshAuth = await relogin()

      const body = {
        cookies: freshAuth.cookies,
        authorizedID: freshAuth.authorizedID,
        csrf: freshAuth.csrf,
        semesterId: freshAuth.semesterId || DEFAULT_SEMESTER,
      }

      const [attendance, grades, schedule, allGrades] = await Promise.all([
        fetch(`${API_BASE}/api/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then((r) => r.json()),

        fetch(`${API_BASE}/api/grades`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then((r) => r.json()),

        fetch(`${API_BASE}/api/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then((r) => r.json()),

        fetch(`${API_BASE}/api/all-grades`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then((r) => r.json()),
      ])

      // Cache all results
      setCache('_api_attendance', attendance)
      setCache('_api_grades', grades)
      setCache('_api_schedule', schedule)
      setCache('_api_all-grades', allGrades)

      return { attendance, grades, schedule, allGrades }
    } catch (err) {
      setError(err.message || 'Failed to fetch data')
      throw err
    } finally {
      setLoading(false)
    }
  }, [relogin])

  return {
    auth,
    isLoggedIn,
    loading,
    error,
    login,
    logout,
    updateCredentials,
    apiFetch,
    apiFetchCached,
    relogin,
    fetchAllData,
    DEFAULT_SEMESTER,
  }
}
