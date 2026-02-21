import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  clearPersistedPreferences,
  clearBackgroundImageDataUrl,
  defaultSettings,
  defaultUiState,
  loadBackgroundImageDataUrl,
  loadSkippedUpdateVersion,
  loadSettings,
  loadUiState,
  saveBackgroundImageDataUrl,
  saveSkippedUpdateVersion,
  saveSettings,
  saveUiState,
} from '../data/settingsStore'
import {
  clearRepositoryCache,
  listIncomeEntries,
  listInterestScenarios,
  listSubscriptions,
  removeIncomeEntry,
  removeInterestScenario,
  removeSubscription,
  replaceIncomeEntries,
  replaceInterestScenarios,
  replaceSubscriptions,
  saveIncomeEntry,
  saveInterestScenario,
  saveSubscription,
} from '../data/repositories'
import { deleteProfileDb } from '../data/db'
import {
  DEFAULT_PROFILE_ID,
  hasLegacyLocalData,
  loadActiveProfileId,
  loadProfiles,
  makeProfile,
  saveActiveProfileId,
  saveProfiles,
} from '../data/profileStore'
import type {
  AppBackup,
  AppLanguage,
  IncomeEntry,
  InterestScenario,
  InterestScenarioInput,
  ProfileBackupPayload,
  Settings,
  ShiftJobConfig,
  Subscription,
  ToastMessage,
  UpdatePrompt,
  UiState,
  UserProfile,
} from '../types/models'
import { tx } from '../utils/i18n'
import { isTauriRuntime } from '../utils/runtime'

export interface OnboardingSetupInput {
  language: Settings['language']
  theme: Settings['theme']
  currency: Settings['currency']
  dateFormat: Settings['dateFormat']
  profileName: string
  authMode: 'none' | 'pin' | 'password'
  authSecret?: string
  jobName?: string
  jobHourlyRate?: number
}

export interface AppContextValue {
  loading: boolean
  subscriptions: Subscription[]
  incomeEntries: IncomeEntry[]
  scenarios: InterestScenario[]
  settings: Settings
  backgroundImageDataUrl: string | null
  uiState: UiState
  toasts: ToastMessage[]
  profiles: UserProfile[]
  activeProfileId: string
  activeProfile: UserProfile | null
  needsOnboarding: boolean
  canExitOnboarding: boolean
  updatesSupported: boolean
  isCheckingForUpdates: boolean
  isInstallingUpdate: boolean
  skippedUpdateVersion: string
  updatePrompt: UpdatePrompt | null
  updateCheckError: string | null
  setSettings: (changes: Partial<Settings>) => void
  setUiState: (changes: Partial<UiState>) => void
  setBackgroundImageFromFile: (file: File) => Promise<void>
  clearBackgroundImage: () => void
  createProfile: (name: string) => void
  switchProfile: (profileId: string) => void
  renameProfile: (profileId: string, name: string) => void
  deleteProfile: (profileId: string) => Promise<void>
  completeOnboarding: (payload: OnboardingSetupInput) => Promise<void>
  exitOnboarding: () => void
  updateProfileProtection: (profileId: string, authMode: UserProfile['authMode'], authSecret?: string) => Promise<void>
  addSubscription: (payload: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateSubscription: (id: string, payload: Partial<Subscription>) => Promise<void>
  deleteSubscription: (id: string) => Promise<void>
  addIncomeEntry: (payload: Omit<IncomeEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateIncomeEntry: (id: string, payload: Partial<IncomeEntry>) => Promise<void>
  deleteIncomeEntry: (id: string) => Promise<void>
  addScenario: (payload: InterestScenarioInput) => Promise<void>
  updateScenario: (id: string, payload: InterestScenarioInput) => Promise<void>
  deleteScenario: (id: string) => Promise<void>
  exportBackup: () => AppBackup
  importBackup: (payload: AppBackup, mode: 'replace' | 'merge') => Promise<void>
  clearAllData: () => Promise<void>
  checkForUpdates: (options?: { manual?: boolean }) => Promise<boolean>
  installUpdate: () => Promise<void>
  skipUpdateVersion: () => void
  dismissUpdatePrompt: () => void
  dismissToast: (id: string) => void
}

// Context must be exported for hooks in separate files.
// eslint-disable-next-line react-refresh/only-export-components
export const AppContext = createContext<AppContextValue | null>(null)

const SUPPORTED_CURRENCIES = ['EUR', 'USD'] as const
type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

function nowIso(): string {
  return new Date().toISOString()
}

function makeId(): string {
  return crypto.randomUUID()
}

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const map = new Map<string, T>()
  for (const row of rows) {
    map.set(row.id, row)
  }
  return [...map.values()]
}

function ensurePositiveNumber(value: number, fieldLabel: string, language: AppLanguage): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(tx(language, `${fieldLabel} muss eine gültige nicht-negative Zahl sein.`, `${fieldLabel} must be a valid non-negative number.`))
  }
}

function normalizeTags(input: string[]): string[] {
  return input
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 10)
}

function normalizeImportedShiftJobs(raw: unknown): ShiftJobConfig[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null
      }
      const job = row as { id?: unknown; name?: unknown; hourlyRate?: unknown }
      const name = typeof job.name === 'string' ? job.name.trim() : ''
      const hourlyRate = Number(job.hourlyRate)
      if (!name || !Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        return null
      }
      const id = typeof job.id === 'string' && job.id.trim() ? job.id : makeId()
      return { id, name, hourlyRate }
    })
    .filter((job): job is ShiftJobConfig => job !== null)
}

function normalizeCurrency(value: unknown): SupportedCurrency {
  if (typeof value !== 'string') {
    return defaultSettings.currency
  }
  const upper = value.toUpperCase()
  return SUPPORTED_CURRENCIES.includes(upper as SupportedCurrency) ? (upper as SupportedCurrency) : defaultSettings.currency
}

function normalizeImportedSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') {
    return defaultSettings
  }
  const candidate = raw as Partial<Settings> & { shiftJobs?: unknown; defaultShiftJobId?: unknown }
  const shiftJobs = normalizeImportedShiftJobs(candidate.shiftJobs)
  const defaultShiftJobId =
    typeof candidate.defaultShiftJobId === 'string' && shiftJobs.some((job) => job.id === candidate.defaultShiftJobId)
      ? candidate.defaultShiftJobId
      : shiftJobs[0]?.id ?? ''

  return {
    ...defaultSettings,
    ...candidate,
    currency: normalizeCurrency(candidate.currency),
    shiftJobs,
    defaultShiftJobId,
  }
}

function normalizeImportedUiState(raw: unknown): UiState {
  if (!raw || typeof raw !== 'object') {
    return defaultUiState
  }
  const candidate = raw as Partial<UiState>
  return {
    ...defaultUiState,
    ...candidate,
  }
}

const MAX_BACKGROUND_FILE_BYTES = 3 * 1024 * 1024

interface UpdaterHandle {
  currentVersion: string
  version: string
  date?: string
  body?: string
  downloadAndInstall: () => Promise<void>
  close: () => Promise<void>
}

function readFileAsDataUrl(file: File, language: AppLanguage): Promise<string> {
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

async function safelyCloseUpdateHandle(handle: UpdaterHandle | null): Promise<void> {
  if (!handle) {
    return
  }
  try {
    await handle.close()
  } catch {
    // Ignore close errors. They are non-fatal and should not block update checks.
  }
}

function resolveInitialProfileName(): string {
  const locale = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'en'
  return locale.startsWith('de') ? 'Standard' : 'Default'
}

function resolveUniqueProfileName(name: string, profiles: UserProfile[], language: AppLanguage): string {
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

async function hashSecret(secret: string): Promise<string> {
  const normalized = secret.trim()
  if (!normalized) {
    return ''
  }
  const data = new TextEncoder().encode(normalized)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = Array.from(new Uint8Array(digest))
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function buildInitialProfileState(): { profiles: UserProfile[]; activeProfileId: string } {
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
  const activeProfileId = loadActiveProfileId(profiles) || profiles[0]?.id || ''
  if (activeProfileId) {
    saveActiveProfileId(activeProfileId)
  }
  return { profiles, activeProfileId }
}

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const initialProfileState = useMemo(() => buildInitialProfileState(), [])
  const [loading, setLoading] = useState(true)
  const [profiles, setProfilesState] = useState<UserProfile[]>(initialProfileState.profiles)
  const [activeProfileId, setActiveProfileIdState] = useState<string>(initialProfileState.activeProfileId)
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings(initialProfileState.activeProfileId))
  const [backgroundImageDataUrl, setBackgroundImageDataUrlState] = useState<string | null>(() => loadBackgroundImageDataUrl(initialProfileState.activeProfileId))
  const [uiState, setUiStateState] = useState<UiState>(() => loadUiState(initialProfileState.activeProfileId))
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([])
  const [scenarios, setScenarios] = useState<InterestScenario[]>([])
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [pendingUpdate, setPendingUpdate] = useState<UpdaterHandle | null>(null)
  const [updatePrompt, setUpdatePrompt] = useState<UpdatePrompt | null>(null)
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false)
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false)
  const [updateCheckError, setUpdateCheckError] = useState<string | null>(null)
  const [skippedUpdateVersion, setSkippedUpdateVersion] = useState<string>(() => loadSkippedUpdateVersion(initialProfileState.activeProfileId))

  const updatesSupported = isTauriRuntime()
  const activeProfile = useMemo(() => profiles.find((profile) => profile.id === activeProfileId) ?? null, [activeProfileId, profiles])
  const needsOnboarding = Boolean(activeProfile && !activeProfile.onboardingCompleted)
  const canExitOnboarding = useMemo(
    () => needsOnboarding && profiles.some((profile) => profile.id !== activeProfileId && profile.onboardingCompleted),
    [activeProfileId, needsOnboarding, profiles],
  )

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const pushToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = makeId()
      setToasts((current) => [...current.filter((item) => item.tone !== 'error'), { id, expiresInMs: 7000, ...toast }])
      if ((toast.expiresInMs ?? 7000) > 0) {
        window.setTimeout(() => dismissToast(id), toast.expiresInMs ?? 7000)
      }
    },
    [dismissToast],
  )

  useEffect(() => {
    if (!activeProfileId) {
      return
    }
    let mounted = true
    async function boot(): Promise<void> {
      setLoading(true)
      try {
        const [loadedSubscriptions, loadedIncomeEntries, loadedScenarios] = await Promise.all([
          listSubscriptions(activeProfileId),
          listIncomeEntries(activeProfileId),
          listInterestScenarios(activeProfileId),
        ])
        if (!mounted) {
          return
        }
        setSettingsState(loadSettings(activeProfileId))
        setUiStateState(loadUiState(activeProfileId))
        setBackgroundImageDataUrlState(loadBackgroundImageDataUrl(activeProfileId))
        setSkippedUpdateVersion(loadSkippedUpdateVersion(activeProfileId))
        setSubscriptions(loadedSubscriptions)
        setIncomeEntries(loadedIncomeEntries)
        setScenarios(loadedScenarios)
        setProfilesState((current) => {
          const timestamp = nowIso()
          const next = current.map((profile) =>
            profile.id === activeProfileId ? { ...profile, lastOpenedAt: timestamp, updatedAt: timestamp } : profile,
          )
          saveProfiles(next)
          return next
        })
      } catch (error) {
        if (mounted) {
          pushToast({
            tone: 'error',
            text: error instanceof Error ? error.message : tx(settings.language, 'Lokale Daten konnten nicht geladen werden.', 'Local data could not be loaded.'),
            expiresInMs: 0,
          })
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }
    void boot()
    return () => {
      mounted = false
    }
  }, [activeProfileId, pushToast, settings.language])

  useEffect(() => {
    if (!activeProfileId) {
      return
    }
    saveSettings(activeProfileId, settings)
  }, [activeProfileId, settings])

  useEffect(() => {
    if (!activeProfileId) {
      return
    }
    saveUiState(activeProfileId, uiState)
  }, [activeProfileId, uiState])

  useEffect(() => {
    if (!activeProfileId) {
      return
    }
    saveSkippedUpdateVersion(activeProfileId, skippedUpdateVersion)
  }, [activeProfileId, skippedUpdateVersion])

  const setSettings = useCallback((changes: Partial<Settings>) => {
    setSettingsState((current) => ({
      ...current,
      ...changes,
      ...(changes.currency !== undefined ? { currency: normalizeCurrency(changes.currency) } : {}),
    }))
  }, [])

  const setUiState = useCallback((changes: Partial<UiState>) => {
    setUiStateState((current) => ({ ...current, ...changes }))
  }, [])

  const createProfile = useCallback(
    (name: string) => {
      const profileName = resolveUniqueProfileName(name, profiles, settings.language)
      const nextProfile = makeProfile(profileName, { onboardingCompleted: false })
      const nextProfiles = [...profiles, nextProfile]
      saveProfiles(nextProfiles)
      saveActiveProfileId(nextProfile.id)
      setProfilesState(nextProfiles)
      setActiveProfileIdState(nextProfile.id)
      pushToast({ tone: 'success', text: tx(settings.language, 'Profil erstellt.', 'Profile created.') })
    },
    [profiles, pushToast, settings.language],
  )

  const switchProfile = useCallback(
    (profileId: string) => {
      if (!profiles.some((profile) => profile.id === profileId)) {
        return
      }
      saveActiveProfileId(profileId)
      setActiveProfileIdState(profileId)
    },
    [profiles],
  )

  const renameProfile = useCallback(
    (profileId: string, name: string) => {
      const existing = profiles.find((profile) => profile.id === profileId)
      if (!existing) {
        return
      }
      const remaining = profiles.filter((profile) => profile.id !== profileId)
      const nextName = resolveUniqueProfileName(name, remaining, settings.language)
      const nextProfiles = profiles.map((profile) =>
        profile.id === profileId ? { ...profile, name: nextName, updatedAt: nowIso() } : profile,
      )
      saveProfiles(nextProfiles)
      setProfilesState(nextProfiles)
    },
    [profiles, settings.language],
  )

  const deleteProfile = useCallback(
    async (profileId: string) => {
      if (!profiles.some((profile) => profile.id === profileId)) {
        return
      }
      if (profiles.length <= 1) {
        throw new Error(tx(settings.language, 'Mindestens ein Profil muss bestehen bleiben.', 'At least one profile must remain.'))
      }
      await Promise.all([
        replaceSubscriptions(profileId, []),
        replaceIncomeEntries(profileId, []),
        replaceInterestScenarios(profileId, []),
      ])
      clearPersistedPreferences(profileId)
      await deleteProfileDb(profileId)
      clearRepositoryCache(profileId)

      const nextProfiles = profiles.filter((profile) => profile.id !== profileId)
      const nextActiveId = activeProfileId === profileId ? nextProfiles[0].id : activeProfileId
      saveProfiles(nextProfiles)
      saveActiveProfileId(nextActiveId)
      setProfilesState(nextProfiles)
      setActiveProfileIdState(nextActiveId)
      pushToast({ tone: 'success', text: tx(settings.language, 'Profil gelöscht.', 'Profile deleted.') })
    },
    [activeProfileId, profiles, pushToast, settings.language],
  )

  const completeOnboarding = useCallback(
    async (payload: OnboardingSetupInput) => {
      if (!activeProfileId) {
        return
      }

      const profileName = payload.profileName.trim()
      if (!profileName) {
        throw new Error(tx(payload.language, 'Bitte gib einen Profilnamen ein.', 'Please enter a profile name.'))
      }

      const secret = payload.authSecret?.trim() ?? ''
      if (payload.authMode === 'pin' && !/^\d{4,8}$/.test(secret)) {
        throw new Error(
          tx(
            payload.language,
            'PIN muss aus 4 bis 8 Ziffern bestehen.',
            'PIN must be 4 to 8 digits.',
          ),
        )
      }
      if (payload.authMode === 'password' && secret.length < 6) {
        throw new Error(
          tx(
            payload.language,
            'Passwort muss mindestens 6 Zeichen lang sein.',
            'Password must be at least 6 characters long.',
          ),
        )
      }
      const authSecretHash = payload.authMode === 'none' ? '' : await hashSecret(secret)

      const normalizedRate = Number(payload.jobHourlyRate)
      const jobName = payload.jobName?.trim() ?? ''
      const shouldCreateJob = Boolean(jobName) && Number.isFinite(normalizedRate) && normalizedRate > 0
      const shiftJobs: ShiftJobConfig[] = shouldCreateJob ? [{ id: `job-${crypto.randomUUID()}`, name: jobName, hourlyRate: normalizedRate }] : []
      setSettingsState((current) => ({
        ...current,
        language: payload.language,
        theme: payload.theme,
        currency: payload.currency,
        dateFormat: payload.dateFormat,
        shiftJobs,
        defaultShiftJobId: shiftJobs[0]?.id ?? '',
      }))
      setProfilesState((current) => {
        const timestamp = nowIso()
        const remaining = current.filter((profile) => profile.id !== activeProfileId)
        const nextProfileName = resolveUniqueProfileName(profileName, remaining, payload.language)
        const next = current.map((profile) =>
          profile.id === activeProfileId
            ? {
                ...profile,
                name: nextProfileName,
                onboardingCompleted: true,
                authMode: payload.authMode,
                authSecretHash,
                updatedAt: timestamp,
              }
            : profile,
        )
        saveProfiles(next)
        return next
      })
      pushToast({ tone: 'success', text: tx(payload.language, 'Einrichtung abgeschlossen.', 'Setup completed.') })
    },
    [activeProfileId, pushToast],
  )

  const exitOnboarding = useCallback(() => {
    if (!activeProfileId) {
      return
    }
    const fallback = profiles.find((profile) => profile.id !== activeProfileId && profile.onboardingCompleted)
    if (!fallback) {
      return
    }
    saveActiveProfileId(fallback.id)
    setActiveProfileIdState(fallback.id)
  }, [activeProfileId, profiles])

  const updateProfileProtection = useCallback(
    async (profileId: string, authMode: UserProfile['authMode'], authSecret?: string) => {
      const target = profiles.find((profile) => profile.id === profileId)
      if (!target) {
        throw new Error(tx(settings.language, 'Profil nicht gefunden.', 'Profile not found.'))
      }

      const secret = authSecret?.trim() ?? ''
      const canKeepExisting = secret.length === 0 && target.authMode === authMode && Boolean(target.authSecretHash)
      let nextHash = authMode === 'none' ? '' : target.authSecretHash
      if (authMode === 'pin') {
        if (!canKeepExisting && !/^\d{4,8}$/.test(secret)) {
          throw new Error(tx(settings.language, 'PIN muss aus 4 bis 8 Ziffern bestehen.', 'PIN must be 4 to 8 digits.'))
        }
        if (!canKeepExisting) {
          nextHash = await hashSecret(secret)
        }
      }
      if (authMode === 'password') {
        if (!canKeepExisting && secret.length < 6) {
          throw new Error(tx(settings.language, 'Passwort muss mindestens 6 Zeichen lang sein.', 'Password must be at least 6 characters long.'))
        }
        if (!canKeepExisting) {
          nextHash = await hashSecret(secret)
        }
      }

      const nextProfiles = profiles.map((profile) =>
        profile.id === profileId
          ? { ...profile, authMode, authSecretHash: nextHash, updatedAt: nowIso() }
          : profile,
      )
      saveProfiles(nextProfiles)
      setProfilesState(nextProfiles)
      pushToast({ tone: 'success', text: tx(settings.language, 'Profilschutz aktualisiert.', 'Profile protection updated.') })
    },
    [profiles, pushToast, settings.language],
  )

  const setBackgroundImageFromFile = useCallback(
    async (file: File) => {
      if (!activeProfileId) {
        return
      }
      if (!file.type.startsWith('image/')) {
        throw new Error(tx(settings.language, 'Bitte wähle eine Bilddatei aus.', 'Please select an image file.'))
      }
      if (file.size > MAX_BACKGROUND_FILE_BYTES) {
        throw new Error(tx(settings.language, 'Bild ist zu groß. Bitte eine Datei unter 3 MB wählen.', 'Image is too large. Please choose a file under 3 MB.'))
      }
      const dataUrl = await readFileAsDataUrl(file, settings.language)
      try {
        saveBackgroundImageDataUrl(activeProfileId, dataUrl)
      } catch {
        throw new Error(tx(settings.language, 'Bild konnte lokal nicht gespeichert werden. Bitte ein kleineres Bild versuchen.', 'Image could not be saved locally. Please try a smaller image.'))
      }
      setBackgroundImageDataUrlState(dataUrl)
      pushToast({ tone: 'success', text: tx(settings.language, 'Hintergrundbild aktualisiert.', 'Background image updated.') })
    },
    [activeProfileId, pushToast, settings.language],
  )

  const clearBackgroundImage = useCallback(() => {
    if (!activeProfileId) {
      return
    }
    clearBackgroundImageDataUrl(activeProfileId)
    setBackgroundImageDataUrlState(null)
    pushToast({ tone: 'success', text: tx(settings.language, 'Hintergrundbild entfernt.', 'Background image removed.') })
  }, [activeProfileId, pushToast, settings.language])

  const addSubscription = useCallback(
    async (payload: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!activeProfileId) {
        return
      }
      ensurePositiveNumber(payload.amount, tx(settings.language, 'Abo-Betrag', 'Subscription amount'), settings.language)
      if (!payload.name.trim()) {
        throw new Error(tx(settings.language, 'Abo-Name ist erforderlich.', 'Subscription name is required.'))
      }
      if (payload.customIntervalMonths && payload.customIntervalMonths < 1) {
        throw new Error(tx(settings.language, 'Eigenes Intervall in Monaten muss mindestens 1 sein.', 'Custom interval in months must be at least 1.'))
      }
      const timestamp = nowIso()
      const next: Subscription = {
        ...payload,
        id: makeId(),
        tags: normalizeTags(payload.tags),
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await saveSubscription(activeProfileId, next)
      setSubscriptions((current) => [next, ...current])
      pushToast({ tone: 'success', text: tx(settings.language, 'Abo gespeichert.', 'Subscription saved.') })
    },
    [activeProfileId, pushToast, settings.language],
  )

  const updateSubscription = useCallback(
    async (id: string, payload: Partial<Subscription>) => {
      if (!activeProfileId) {
        return
      }
      const existing = subscriptions.find((item) => item.id === id)
      if (!existing) {
        throw new Error(tx(settings.language, 'Abo nicht gefunden.', 'Subscription not found.'))
      }
      const merged: Subscription = {
        ...existing,
        ...payload,
        tags: payload.tags ? normalizeTags(payload.tags) : existing.tags,
        updatedAt: nowIso(),
      }
      ensurePositiveNumber(merged.amount, tx(settings.language, 'Abo-Betrag', 'Subscription amount'), settings.language)
      await saveSubscription(activeProfileId, merged)
      setSubscriptions((current) => current.map((item) => (item.id === id ? merged : item)))
      pushToast({ tone: 'success', text: tx(settings.language, 'Abo aktualisiert.', 'Subscription updated.') })
    },
    [activeProfileId, pushToast, settings.language, subscriptions],
  )

  const deleteSubscription = useCallback(
    async (id: string) => {
      if (!activeProfileId) {
        return
      }
      const existing = subscriptions.find((item) => item.id === id)
      if (!existing) {
        return
      }
      await removeSubscription(activeProfileId, id)
      setSubscriptions((current) => current.filter((item) => item.id !== id))
      pushToast({
        tone: 'warning',
        text: tx(settings.language, 'Abo gelöscht.', 'Subscription deleted.'),
        actionLabel: tx(settings.language, 'Rückgängig', 'Undo'),
        action: () => {
          void saveSubscription(activeProfileId, existing).then(() => setSubscriptions((current) => [existing, ...current]))
        },
      })
    },
    [activeProfileId, pushToast, settings.language, subscriptions],
  )

  const addIncomeEntry = useCallback(
    async (payload: Omit<IncomeEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!activeProfileId) {
        return
      }
      ensurePositiveNumber(payload.amount, tx(settings.language, 'Einkommensbetrag', 'Income amount'), settings.language)
      if (!payload.source.trim()) {
        throw new Error(tx(settings.language, 'Einkommensquelle ist erforderlich.', 'Income source is required.'))
      }
      const timestamp = nowIso()
      const next: IncomeEntry = {
        ...payload,
        id: makeId(),
        tags: normalizeTags(payload.tags),
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await saveIncomeEntry(activeProfileId, next)
      setIncomeEntries((current) => [next, ...current])
      pushToast({ tone: 'success', text: tx(settings.language, 'Einkommenseintrag gespeichert.', 'Income entry saved.') })
    },
    [activeProfileId, pushToast, settings.language],
  )

  const updateIncomeEntry = useCallback(
    async (id: string, payload: Partial<IncomeEntry>) => {
      if (!activeProfileId) {
        return
      }
      const existing = incomeEntries.find((item) => item.id === id)
      if (!existing) {
        throw new Error(tx(settings.language, 'Einkommenseintrag nicht gefunden.', 'Income entry not found.'))
      }
      const merged: IncomeEntry = {
        ...existing,
        ...payload,
        tags: payload.tags ? normalizeTags(payload.tags) : existing.tags,
        updatedAt: nowIso(),
      }
      ensurePositiveNumber(merged.amount, tx(settings.language, 'Einkommensbetrag', 'Income amount'), settings.language)
      await saveIncomeEntry(activeProfileId, merged)
      setIncomeEntries((current) => current.map((item) => (item.id === id ? merged : item)))
      pushToast({ tone: 'success', text: tx(settings.language, 'Einkommenseintrag aktualisiert.', 'Income entry updated.') })
    },
    [activeProfileId, incomeEntries, pushToast, settings.language],
  )

  const deleteIncomeEntry = useCallback(
    async (id: string) => {
      if (!activeProfileId) {
        return
      }
      const existing = incomeEntries.find((item) => item.id === id)
      if (!existing) {
        return
      }
      await removeIncomeEntry(activeProfileId, id)
      setIncomeEntries((current) => current.filter((item) => item.id !== id))
      pushToast({
        tone: 'warning',
        text: tx(settings.language, 'Einkommenseintrag gelöscht.', 'Income entry deleted.'),
        actionLabel: tx(settings.language, 'Rückgängig', 'Undo'),
        action: () => {
          void saveIncomeEntry(activeProfileId, existing).then(() => setIncomeEntries((current) => [existing, ...current]))
        },
      })
    },
    [activeProfileId, incomeEntries, pushToast, settings.language],
  )

  const addScenario = useCallback(
    async (payload: InterestScenarioInput) => {
      if (!activeProfileId) {
        return
      }
      const timestamp = nowIso()
      const next: InterestScenario = {
        id: makeId(),
        input: payload,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await saveInterestScenario(activeProfileId, next)
      setScenarios((current) => [next, ...current])
      pushToast({ tone: 'success', text: tx(settings.language, 'Szenario gespeichert.', 'Scenario saved.') })
    },
    [activeProfileId, pushToast, settings.language],
  )

  const updateScenario = useCallback(
    async (id: string, payload: InterestScenarioInput) => {
      if (!activeProfileId) {
        return
      }
      const existing = scenarios.find((item) => item.id === id)
      if (!existing) {
        throw new Error(tx(settings.language, 'Szenario nicht gefunden.', 'Scenario not found.'))
      }
      const merged: InterestScenario = { ...existing, input: payload, updatedAt: nowIso() }
      await saveInterestScenario(activeProfileId, merged)
      setScenarios((current) => current.map((item) => (item.id === id ? merged : item)))
      pushToast({ tone: 'success', text: tx(settings.language, 'Szenario aktualisiert.', 'Scenario updated.') })
    },
    [activeProfileId, pushToast, scenarios, settings.language],
  )

  const deleteScenario = useCallback(
    async (id: string) => {
      if (!activeProfileId) {
        return
      }
      await removeInterestScenario(activeProfileId, id)
      setScenarios((current) => current.filter((item) => item.id !== id))
      pushToast({ tone: 'success', text: tx(settings.language, 'Szenario entfernt.', 'Scenario removed.') })
    },
    [activeProfileId, pushToast, settings.language],
  )

  const exportBackup = useCallback((): AppBackup => {
    const profileMeta: ProfileBackupPayload['meta'] = activeProfile
      ? {
          id: activeProfile.id,
          name: activeProfile.name,
          createdAt: activeProfile.createdAt,
          updatedAt: activeProfile.updatedAt,
          lastOpenedAt: activeProfile.lastOpenedAt,
          onboardingCompleted: activeProfile.onboardingCompleted,
          authMode: activeProfile.authMode,
          authSecretHash: activeProfile.authSecretHash,
        }
      : {
          id: activeProfileId || DEFAULT_PROFILE_ID,
          name: 'User',
          createdAt: nowIso(),
          updatedAt: nowIso(),
          lastOpenedAt: nowIso(),
          onboardingCompleted: false,
          authMode: 'none',
          authSecretHash: '',
        }
    return {
      backupSchema: 2,
      exportedAt: nowIso(),
      scope: 'single-profile',
      activeProfileId,
      profile: {
        meta: profileMeta,
        settings,
        uiState,
        backgroundImageDataUrl,
        subscriptions,
        incomeEntries,
        interestScenarios: scenarios,
      },
    }
  }, [activeProfile, activeProfileId, backgroundImageDataUrl, incomeEntries, scenarios, settings, subscriptions, uiState])

  const importBackup = useCallback(
    async (payload: AppBackup, mode: 'replace' | 'merge') => {
      if (!activeProfileId) {
        throw new Error(tx(settings.language, 'Kein aktives Profil gefunden.', 'No active profile found.'))
      }
      if (payload.scope === 'all-profiles') {
        throw new Error(
          tx(
            settings.language,
            'Voll-Backups mit mehreren Profilen können aktuell nicht importiert werden.',
            'Full backups with multiple profiles cannot be imported yet.',
          ),
        )
      }
      const sourceProfile =
        payload.profile && typeof payload.profile === 'object'
          ? payload.profile
          : {
              meta: {
                id: activeProfileId,
                name: activeProfile?.name ?? 'User',
                createdAt: activeProfile?.createdAt ?? nowIso(),
                updatedAt: nowIso(),
                lastOpenedAt: nowIso(),
                onboardingCompleted: activeProfile?.onboardingCompleted ?? true,
              },
              settings: payload.settings ?? defaultSettings,
              uiState: payload.uiState ?? defaultUiState,
              backgroundImageDataUrl: payload.backgroundImageDataUrl ?? null,
              subscriptions: payload.subscriptions ?? [],
              incomeEntries: payload.incomeEntries ?? [],
              interestScenarios: payload.interestScenarios ?? [],
            }
      const safeSubscriptions = Array.isArray(sourceProfile.subscriptions) ? sourceProfile.subscriptions : []
      const safeIncomeEntries = Array.isArray(sourceProfile.incomeEntries) ? sourceProfile.incomeEntries : []
      const safeScenarios = Array.isArray(sourceProfile.interestScenarios) ? sourceProfile.interestScenarios : []
      const mergedSubscriptions = mode === 'replace' ? safeSubscriptions : uniqueById([...subscriptions, ...safeSubscriptions])
      const mergedIncome = mode === 'replace' ? safeIncomeEntries : uniqueById([...incomeEntries, ...safeIncomeEntries])
      const mergedScenarios = mode === 'replace' ? safeScenarios : uniqueById([...scenarios, ...safeScenarios])

      await Promise.all([
        replaceSubscriptions(activeProfileId, mergedSubscriptions),
        replaceIncomeEntries(activeProfileId, mergedIncome),
        replaceInterestScenarios(activeProfileId, mergedScenarios),
      ])

      setSubscriptions(mergedSubscriptions)
      setIncomeEntries(mergedIncome)
      setScenarios(mergedScenarios)
      if (mode === 'replace') {
        const normalizedSettings = normalizeImportedSettings(sourceProfile.settings)
        const normalizedUiState = normalizeImportedUiState(sourceProfile.uiState)
        setSettingsState(normalizedSettings)
        setUiStateState(normalizedUiState)
        if (typeof sourceProfile.backgroundImageDataUrl === 'string' && sourceProfile.backgroundImageDataUrl.startsWith('data:image/')) {
          saveBackgroundImageDataUrl(activeProfileId, sourceProfile.backgroundImageDataUrl)
          setBackgroundImageDataUrlState(sourceProfile.backgroundImageDataUrl)
        } else {
          clearBackgroundImageDataUrl(activeProfileId)
          setBackgroundImageDataUrlState(null)
        }
      }
      pushToast({
        tone: 'success',
        text:
          mode === 'replace'
            ? tx(settings.language, 'Backup importiert (ersetzen).', 'Backup imported (replace).')
            : tx(settings.language, 'Backup importiert (zusammenführen).', 'Backup imported (merge).'),
      })
    },
    [activeProfile, activeProfileId, incomeEntries, pushToast, scenarios, settings.language, subscriptions],
  )

  const dismissUpdatePrompt = useCallback(() => {
    setUpdatePrompt(null)
    setPendingUpdate((current) => {
      void safelyCloseUpdateHandle(current)
      return null
    })
  }, [])

  const skipUpdateVersion = useCallback(() => {
    if (!updatePrompt) {
      return
    }
    setSkippedUpdateVersion(updatePrompt.version)
    dismissUpdatePrompt()
    pushToast({
      tone: 'info',
      text: tx(
        settings.language,
        `Version ${updatePrompt.version} wird bis zur nächsten Version übersprungen.`,
        `Version ${updatePrompt.version} will be skipped until the next version.`,
      ),
    })
  }, [dismissUpdatePrompt, pushToast, settings.language, updatePrompt])

  const checkForUpdates = useCallback(
    async (options?: { manual?: boolean }): Promise<boolean> => {
      const manual = Boolean(options?.manual)
      if (!updatesSupported) {
        if (manual) {
          pushToast({
            tone: 'info',
            text: tx(
              settings.language,
              'Updates werden nur in der Desktop-App unterstützt.',
              'Updates are only supported in the desktop app.',
            ),
          })
        }
        return false
      }

      setIsCheckingForUpdates(true)
      setUpdateCheckError(null)

      try {
        const { check } = await import('@tauri-apps/plugin-updater')
        const update = await check()

        if (!update) {
          dismissUpdatePrompt()
          if (manual) {
            pushToast({
              tone: 'success',
              text: tx(settings.language, 'Kein Update verfügbar. Du bist aktuell.', 'No update available. You are up to date.'),
            })
          }
          return false
        }

        if (!manual && skippedUpdateVersion && skippedUpdateVersion === update.version) {
          await update.close()
          return false
        }

        setPendingUpdate((current) => {
          void safelyCloseUpdateHandle(current)
          return {
            currentVersion: update.currentVersion,
            version: update.version,
            date: update.date,
            body: update.body,
            downloadAndInstall: () => update.downloadAndInstall(),
            close: () => update.close(),
          }
        })
        setUpdatePrompt({
          currentVersion: update.currentVersion,
          version: update.version,
          date: update.date,
          body: update.body,
        })
        setSkippedUpdateVersion((current) => (current === update.version ? '' : current))
        return true
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : tx(settings.language, 'Update-Prüfung ist fehlgeschlagen.', 'Update check failed.')
        setUpdateCheckError(message)
        if (manual) {
          pushToast({ tone: 'error', text: message, expiresInMs: 0 })
        }
        return false
      } finally {
        setIsCheckingForUpdates(false)
      }
    },
    [dismissUpdatePrompt, pushToast, settings.language, skippedUpdateVersion, updatesSupported],
  )

  const installUpdate = useCallback(async () => {
    if (!pendingUpdate) {
      throw new Error(tx(settings.language, 'Kein Update zum Installieren verfügbar.', 'No update available to install.'))
    }

    setIsInstallingUpdate(true)
    setUpdateCheckError(null)
    try {
      await pendingUpdate.downloadAndInstall()
      pushToast({
        tone: 'success',
        text: tx(settings.language, 'Update wird installiert. App startet ggf. neu.', 'Update is being installed. The app may restart.'),
      })
      await safelyCloseUpdateHandle(pendingUpdate)
      setSkippedUpdateVersion('')
      setUpdatePrompt(null)
      setPendingUpdate(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : tx(settings.language, 'Update-Installation fehlgeschlagen.', 'Update installation failed.')
      setUpdateCheckError(message)
      pushToast({ tone: 'error', text: message, expiresInMs: 0 })
      throw error
    } finally {
      setIsInstallingUpdate(false)
    }
  }, [pendingUpdate, pushToast, settings.language])

  const clearAllData = useCallback(async () => {
    for (const profile of profiles) {
      await Promise.all([
        replaceSubscriptions(profile.id, []),
        replaceIncomeEntries(profile.id, []),
        replaceInterestScenarios(profile.id, []),
      ])
      clearPersistedPreferences(profile.id)
      await deleteProfileDb(profile.id)
      clearRepositoryCache(profile.id)
    }
    const nextProfile = makeProfile(resolveInitialProfileName(), { id: DEFAULT_PROFILE_ID, onboardingCompleted: false })
    saveProfiles([nextProfile])
    saveActiveProfileId(nextProfile.id)
    setPendingUpdate((current) => {
      void safelyCloseUpdateHandle(current)
      return null
    })
    setUpdatePrompt(null)
    setSkippedUpdateVersion('')
    setUpdateCheckError(null)
    setProfilesState([nextProfile])
    setActiveProfileIdState(nextProfile.id)
    setSubscriptions([])
    setIncomeEntries([])
    setScenarios([])
    setSettingsState(defaultSettings)
    setUiStateState(defaultUiState)
    setBackgroundImageDataUrlState(null)
    pushToast({ tone: 'warning', text: tx(settings.language, 'Alle lokalen Daten wurden gelöscht.', 'All local data has been deleted.') })
  }, [profiles, pushToast, settings.language])

  const contextValue = useMemo<AppContextValue>(
    () => ({
      loading,
      subscriptions,
      incomeEntries,
      scenarios,
      settings,
      backgroundImageDataUrl,
      uiState,
      toasts,
      profiles,
      activeProfileId,
      activeProfile,
      needsOnboarding,
      canExitOnboarding,
      updatesSupported,
      isCheckingForUpdates,
      isInstallingUpdate,
      skippedUpdateVersion,
      updatePrompt,
      updateCheckError,
      setSettings,
      setUiState,
      setBackgroundImageFromFile,
      clearBackgroundImage,
      createProfile,
      switchProfile,
      renameProfile,
      deleteProfile,
      completeOnboarding,
      exitOnboarding,
      updateProfileProtection,
      addSubscription,
      updateSubscription,
      deleteSubscription,
      addIncomeEntry,
      updateIncomeEntry,
      deleteIncomeEntry,
      addScenario,
      updateScenario,
      deleteScenario,
      exportBackup,
      importBackup,
      clearAllData,
      checkForUpdates,
      installUpdate,
      skipUpdateVersion,
      dismissUpdatePrompt,
      dismissToast,
    }),
    [
      addIncomeEntry,
      addScenario,
      addSubscription,
      activeProfile,
      activeProfileId,
      canExitOnboarding,
      checkForUpdates,
      completeOnboarding,
      createProfile,
      dismissUpdatePrompt,
      deleteIncomeEntry,
      deleteProfile,
      deleteScenario,
      deleteSubscription,
      dismissToast,
      clearAllData,
      exitOnboarding,
      exportBackup,
      importBackup,
      incomeEntries,
      isCheckingForUpdates,
      isInstallingUpdate,
      loading,
      needsOnboarding,
      profiles,
      renameProfile,
      updateProfileProtection,
      scenarios,
      setSettings,
      setUiState,
      setBackgroundImageFromFile,
      clearBackgroundImage,
      settings,
      backgroundImageDataUrl,
      skippedUpdateVersion,
      skipUpdateVersion,
      subscriptions,
      switchProfile,
      toasts,
      uiState,
      updateCheckError,
      updatePrompt,
      updateIncomeEntry,
      updatesSupported,
      updateScenario,
      installUpdate,
      updateSubscription,
    ],
  )

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
}

