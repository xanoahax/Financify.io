import type { UserProfile } from '../types/models'

const PROFILES_KEY = 'financify.profiles'
const ACTIVE_PROFILE_ID_KEY = 'financify.active-profile-id'
export const DEFAULT_PROFILE_ID = 'default'

const LEGACY_SETTINGS_KEY = 'financify.settings'
const LEGACY_UI_STATE_KEY = 'financify.ui-state'
const LEGACY_BACKGROUND_IMAGE_KEY = 'financify.background-image'
const LEGACY_SKIPPED_UPDATE_VERSION_KEY = 'financify.updater.skipped-version'

function nowIso(): string {
  return new Date().toISOString()
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function sanitizeProfiles(rows: unknown): UserProfile[] {
  if (!Array.isArray(rows)) {
    return []
  }
  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null
      }
      const source = row as Partial<UserProfile>
      const id = typeof source.id === 'string' ? source.id.trim() : ''
      const name = typeof source.name === 'string' ? source.name.trim() : ''
      if (!id || !name) {
        return null
      }
      const timestamp = nowIso()
      return {
        id,
        name,
        createdAt: typeof source.createdAt === 'string' && source.createdAt ? source.createdAt : timestamp,
        updatedAt: typeof source.updatedAt === 'string' && source.updatedAt ? source.updatedAt : timestamp,
        lastOpenedAt: typeof source.lastOpenedAt === 'string' && source.lastOpenedAt ? source.lastOpenedAt : timestamp,
        onboardingCompleted: Boolean(source.onboardingCompleted),
        authMode: source.authMode === 'pin' || source.authMode === 'password' ? source.authMode : 'none',
        authSecretHash: typeof source.authSecretHash === 'string' ? source.authSecretHash : '',
      } as UserProfile
    })
    .filter((item): item is UserProfile => item !== null)
}

export function makeProfile(name: string, options?: { id?: string; onboardingCompleted?: boolean }): UserProfile {
  const timestamp = nowIso()
  const trimmedName = name.trim()
  return {
    id: options?.id?.trim() || `profile-${crypto.randomUUID()}`,
    name: trimmedName || 'User',
    createdAt: timestamp,
    updatedAt: timestamp,
    lastOpenedAt: timestamp,
    onboardingCompleted: Boolean(options?.onboardingCompleted),
    authMode: 'none',
    authSecretHash: '',
  }
}

export function loadProfiles(): UserProfile[] {
  return sanitizeProfiles(parseJson<unknown>(window.localStorage.getItem(PROFILES_KEY), []))
}

export function saveProfiles(profiles: UserProfile[]): void {
  window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))
}

export function loadActiveProfileId(profiles: UserProfile[]): string {
  const activeId = window.localStorage.getItem(ACTIVE_PROFILE_ID_KEY)
  if (activeId && profiles.some((profile) => profile.id === activeId)) {
    return activeId
  }
  return profiles[0]?.id ?? ''
}

export function saveActiveProfileId(profileId: string): void {
  const normalized = profileId.trim()
  if (!normalized) {
    window.localStorage.removeItem(ACTIVE_PROFILE_ID_KEY)
    return
  }
  window.localStorage.setItem(ACTIVE_PROFILE_ID_KEY, normalized)
}

export function hasLegacyLocalData(): boolean {
  return [LEGACY_SETTINGS_KEY, LEGACY_UI_STATE_KEY, LEGACY_BACKGROUND_IMAGE_KEY, LEGACY_SKIPPED_UPDATE_VERSION_KEY].some((key) =>
    window.localStorage.getItem(key),
  )
}

export function getSettingsStorageKey(profileId: string): string {
  return profileId === DEFAULT_PROFILE_ID ? LEGACY_SETTINGS_KEY : `financify.profile.${profileId}.settings`
}

export function getUiStateStorageKey(profileId: string): string {
  return profileId === DEFAULT_PROFILE_ID ? LEGACY_UI_STATE_KEY : `financify.profile.${profileId}.ui-state`
}

export function getBackgroundImageStorageKey(profileId: string): string {
  return profileId === DEFAULT_PROFILE_ID ? LEGACY_BACKGROUND_IMAGE_KEY : `financify.profile.${profileId}.background-image`
}

export function getSkippedUpdateVersionStorageKey(profileId: string): string {
  return profileId === DEFAULT_PROFILE_ID ? LEGACY_SKIPPED_UPDATE_VERSION_KEY : `financify.profile.${profileId}.updater.skipped-version`
}

export function listProfileStorageKeys(profileId: string): string[] {
  return [
    getSettingsStorageKey(profileId),
    getUiStateStorageKey(profileId),
    getBackgroundImageStorageKey(profileId),
    getSkippedUpdateVersionStorageKey(profileId),
  ]
}
