import { useEffect } from 'react'
import type { Settings } from '../types/models'
import { resolveTheme } from '../utils/theme'

interface DocumentAppearanceInput {
  settings: Settings
  language: Settings['language']
}

export function useDocumentAppearance(input: DocumentAppearanceInput): void {
  const { settings, language } = input

  useEffect(() => {
    const effectiveTheme = resolveTheme(settings.theme)
    document.documentElement.dataset.theme = effectiveTheme
    document.documentElement.lang = language
    document.documentElement.dataset.gradientOverlay = settings.gradientOverlayEnabled ? 'on' : 'off'
    document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'full'
    document.documentElement.style.setProperty('--accent', settings.accentColor)
    document.documentElement.style.setProperty('--gradient-a', settings.gradientColorA)
    document.documentElement.style.setProperty('--gradient-b', settings.gradientColorB)
  }, [
    settings.accentColor,
    settings.gradientColorA,
    settings.gradientColorB,
    settings.gradientOverlayEnabled,
    settings.reducedMotion,
    settings.theme,
    language,
  ])
}

