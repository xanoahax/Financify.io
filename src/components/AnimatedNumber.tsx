import { useEffect, useMemo, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  formatter?: (value: number) => string
  durationMs?: number
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3
}

function isStartupSplashActive(): boolean {
  if (typeof document === 'undefined') {
    return false
  }
  return document.documentElement.dataset.startupSplash === 'active'
}

export function AnimatedNumber({ value, formatter, durationMs = 420 }: AnimatedNumberProps): JSX.Element {
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])
  const [startupSplashActive, setStartupSplashActive] = useState(() => isStartupSplashActive())
  const [frozenDisplayValue, setFrozenDisplayValue] = useState(0)
  const [displayValue, setDisplayValue] = useState(0)
  const previousValueRef = useRef(0)

  useEffect(() => {
    const syncStartupSplash = () => {
      const active = isStartupSplashActive()
      setStartupSplashActive(active)
      if (active) {
        setFrozenDisplayValue(previousValueRef.current)
      }
    }

    syncStartupSplash()
    window.addEventListener('financify:startup-splash-change', syncStartupSplash)

    return () => {
      window.removeEventListener('financify:startup-splash-change', syncStartupSplash)
    }
  }, [])

  useEffect(() => {
    if (prefersReducedMotion) {
      previousValueRef.current = value
      return
    }

    if (startupSplashActive) {
      return
    }

    const startValue = previousValueRef.current
    const delta = value - startValue
    const startTime = performance.now()
    let frameId = 0

    const tick = (timestamp: number): void => {
      const progress = Math.min((timestamp - startTime) / durationMs, 1)
      const eased = easeOutCubic(progress)
      const nextValue = startValue + delta * eased

      setDisplayValue(nextValue)

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick)
        return
      }

      previousValueRef.current = value
      setDisplayValue(value)
    }

    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [durationMs, prefersReducedMotion, startupSplashActive, value])

  const renderedValue = prefersReducedMotion ? value : startupSplashActive ? frozenDisplayValue : displayValue

  return <>{formatter ? formatter(renderedValue) : Math.round(renderedValue)}</>
}
