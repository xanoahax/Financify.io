import { useCallback, useMemo, useState } from 'react'
import type { Settings } from '../types/models'

interface LockScreenVisualSnapshot {
  settings: Settings
  backgroundImageDataUrl: string | null
}

interface UseLockScreenVisualsInput {
  settings: Settings
  backgroundImageDataUrl: string | null
  isProfileLocked: boolean
}

interface UseLockScreenVisualsOutput {
  effectiveSettings: Settings
  effectiveBackgroundImageDataUrl: string | null
  captureCurrentVisualSnapshot: () => void
  clearCurrentVisualSnapshot: () => void
}

export function useLockScreenVisuals(input: UseLockScreenVisualsInput): UseLockScreenVisualsOutput {
  const { settings, backgroundImageDataUrl, isProfileLocked } = input
  const [snapshot, setSnapshot] = useState<LockScreenVisualSnapshot | null>(null)

  const captureCurrentVisualSnapshot = useCallback(() => {
    setSnapshot({ settings, backgroundImageDataUrl })
  }, [backgroundImageDataUrl, settings])

  const clearCurrentVisualSnapshot = useCallback(() => {
    setSnapshot(null)
  }, [])
  const effectiveSettings = useMemo(
    () => (isProfileLocked && snapshot ? snapshot.settings : settings),
    [isProfileLocked, settings, snapshot],
  )
  const effectiveBackgroundImageDataUrl = useMemo(
    () => (isProfileLocked && snapshot ? snapshot.backgroundImageDataUrl : backgroundImageDataUrl),
    [backgroundImageDataUrl, isProfileLocked, snapshot],
  )

  return {
    effectiveSettings,
    effectiveBackgroundImageDataUrl,
    captureCurrentVisualSnapshot,
    clearCurrentVisualSnapshot,
  }
}
