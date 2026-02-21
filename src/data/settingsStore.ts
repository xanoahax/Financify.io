import type { Settings, ShiftJobConfig, UiState } from '../types/models'
import {
  getBackgroundImageStorageKey,
  getSettingsStorageKey,
  getSkippedUpdateVersionStorageKey,
  getUiStateStorageKey,
} from './profileStore'

const LEGACY_MIGRATION_SHIFT_JOB_ID = 'job-legacy-foodaffairs'
const SUPPORTED_CURRENCIES = ['EUR', 'USD'] as const
type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

export const defaultSettings: Settings = {
  language: 'de',
  theme: 'glass',
  accentColor: '#0a84ff',
  gradientOverlayEnabled: true,
  gradientColorA: '#0a84ff',
  gradientColorB: '#25c99a',
  backgroundImageBlurEnabled: false,
  backgroundImageBlurAmount: 8,
  reducedMotion: false,
  currency: 'EUR',
  shiftJobs: [],
  defaultShiftJobId: '',
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

function normalizeShiftJobs(raw: unknown, legacyRate: unknown): ShiftJobConfig[] {
  const rows = Array.isArray(raw) ? raw : []
  const jobs = rows
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null
      }
      const source = row as { id?: unknown; name?: unknown; hourlyRate?: unknown }
      const name = typeof source.name === 'string' ? source.name.trim() : ''
      const hourlyRate = Number(source.hourlyRate)
      if (!name || !Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        return null
      }
      const id = typeof source.id === 'string' && source.id.trim() ? source.id : `job-${crypto.randomUUID()}`
      return { id, name, hourlyRate }
    })
    .filter((job): job is ShiftJobConfig => job !== null)

  if (jobs.length > 0) {
    return jobs
  }

  const migratedRate = Number(legacyRate)
  if (Number.isFinite(migratedRate) && migratedRate > 0) {
    return [{ id: LEGACY_MIGRATION_SHIFT_JOB_ID, name: 'FoodAffairs', hourlyRate: migratedRate }]
  }
  return []
}

function normalizeCurrency(raw: unknown): SupportedCurrency {
  if (typeof raw !== 'string') {
    return defaultSettings.currency
  }
  const upper = raw.toUpperCase()
  return SUPPORTED_CURRENCIES.includes(upper as SupportedCurrency) ? (upper as SupportedCurrency) : defaultSettings.currency
}

export function loadSettings(profileId: string): Settings {
  const parsed = parseJson<Record<string, unknown>>(
    window.localStorage.getItem(getSettingsStorageKey(profileId)),
    defaultSettings as unknown as Record<string, unknown>,
  )
  const shiftJobs = normalizeShiftJobs(parsed.shiftJobs, parsed.foodAffairsHourlyRate)
  const defaultShiftJobId =
    typeof parsed.defaultShiftJobId === 'string' && shiftJobs.some((job) => job.id === parsed.defaultShiftJobId)
      ? parsed.defaultShiftJobId
      : shiftJobs[0]?.id ?? ''

  return {
    ...defaultSettings,
    ...parsed,
    currency: normalizeCurrency(parsed.currency),
    shiftJobs,
    defaultShiftJobId,
  }
}

export function saveSettings(profileId: string, settings: Settings): void {
  window.localStorage.setItem(getSettingsStorageKey(profileId), JSON.stringify(settings))
}

export function loadUiState(profileId: string): UiState {
  return parseJson(window.localStorage.getItem(getUiStateStorageKey(profileId)), defaultUiState)
}

export function saveUiState(profileId: string, uiState: UiState): void {
  window.localStorage.setItem(getUiStateStorageKey(profileId), JSON.stringify(uiState))
}

export function loadBackgroundImageDataUrl(profileId: string): string | null {
  const raw = window.localStorage.getItem(getBackgroundImageStorageKey(profileId))
  return raw && raw.startsWith('data:image/') ? raw : null
}

export function saveBackgroundImageDataUrl(profileId: string, dataUrl: string): void {
  window.localStorage.setItem(getBackgroundImageStorageKey(profileId), dataUrl)
}

export function clearBackgroundImageDataUrl(profileId: string): void {
  window.localStorage.removeItem(getBackgroundImageStorageKey(profileId))
}

export function clearPersistedPreferences(profileId: string): void {
  window.localStorage.removeItem(getSettingsStorageKey(profileId))
  window.localStorage.removeItem(getUiStateStorageKey(profileId))
  clearBackgroundImageDataUrl(profileId)
  window.localStorage.removeItem(getSkippedUpdateVersionStorageKey(profileId))
}

export function loadSkippedUpdateVersion(profileId: string): string {
  const raw = window.localStorage.getItem(getSkippedUpdateVersionStorageKey(profileId))
  return typeof raw === 'string' ? raw : ''
}

export function saveSkippedUpdateVersion(profileId: string, version: string): void {
  const normalized = version.trim()
  if (!normalized) {
    window.localStorage.removeItem(getSkippedUpdateVersionStorageKey(profileId))
    return
  }
  window.localStorage.setItem(getSkippedUpdateVersionStorageKey(profileId), normalized)
}
