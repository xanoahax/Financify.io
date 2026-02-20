import type { Settings, UiState } from '../types/models'

const SETTINGS_KEY = 'financify.settings'
const UI_STATE_KEY = 'financify.ui-state'
const BACKGROUND_IMAGE_KEY = 'financify.background-image'

export const defaultSettings: Settings = {
  theme: 'system',
  accentColor: '#0a84ff',
  gradientOverlayEnabled: true,
  gradientColorA: '#0a84ff',
  gradientColorB: '#25c99a',
  backgroundImageBlurEnabled: false,
  backgroundImageBlurAmount: 8,
  reducedMotion: false,
  currency: 'EUR',
  decimals: 2,
  foodAffairsHourlyRate: 18,
  dateFormat: 'DD.MM.YYYY',
  startOfWeek: 'monday',
  privacyHideAmounts: false,
}

export const defaultUiState: UiState = {
  sidebarCollapsed: false,
  globalSearch: '',
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback
  }
  try {
    return { ...fallback, ...JSON.parse(raw) }
  } catch {
    return fallback
  }
}

export function loadSettings(): Settings {
  return parseJson(window.localStorage.getItem(SETTINGS_KEY), defaultSettings)
}

export function saveSettings(settings: Settings): void {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function loadUiState(): UiState {
  return parseJson(window.localStorage.getItem(UI_STATE_KEY), defaultUiState)
}

export function saveUiState(uiState: UiState): void {
  window.localStorage.setItem(UI_STATE_KEY, JSON.stringify(uiState))
}

export function loadBackgroundImageDataUrl(): string | null {
  const raw = window.localStorage.getItem(BACKGROUND_IMAGE_KEY)
  return raw && raw.startsWith('data:image/') ? raw : null
}

export function saveBackgroundImageDataUrl(dataUrl: string): void {
  window.localStorage.setItem(BACKGROUND_IMAGE_KEY, dataUrl)
}

export function clearBackgroundImageDataUrl(): void {
  window.localStorage.removeItem(BACKGROUND_IMAGE_KEY)
}
