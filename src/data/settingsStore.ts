import type { Settings, ShiftJobConfig, UiState } from '../types/models'

const SETTINGS_KEY = 'financify.settings'
const UI_STATE_KEY = 'financify.ui-state'
const BACKGROUND_IMAGE_KEY = 'financify.background-image'
const SKIPPED_UPDATE_VERSION_KEY = 'financify.updater.skipped-version'
const LEGACY_MIGRATION_SHIFT_JOB_ID = 'job-legacy-foodaffairs'

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

export function loadSettings(): Settings {
  const parsed = parseJson<Record<string, unknown>>(window.localStorage.getItem(SETTINGS_KEY), defaultSettings as unknown as Record<string, unknown>)
  const shiftJobs = normalizeShiftJobs(parsed.shiftJobs, parsed.foodAffairsHourlyRate)
  const defaultShiftJobId =
    typeof parsed.defaultShiftJobId === 'string' && shiftJobs.some((job) => job.id === parsed.defaultShiftJobId)
      ? parsed.defaultShiftJobId
      : shiftJobs[0]?.id ?? ''

  return {
    ...defaultSettings,
    ...parsed,
    shiftJobs,
    defaultShiftJobId,
  }
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

export function clearPersistedPreferences(): void {
  window.localStorage.removeItem(SETTINGS_KEY)
  window.localStorage.removeItem(UI_STATE_KEY)
  clearBackgroundImageDataUrl()
  window.localStorage.removeItem(SKIPPED_UPDATE_VERSION_KEY)
}

export function loadSkippedUpdateVersion(): string {
  const raw = window.localStorage.getItem(SKIPPED_UPDATE_VERSION_KEY)
  return typeof raw === 'string' ? raw : ''
}

export function saveSkippedUpdateVersion(version: string): void {
  const normalized = version.trim()
  if (!normalized) {
    window.localStorage.removeItem(SKIPPED_UPDATE_VERSION_KEY)
    return
  }
  window.localStorage.setItem(SKIPPED_UPDATE_VERSION_KEY, normalized)
}
