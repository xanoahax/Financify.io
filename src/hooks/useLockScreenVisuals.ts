import { useCallback, useMemo, useState } from 'react'
import type { Settings } from '../types/models'

interface LockScreenVisualSnapshot {
  settings: Settings
}

interface UseLockScreenVisualsInput {
  settings: Settings
  isProfileLocked: boolean
}

interface UseLockScreenVisualsOutput {
  effectiveSettings: Settings
  captureCurrentVisualSnapshot: () => void
  clearCurrentVisualSnapshot: () => void
}

export function useLockScreenVisuals(input: UseLockScreenVisualsInput): UseLockScreenVisualsOutput {
  const { settings, isProfileLocked } = input
  const [snapshot, setSnapshot] = useState<LockScreenVisualSnapshot | null>(null)

  const captureCurrentVisualSnapshot = useCallback(() => {
    setSnapshot({ settings })
  }, [settings])

  const clearCurrentVisualSnapshot = useCallback(() => {
    setSnapshot(null)
  }, [])
  const effectiveSettings = useMemo(
    () => (isProfileLocked && snapshot ? snapshot.settings : settings),
    [isProfileLocked, settings, snapshot],
  )

  return {
    effectiveSettings,
    captureCurrentVisualSnapshot,
    clearCurrentVisualSnapshot,
  }
}
