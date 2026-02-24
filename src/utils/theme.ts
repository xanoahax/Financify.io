import type { ThemeMode } from '../types/models'

export function resolveTheme(theme: ThemeMode): Exclude<ThemeMode, 'system'> {
  if (theme !== 'system') {
    return theme
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

