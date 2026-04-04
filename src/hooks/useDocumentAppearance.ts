import { useEffect } from 'react'
import type { Settings } from '../types/models'

interface DocumentAppearanceInput {
  settings: Settings
  language: Settings['language']
}

export function useDocumentAppearance(input: DocumentAppearanceInput): void {
  const { settings, language } = input

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    document.documentElement.lang = language
  }, [settings.theme, language])
}
