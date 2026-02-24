import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  clearPersistedPreferences,
  clearBackgroundImageDataUrl,
  defaultSettings,
  defaultUiState,
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
  makeProfile,
  saveActiveProfileId,
  saveProfiles,
} from '../data/profileStore'
import type {
  AppBackup,
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
import {
  MAX_BACKGROUND_FILE_BYTES,
  buildInitialProfileState,
  collapsePendingProfiles,
  ensurePositiveNumber,
  hashSecret,
  loadPersistedProfilePreferences,
  makeId,
  normalizeCurrency,
  normalizeImportedSettings,
  normalizeImportedUiState,
  normalizeTags,
  nowIso,
  readFileAsDataUrl,
  resolveUniqueProfileName,
  uniqueById,
} from './appContextHelpers'
import { useAppUpdates } from './useAppUpdates'

export interface OnboardingSetupInput {
  language: Settings['language']
  theme: Settings['theme']
  currency: Settings['currency']
  dateFormat: Settings['dateFormat']
  profileName: string
  authMode: 'none' | 'pin' | 'password'
  authSecret?: string
  jobEmploymentType?: ShiftJobConfig['employmentType']
  jobName?: string
  jobHourlyRate?: number
  jobSalaryAmount?: number
  jobFixedPayInterval?: NonNullable<ShiftJobConfig['fixedPayInterval']>
  jobHas13thSalary?: boolean
  jobHas14thSalary?: boolean
  jobStartDate?: string
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
  isProfileLocked: boolean
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
  updateProfileAvatar: (profileId: string, avatarDataUrl: string | null) => Promise<void>
  deleteProfile: (profileId: string) => Promise<void>
  completeOnboarding: (payload: OnboardingSetupInput) => Promise<void>
  exitOnboarding: () => void
  updateProfileProtection: (profileId: string, authMode: UserProfile['authMode'], authSecret?: string) => Promise<void>
  unlockActiveProfile: (authSecret: string) => Promise<void>
  lockActiveProfile: () => void
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

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const initialProfileState = useMemo(() => buildInitialProfileState(), [])
  const initialPersistedPreferences = useMemo(
    () => loadPersistedProfilePreferences(initialProfileState.activeProfileId),
    [initialProfileState.activeProfileId],
  )
  const [loading, setLoading] = useState(true)
  const [profiles, setProfilesState] = useState<UserProfile[]>(initialProfileState.profiles)
  const [activeProfileId, setActiveProfileIdState] = useState<string>(initialProfileState.activeProfileId)
  const [settings, setSettingsState] = useState<Settings>(initialPersistedPreferences.settings)
  const [backgroundImageDataUrl, setBackgroundImageDataUrlState] = useState<string | null>(
    initialPersistedPreferences.backgroundImageDataUrl,
  )
  const [uiState, setUiStateState] = useState<UiState>(initialPersistedPreferences.uiState)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([])
  const [scenarios, setScenarios] = useState<InterestScenario[]>([])
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [skippedUpdateVersion, setSkippedUpdateVersion] = useState<string>(initialPersistedPreferences.skippedUpdateVersion)
  const [isActiveProfileUnlocked, setIsActiveProfileUnlocked] = useState(false)
  const [hydratedProfileId, setHydratedProfileId] = useState('')

  const updatesSupported = isTauriRuntime()
  const activeProfile = useMemo(() => profiles.find((profile) => profile.id === activeProfileId) ?? null, [activeProfileId, profiles])
  const isProfileLocked = Boolean(activeProfile && activeProfile.authMode !== 'none' && !isActiveProfileUnlocked)
  const needsOnboarding = Boolean(activeProfile && !activeProfile.onboardingCompleted)
  const canExitOnboarding = useMemo(
    () => needsOnboarding && profiles.some((profile) => profile.id !== activeProfileId && profile.onboardingCompleted),
    [activeProfileId, needsOnboarding, profiles],
  )

  useEffect(() => {
    const collapsedPending = collapsePendingProfiles(profiles, activeProfileId)
    if (!collapsedPending.changed) {
      return
    }
    saveProfiles(collapsedPending.profiles)
    setProfilesState(collapsedPending.profiles)
    const nextActiveId = collapsedPending.profiles.some((profile) => profile.id === activeProfileId)
      ? activeProfileId
      : (collapsedPending.profiles[0]?.id ?? '')
    if (nextActiveId !== activeProfileId) {
      saveActiveProfileId(nextActiveId)
      setActiveProfileIdState(nextActiveId)
    }
  }, [activeProfileId, profiles])

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

  const {
    isCheckingForUpdates,
    isInstallingUpdate,
    updateCheckError,
    updatePrompt,
    checkForUpdates,
    installUpdate,
    skipUpdateVersion,
    dismissUpdatePrompt,
  } = useAppUpdates({
    updatesSupported,
    language: settings.language,
    skippedUpdateVersion,
    setSkippedUpdateVersion,
    pushToast,
  })

  useEffect(() => {
    if (!activeProfileId) {
      return
    }
    let mounted = true
    async function boot(): Promise<void> {
      setLoading(true)
      setHydratedProfileId('')
      try {
        const [loadedSubscriptions, loadedIncomeEntries, loadedScenarios] = await Promise.all([
          listSubscriptions(activeProfileId),
          listIncomeEntries(activeProfileId),
          listInterestScenarios(activeProfileId),
        ])
        if (!mounted) {
          return
        }
        const persistedPreferences = loadPersistedProfilePreferences(activeProfileId)
        setSettingsState(persistedPreferences.settings)
        setUiStateState(persistedPreferences.uiState)
        setBackgroundImageDataUrlState(persistedPreferences.backgroundImageDataUrl)
        setSkippedUpdateVersion(persistedPreferences.skippedUpdateVersion)
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
          setHydratedProfileId(activeProfileId)
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
    if (!activeProfileId || hydratedProfileId !== activeProfileId) {
      return
    }
    saveSettings(activeProfileId, settings)
  }, [activeProfileId, hydratedProfileId, settings])

  useEffect(() => {
    if (!activeProfileId || hydratedProfileId !== activeProfileId) {
      return
    }
    saveUiState(activeProfileId, uiState)
  }, [activeProfileId, hydratedProfileId, uiState])

  useEffect(() => {
    if (!activeProfileId || hydratedProfileId !== activeProfileId) {
      return
    }
    saveSkippedUpdateVersion(activeProfileId, skippedUpdateVersion)
  }, [activeProfileId, hydratedProfileId, skippedUpdateVersion])

  useEffect(() => {
    // Every profile switch requires a new unlock for protected profiles.
    setIsActiveProfileUnlocked(false)
  }, [activeProfileId])

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
      const existingPending = profiles.find((profile) => !profile.onboardingCompleted)
      if (existingPending) {
        saveActiveProfileId(existingPending.id)
        setActiveProfileIdState(existingPending.id)
        pushToast({
          tone: 'warning',
          text: tx(
            settings.language,
            'Ein neues Profil ist bereits in Einrichtung. Bitte schließe es zuerst ab.',
            'A new profile is already in setup. Please finish it first.',
          ),
        })
        return
      }
      const profileName = resolveUniqueProfileName(name, profiles, settings.language)
      const nextProfile = makeProfile(profileName, { onboardingCompleted: false })
      const nextProfiles = [...profiles, nextProfile]
      saveProfiles(nextProfiles)
      saveActiveProfileId(nextProfile.id)
      setProfilesState(nextProfiles)
      setActiveProfileIdState(nextProfile.id)
      pushToast({ tone: 'success', text: tx(settings.language, 'Profil-Einrichtung gestartet.', 'Profile setup started.') })
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
      setProfilesState((current) => {
        const existing = current.find((profile) => profile.id === profileId)
        if (!existing) {
          return current
        }
        const remaining = current.filter((profile) => profile.id !== profileId)
        const nextName = resolveUniqueProfileName(name, remaining, settings.language)
        const nextProfiles = current.map((profile) =>
          profile.id === profileId ? { ...profile, name: nextName, updatedAt: nowIso() } : profile,
        )
        saveProfiles(nextProfiles)
        return nextProfiles
      })
    },
    [settings.language],
  )

  const updateProfileAvatar = useCallback(
    async (profileId: string, avatarDataUrl: string | null) => {
      const target = profiles.find((profile) => profile.id === profileId)
      if (!target) {
        throw new Error(tx(settings.language, 'Profil nicht gefunden.', 'Profile not found.'))
      }
      if (avatarDataUrl && !avatarDataUrl.startsWith('data:image/')) {
        throw new Error(tx(settings.language, 'Ungültiges Profilbild.', 'Invalid profile image.'))
      }
      const nextProfiles = profiles.map((profile) =>
        profile.id === profileId
          ? { ...profile, avatarDataUrl: avatarDataUrl ?? null, updatedAt: nowIso() }
          : profile,
      )
      saveProfiles(nextProfiles)
      setProfilesState(nextProfiles)
      pushToast({
        tone: 'success',
        text: avatarDataUrl
          ? tx(settings.language, 'Profilbild aktualisiert.', 'Profile image updated.')
          : tx(settings.language, 'Profilbild entfernt.', 'Profile image removed.'),
      })
    },
    [profiles, pushToast, settings.language],
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

      const jobName = payload.jobName?.trim() ?? ''
      const jobEmploymentType = payload.jobEmploymentType ?? 'casual'
      let shiftJobs: ShiftJobConfig[] = []

      if (jobName) {
        if (jobEmploymentType === 'casual') {
          const normalizedRate = Number(payload.jobHourlyRate)
          if (!Number.isFinite(normalizedRate) || normalizedRate <= 0) {
            throw new Error(tx(payload.language, 'Bitte gib einen gültigen Stundensatz ein.', 'Please enter a valid hourly rate.'))
          }
          shiftJobs = [{ id: `job-${crypto.randomUUID()}`, name: jobName, employmentType: 'casual', hourlyRate: normalizedRate }]
        } else {
          const normalizedSalary = Number(payload.jobSalaryAmount)
          if (!Number.isFinite(normalizedSalary) || normalizedSalary <= 0) {
            throw new Error(tx(payload.language, 'Bitte gib ein gültiges Gehalt ein.', 'Please enter a valid salary amount.'))
          }
          shiftJobs = [
            {
              id: `job-${crypto.randomUUID()}`,
              name: jobName,
              employmentType: 'fixed',
              salaryAmount: normalizedSalary,
              fixedPayInterval: payload.jobFixedPayInterval ?? 'monthly',
              has13thSalary: Boolean(payload.jobHas13thSalary),
              has14thSalary: Boolean(payload.jobHas14thSalary),
              startDate: payload.jobStartDate || nowIso().slice(0, 10),
            },
          ]
        }
      }
      const defaultShiftJobId = shiftJobs.find((job) => job.employmentType === 'casual')?.id ?? ''
      const nextSettings: Settings = {
        ...settings,
        language: payload.language,
        theme: payload.theme,
        currency: payload.currency,
        dateFormat: payload.dateFormat,
        shiftJobs,
        defaultShiftJobId,
      }
      setSettingsState((current) => ({
        ...current,
        language: payload.language,
        theme: payload.theme,
        currency: payload.currency,
        dateFormat: payload.dateFormat,
        shiftJobs,
        defaultShiftJobId,
      }))
      saveSettings(activeProfileId, nextSettings)
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
      setIsActiveProfileUnlocked(payload.authMode !== 'none')
      pushToast({ tone: 'success', text: tx(payload.language, 'Einrichtung abgeschlossen.', 'Setup completed.') })
    },
    [activeProfileId, pushToast, settings],
  )

  const exitOnboarding = useCallback(() => {
    if (!activeProfileId) {
      return
    }
    const exitingProfile = profiles.find((profile) => profile.id === activeProfileId)
    const fallback = profiles.find((profile) => profile.id !== activeProfileId && profile.onboardingCompleted)
    if (!fallback) {
      return
    }
    if (exitingProfile && !exitingProfile.onboardingCompleted) {
      const nextProfiles = profiles.filter((profile) => profile.id !== activeProfileId)
      saveProfiles(nextProfiles)
      saveActiveProfileId(fallback.id)
      setProfilesState(nextProfiles)
      setActiveProfileIdState(fallback.id)
      clearPersistedPreferences(activeProfileId)
      clearRepositoryCache(activeProfileId)
      void Promise.all([
        replaceSubscriptions(activeProfileId, []),
        replaceIncomeEntries(activeProfileId, []),
        replaceInterestScenarios(activeProfileId, []),
      ])
        .then(() => deleteProfileDb(activeProfileId))
        .catch(() => undefined)
      pushToast({
        tone: 'warning',
        text: tx(
          settings.language,
          'Einrichtung abgebrochen. Neues Profil wurde verworfen.',
          'Setup canceled. New profile was discarded.',
        ),
      })
      return
    }
    saveActiveProfileId(fallback.id)
    setActiveProfileIdState(fallback.id)
  }, [activeProfileId, profiles, pushToast, settings.language])

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

      setProfilesState((current) => {
        const mergedProfiles = current.map((profile) =>
          profile.id === profileId
            ? { ...profile, authMode, authSecretHash: nextHash, updatedAt: nowIso() }
            : profile,
        )
        saveProfiles(mergedProfiles)
        return mergedProfiles
      })
      if (profileId === activeProfileId) {
        setIsActiveProfileUnlocked(authMode !== 'none')
      }
      pushToast({ tone: 'success', text: tx(settings.language, 'Profilschutz aktualisiert.', 'Profile protection updated.') })
    },
    [activeProfileId, profiles, pushToast, settings.language],
  )

  const unlockActiveProfile = useCallback(
    async (authSecret: string) => {
      if (!activeProfile) {
        throw new Error(tx(settings.language, 'Kein aktives Profil gefunden.', 'No active profile found.'))
      }
      if (activeProfile.authMode === 'none') {
        setIsActiveProfileUnlocked(true)
        return
      }

      if (!activeProfile.authSecretHash) {
        // Backward compatibility fallback for incomplete legacy profile metadata.
        setIsActiveProfileUnlocked(true)
        return
      }

      const candidateHash = await hashSecret(authSecret)
      if (!candidateHash || candidateHash !== activeProfile.authSecretHash) {
        throw new Error(tx(settings.language, 'PIN/Passwort ist nicht korrekt.', 'PIN/password is incorrect.'))
      }
      setIsActiveProfileUnlocked(true)
    },
    [activeProfile, settings.language],
  )

  const lockActiveProfile = useCallback(() => {
    setIsActiveProfileUnlocked(false)
  }, [])

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
    if (isProfileLocked) {
      throw new Error(tx(settings.language, 'Profil ist gesperrt. Bitte zuerst entsperren.', 'Profile is locked. Please unlock first.'))
    }
    const profileMeta: ProfileBackupPayload['meta'] = activeProfile
      ? {
          id: activeProfile.id,
          name: activeProfile.name,
          avatarDataUrl: activeProfile.avatarDataUrl,
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
          avatarDataUrl: null,
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
  }, [activeProfile, activeProfileId, backgroundImageDataUrl, incomeEntries, isProfileLocked, scenarios, settings, subscriptions, uiState])

  const importBackup = useCallback(
    async (payload: AppBackup, mode: 'replace' | 'merge') => {
      if (isProfileLocked) {
        throw new Error(tx(settings.language, 'Profil ist gesperrt. Bitte zuerst entsperren.', 'Profile is locked. Please unlock first.'))
      }
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
                avatarDataUrl: activeProfile?.avatarDataUrl ?? null,
                createdAt: activeProfile?.createdAt ?? nowIso(),
                updatedAt: nowIso(),
                lastOpenedAt: nowIso(),
                onboardingCompleted: activeProfile?.onboardingCompleted ?? true,
                authMode: activeProfile?.authMode ?? 'none',
                authSecretHash: activeProfile?.authSecretHash ?? '',
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
    [activeProfile, activeProfileId, incomeEntries, isProfileLocked, pushToast, scenarios, settings.language, subscriptions],
  )

  const clearAllData = useCallback(async () => {
    if (isProfileLocked) {
      throw new Error(tx(settings.language, 'Profil ist gesperrt. Bitte zuerst entsperren.', 'Profile is locked. Please unlock first.'))
    }
    if (!activeProfileId) {
      throw new Error(tx(settings.language, 'Kein aktives Profil gefunden.', 'No active profile found.'))
    }
    await Promise.all([
      replaceSubscriptions(activeProfileId, []),
      replaceIncomeEntries(activeProfileId, []),
      replaceInterestScenarios(activeProfileId, []),
    ])
    clearPersistedPreferences(activeProfileId)
    await deleteProfileDb(activeProfileId)
    clearRepositoryCache(activeProfileId)

    setSkippedUpdateVersion('')
    setSubscriptions([])
    setIncomeEntries([])
    setScenarios([])
    setSettingsState(defaultSettings)
    setUiStateState(defaultUiState)
    setBackgroundImageDataUrlState(null)
    pushToast({
      tone: 'warning',
      text: tx(
        settings.language,
        'Alle lokalen Daten dieses Profils wurden gelöscht.',
        'All local data for this profile has been deleted.',
      ),
    })
  }, [activeProfileId, isProfileLocked, pushToast, settings.language])

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
      isProfileLocked,
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
      updateProfileAvatar,
      deleteProfile,
      completeOnboarding,
      exitOnboarding,
      updateProfileProtection,
      unlockActiveProfile,
      lockActiveProfile,
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
      isProfileLocked,
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
      unlockActiveProfile,
      lockActiveProfile,
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
      updateProfileAvatar,
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



