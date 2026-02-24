import {
  defaultSettings,
  defaultUiState,
  loadBackgroundImageDataUrl,
  loadSettings,
  loadSkippedUpdateVersion,
  loadUiState,
} from '../data/settingsStore'
import {
  DEFAULT_PROFILE_ID,
  hasLegacyLocalData,
  loadActiveProfileId,
  loadProfiles,
  makeProfile,
  saveActiveProfileId,
  saveProfiles,
} from '../data/profileStore'
import type { AppLanguage, EmploymentType, FixedPayInterval, Settings, ShiftJobConfig, UiState, UserProfile } from '../types/models'
import { tx } from '../utils/i18n'

const SUPPORTED_CURRENCIES = ['EUR', 'USD'] as const
type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

export interface PersistedProfilePreferences {
  settings: Settings
  uiState: UiState
  backgroundImageDataUrl: string | null
  skippedUpdateVersion: string
}

export const MAX_BACKGROUND_FILE_BYTES = 3 * 1024 * 1024

export function nowIso(): string {
  return new Date().toISOString()
}

export function makeId(): string {
  return crypto.randomUUID()
}

export function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const map = new Map<string, T>()
  for (const row of rows) {
    map.set(row.id, row)
  }
  return [...map.values()]
}

export function ensurePositiveNumber(value: number, fieldLabel: string, language: AppLanguage): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(tx(language, `${fieldLabel} muss eine gültige nicht-negative Zahl sein.`, `${fieldLabel} must be a valid non-negative number.`))
  }
}

export function normalizeTags(input: string[]): string[] {
  return input
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 10)
}

export function normalizeCurrency(value: unknown): Settings['currency'] {
  if (typeof value !== 'string') {
    return defaultSettings.currency
  }
  const upper = value.toUpperCase()
  return SUPPORTED_CURRENCIES.includes(upper as SupportedCurrency) ? (upper as SupportedCurrency) : defaultSettings.currency
}

function normalizeImportedShiftJobs(raw: unknown): ShiftJobConfig[] {
  if (!Array.isArray(raw)) {
    return []
  }
  function normalizeEmploymentType(value: unknown): EmploymentType {
    return value === 'fixed' ? 'fixed' : 'casual'
  }
  function normalizeFixedPayInterval(value: unknown): FixedPayInterval {
    if (value === 'weekly' || value === 'biweekly' || value === 'monthly') {
      return value
    }
    return 'monthly'
  }
  function isDateString(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  }
  const todayDate = new Date().toISOString().slice(0, 10)
  return raw.reduce<ShiftJobConfig[]>((acc, row) => {
      if (!row || typeof row !== 'object') {
        return acc
      }
      const job = row as {
        id?: unknown
        name?: unknown
        employmentType?: unknown
        hourlyRate?: unknown
        salaryAmount?: unknown
        fixedPayInterval?: unknown
        has13thSalary?: unknown
        has14thSalary?: unknown
        startDate?: unknown
      }
      const name = typeof job.name === 'string' ? job.name.trim() : ''
      if (!name) {
        return acc
      }
      const employmentType = normalizeEmploymentType(job.employmentType)
      const id = typeof job.id === 'string' && job.id.trim() ? job.id : makeId()
      if (employmentType === 'fixed') {
        const salaryAmount = Number(job.salaryAmount)
        if (!Number.isFinite(salaryAmount) || salaryAmount <= 0) {
          return acc
        }
        acc.push({
          id,
          name,
          employmentType: 'fixed' as const,
          salaryAmount,
          fixedPayInterval: normalizeFixedPayInterval(job.fixedPayInterval),
          has13thSalary: Boolean(job.has13thSalary),
          has14thSalary: Boolean(job.has14thSalary),
          startDate: isDateString(job.startDate) ? job.startDate : todayDate,
        })
        return acc
      }
      const hourlyRate = Number(job.hourlyRate)
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        return acc
      }
      acc.push({ id, name, employmentType: 'casual' as const, hourlyRate })
      return acc
    }, [])
}

export function normalizeImportedSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') {
    return defaultSettings
  }
  const candidate = raw as Partial<Settings> & { shiftJobs?: unknown; defaultShiftJobId?: unknown }
  const shiftJobs = normalizeImportedShiftJobs(candidate.shiftJobs)
  const casualJobs = shiftJobs.filter((job) => job.employmentType === 'casual')
  const defaultShiftJobId =
    typeof candidate.defaultShiftJobId === 'string' && casualJobs.some((job) => job.id === candidate.defaultShiftJobId)
      ? candidate.defaultShiftJobId
      : casualJobs[0]?.id ?? ''

  return {
    ...defaultSettings,
    ...candidate,
    currency: normalizeCurrency(candidate.currency),
    shiftJobs,
    defaultShiftJobId,
  }
}

export function normalizeImportedUiState(raw: unknown): UiState {
  if (!raw || typeof raw !== 'object') {
    return defaultUiState
  }
  const candidate = raw as Partial<UiState>
  return {
    ...defaultUiState,
    ...candidate,
  }
}

export function loadPersistedProfilePreferences(profileId: string): PersistedProfilePreferences {
  return {
    settings: loadSettings(profileId),
    uiState: loadUiState(profileId),
    backgroundImageDataUrl: loadBackgroundImageDataUrl(profileId),
    skippedUpdateVersion: loadSkippedUpdateVersion(profileId),
  }
}

export function readFileAsDataUrl(file: File, language: AppLanguage): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(tx(language, 'Ausgewählte Bilddatei konnte nicht gelesen werden.', 'Selected image file could not be read.')))
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error(tx(language, 'Ausgewählte Bilddatei konnte nicht verarbeitet werden.', 'Selected image file could not be processed.')))
        return
      }
      resolve(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function resolveInitialProfileName(): string {
  const locale = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'en'
  return locale.startsWith('de') ? 'Standard' : 'Default'
}

export function resolveUniqueProfileName(name: string, profiles: UserProfile[], language: AppLanguage): string {
  const base = (name.trim() || tx(language, 'Neues Profil', 'New profile')).slice(0, 40)
  if (!profiles.some((profile) => profile.name.toLowerCase() === base.toLowerCase())) {
    return base
  }
  let counter = 2
  while (profiles.some((profile) => profile.name.toLowerCase() === `${base} (${counter})`.toLowerCase())) {
    counter += 1
  }
  return `${base} (${counter})`
}

function profileSortTimestamp(profile: UserProfile): number {
  const updated = Date.parse(profile.updatedAt)
  if (Number.isFinite(updated)) {
    return updated
  }
  const created = Date.parse(profile.createdAt)
  return Number.isFinite(created) ? created : 0
}

export function collapsePendingProfiles(profiles: UserProfile[], preferredPendingId: string): { profiles: UserProfile[]; changed: boolean } {
  const pending = profiles.filter((profile) => !profile.onboardingCompleted)
  if (pending.length <= 1) {
    return { profiles, changed: false }
  }
  const keepPending =
    pending.find((profile) => profile.id === preferredPendingId) ??
    [...pending].sort((left, right) => profileSortTimestamp(right) - profileSortTimestamp(left))[0]
  if (!keepPending) {
    return { profiles, changed: false }
  }
  const nextProfiles = profiles.filter((profile) => profile.onboardingCompleted || profile.id === keepPending.id)
  return { profiles: nextProfiles, changed: nextProfiles.length !== profiles.length }
}

export async function hashSecret(secret: string): Promise<string> {
  const normalized = secret.trim()
  if (!normalized) {
    return ''
  }
  const data = new TextEncoder().encode(normalized)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = Array.from(new Uint8Array(digest))
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function buildInitialProfileState(): { profiles: UserProfile[]; activeProfileId: string } {
  let profiles = loadProfiles()
  if (profiles.length === 0) {
    const seededProfile = makeProfile(resolveInitialProfileName(), {
      id: DEFAULT_PROFILE_ID,
      onboardingCompleted: hasLegacyLocalData(),
    })
    profiles = [seededProfile]
    saveProfiles(profiles)
    saveActiveProfileId(seededProfile.id)
  }
  let activeProfileId = loadActiveProfileId(profiles) || profiles[0]?.id || ''
  const collapsedPending = collapsePendingProfiles(profiles, activeProfileId)
  if (collapsedPending.changed) {
    profiles = collapsedPending.profiles
    saveProfiles(profiles)
  }
  if (activeProfileId && !profiles.some((profile) => profile.id === activeProfileId)) {
    activeProfileId = profiles[0]?.id || ''
  }
  if (activeProfileId) {
    saveActiveProfileId(activeProfileId)
  }
  return { profiles, activeProfileId }
}
