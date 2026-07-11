import { useEffect, useRef } from 'react'
import { db, todayISO } from '../db'

/**
 * Logs a snapshot of module data to the dailyLogs table once per meaningful change.
 * Replaces the old localStorage-based hook.
 */
export function useDailyLog(moduleName, data) {
  const prevRef = useRef(null)

  useEffect(() => {
    const json = JSON.stringify(data)
    if (prevRef.current === json) return
    prevRef.current = json

    const today = todayISO()

    ;(async () => {
      // Upsert: find existing log for today + module, or create
      const existing = await db.dailyLogs
        .where({ date: today, moduleName })
        .first()

      if (existing) {
        await db.dailyLogs.update(existing.id, { data, date: today })
      } else {
        await db.dailyLogs.add({ moduleName, data, date: today })
      }
    })()
  }, [JSON.stringify(data), moduleName])
}
