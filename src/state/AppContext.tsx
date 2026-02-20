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
import type {
  AppBackup,
  AppLanguage,
  IncomeEntry,
  InterestScenario,
  InterestScenarioInput,
  Settings,
  ShiftJobConfig,
  Subscription,
  ToastMessage,
  UpdatePrompt,
  UiState,
} from '../types/models'
import { tx } from '../utils/i18n'
import { isTauriRuntime } from '../utils/runtime'

export interface AppContextValue {
  loading: boolean
  subscriptions: Subscription[]
  incomeEntries: IncomeEntry[]
  scenarios: InterestScenario[]
  settings: Settings
  backgroundImageDataUrl: string | null
  uiState: UiState
  toasts: ToastMessage[]
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

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const [loading, setLoading] = useState(true)
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings())
  const [backgroundImageDataUrl, setBackgroundImageDataUrlState] = useState<string | null>(() => loadBackgroundImageDataUrl())
  const [uiState, setUiStateState] = useState<UiState>(() => loadUiState())
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([])
  const [scenarios, setScenarios] = useState<InterestScenario[]>([])
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [pendingUpdate, setPendingUpdate] = useState<UpdaterHandle | null>(null)
  const [updatePrompt, setUpdatePrompt] = useState<UpdatePrompt | null>(null)
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false)
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false)
  const [updateCheckError, setUpdateCheckError] = useState<string | null>(null)
  const [skippedUpdateVersion, setSkippedUpdateVersion] = useState<string>(() => loadSkippedUpdateVersion())

  const updatesSupported = isTauriRuntime()

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
    let mounted = true
    async function boot(): Promise<void> {
      try {
        const [loadedSubscriptions, loadedIncomeEntries, loadedScenarios] = await Promise.all([
          listSubscriptions(),
          listIncomeEntries(),
          listInterestScenarios(),
        ])
        if (!mounted) {
          return
        }
        setSubscriptions(loadedSubscriptions)
        setIncomeEntries(loadedIncomeEntries)
        setScenarios(loadedScenarios)
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
  }, [pushToast, settings.language])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    saveUiState(uiState)
  }, [uiState])

  useEffect(() => {
    saveSkippedUpdateVersion(skippedUpdateVersion)
  }, [skippedUpdateVersion])

  const setSettings = useCallback((changes: Partial<Settings>) => {
    setSettingsState((current) => ({ ...current, ...changes }))
  }, [])

  const setUiState = useCallback((changes: Partial<UiState>) => {
    setUiStateState((current) => ({ ...current, ...changes }))
  }, [])

  const setBackgroundImageFromFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        throw new Error(tx(settings.language, 'Bitte wähle eine Bilddatei aus.', 'Please select an image file.'))
      }
      if (file.size > MAX_BACKGROUND_FILE_BYTES) {
        throw new Error(tx(settings.language, 'Bild ist zu groß. Bitte eine Datei unter 3 MB wählen.', 'Image is too large. Please choose a file under 3 MB.'))
      }
      const dataUrl = await readFileAsDataUrl(file, settings.language)
      try {
        saveBackgroundImageDataUrl(dataUrl)
      } catch {
        throw new Error(tx(settings.language, 'Bild konnte lokal nicht gespeichert werden. Bitte ein kleineres Bild versuchen.', 'Image could not be saved locally. Please try a smaller image.'))
      }
      setBackgroundImageDataUrlState(dataUrl)
      pushToast({ tone: 'success', text: tx(settings.language, 'Hintergrundbild aktualisiert.', 'Background image updated.') })
    },
    [pushToast, settings.language],
  )

  const clearBackgroundImage = useCallback(() => {
    clearBackgroundImageDataUrl()
    setBackgroundImageDataUrlState(null)
    pushToast({ tone: 'success', text: tx(settings.language, 'Hintergrundbild entfernt.', 'Background image removed.') })
  }, [pushToast, settings.language])

  const addSubscription = useCallback(
    async (payload: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>) => {
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
      await saveSubscription(next)
      setSubscriptions((current) => [next, ...current])
      pushToast({ tone: 'success', text: tx(settings.language, 'Abo gespeichert.', 'Subscription saved.') })
    },
    [pushToast, settings.language],
  )

  const updateSubscription = useCallback(
    async (id: string, payload: Partial<Subscription>) => {
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
      await saveSubscription(merged)
      setSubscriptions((current) => current.map((item) => (item.id === id ? merged : item)))
      pushToast({ tone: 'success', text: tx(settings.language, 'Abo aktualisiert.', 'Subscription updated.') })
    },
    [pushToast, settings.language, subscriptions],
  )

  const deleteSubscription = useCallback(
    async (id: string) => {
      const existing = subscriptions.find((item) => item.id === id)
      if (!existing) {
        return
      }
      await removeSubscription(id)
      setSubscriptions((current) => current.filter((item) => item.id !== id))
      pushToast({
        tone: 'warning',
        text: tx(settings.language, 'Abo gelöscht.', 'Subscription deleted.'),
        actionLabel: tx(settings.language, 'Rückgängig', 'Undo'),
        action: () => {
          void saveSubscription(existing).then(() => setSubscriptions((current) => [existing, ...current]))
        },
      })
    },
    [pushToast, settings.language, subscriptions],
  )

  const addIncomeEntry = useCallback(
    async (payload: Omit<IncomeEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
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
      await saveIncomeEntry(next)
      setIncomeEntries((current) => [next, ...current])
      pushToast({ tone: 'success', text: tx(settings.language, 'Einkommenseintrag gespeichert.', 'Income entry saved.') })
    },
    [pushToast, settings.language],
  )

  const updateIncomeEntry = useCallback(
    async (id: string, payload: Partial<IncomeEntry>) => {
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
      await saveIncomeEntry(merged)
      setIncomeEntries((current) => current.map((item) => (item.id === id ? merged : item)))
      pushToast({ tone: 'success', text: tx(settings.language, 'Einkommenseintrag aktualisiert.', 'Income entry updated.') })
    },
    [incomeEntries, pushToast, settings.language],
  )

  const deleteIncomeEntry = useCallback(
    async (id: string) => {
      const existing = incomeEntries.find((item) => item.id === id)
      if (!existing) {
        return
      }
      await removeIncomeEntry(id)
      setIncomeEntries((current) => current.filter((item) => item.id !== id))
      pushToast({
        tone: 'warning',
        text: tx(settings.language, 'Einkommenseintrag gelöscht.', 'Income entry deleted.'),
        actionLabel: tx(settings.language, 'Rückgängig', 'Undo'),
        action: () => {
          void saveIncomeEntry(existing).then(() => setIncomeEntries((current) => [existing, ...current]))
        },
      })
    },
    [incomeEntries, pushToast, settings.language],
  )

  const addScenario = useCallback(
    async (payload: InterestScenarioInput) => {
      const timestamp = nowIso()
      const next: InterestScenario = {
        id: makeId(),
        input: payload,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await saveInterestScenario(next)
      setScenarios((current) => [next, ...current])
      pushToast({ tone: 'success', text: tx(settings.language, 'Szenario gespeichert.', 'Scenario saved.') })
    },
    [pushToast, settings.language],
  )

  const updateScenario = useCallback(
    async (id: string, payload: InterestScenarioInput) => {
      const existing = scenarios.find((item) => item.id === id)
      if (!existing) {
        throw new Error(tx(settings.language, 'Szenario nicht gefunden.', 'Scenario not found.'))
      }
      const merged: InterestScenario = { ...existing, input: payload, updatedAt: nowIso() }
      await saveInterestScenario(merged)
      setScenarios((current) => current.map((item) => (item.id === id ? merged : item)))
      pushToast({ tone: 'success', text: tx(settings.language, 'Szenario aktualisiert.', 'Scenario updated.') })
    },
    [pushToast, scenarios, settings.language],
  )

  const deleteScenario = useCallback(
    async (id: string) => {
      await removeInterestScenario(id)
      setScenarios((current) => current.filter((item) => item.id !== id))
      pushToast({ tone: 'success', text: tx(settings.language, 'Szenario entfernt.', 'Scenario removed.') })
    },
    [pushToast, settings.language],
  )

  const exportBackup = useCallback((): AppBackup => {
    return {
      exportedAt: nowIso(),
      settings,
      uiState,
      backgroundImageDataUrl,
      subscriptions,
      incomeEntries,
      interestScenarios: scenarios,
    }
  }, [backgroundImageDataUrl, incomeEntries, scenarios, settings, subscriptions, uiState])

  const importBackup = useCallback(
    async (payload: AppBackup, mode: 'replace' | 'merge') => {
      const safeSubscriptions = Array.isArray(payload.subscriptions) ? payload.subscriptions : []
      const safeIncomeEntries = Array.isArray(payload.incomeEntries) ? payload.incomeEntries : []
      const safeScenarios = Array.isArray(payload.interestScenarios) ? payload.interestScenarios : []
      const mergedSubscriptions = mode === 'replace' ? safeSubscriptions : uniqueById([...subscriptions, ...safeSubscriptions])
      const mergedIncome = mode === 'replace' ? safeIncomeEntries : uniqueById([...incomeEntries, ...safeIncomeEntries])
      const mergedScenarios = mode === 'replace' ? safeScenarios : uniqueById([...scenarios, ...safeScenarios])

      await Promise.all([
        replaceSubscriptions(mergedSubscriptions),
        replaceIncomeEntries(mergedIncome),
        replaceInterestScenarios(mergedScenarios),
      ])

      setSubscriptions(mergedSubscriptions)
      setIncomeEntries(mergedIncome)
      setScenarios(mergedScenarios)
      if (mode === 'replace') {
        const normalizedSettings = normalizeImportedSettings(payload.settings)
        const normalizedUiState = normalizeImportedUiState(payload.uiState)
        setSettingsState(normalizedSettings)
        setUiStateState(normalizedUiState)
        if (typeof payload.backgroundImageDataUrl === 'string' && payload.backgroundImageDataUrl.startsWith('data:image/')) {
          saveBackgroundImageDataUrl(payload.backgroundImageDataUrl)
          setBackgroundImageDataUrlState(payload.backgroundImageDataUrl)
        } else {
          clearBackgroundImageDataUrl()
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
    [incomeEntries, pushToast, scenarios, settings.language, subscriptions],
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
    await Promise.all([replaceSubscriptions([]), replaceIncomeEntries([]), replaceInterestScenarios([])])
    clearPersistedPreferences()
    setPendingUpdate((current) => {
      void safelyCloseUpdateHandle(current)
      return null
    })
    setUpdatePrompt(null)
    setSkippedUpdateVersion('')
    setUpdateCheckError(null)
    setSubscriptions([])
    setIncomeEntries([])
    setScenarios([])
    setSettingsState(defaultSettings)
    setUiStateState(defaultUiState)
    setBackgroundImageDataUrlState(null)
    pushToast({ tone: 'warning', text: tx(settings.language, 'Alle lokalen Daten wurden gelöscht.', 'All local data has been deleted.') })
  }, [pushToast, settings.language])

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
      checkForUpdates,
      dismissUpdatePrompt,
      deleteIncomeEntry,
      deleteScenario,
      deleteSubscription,
      dismissToast,
      clearAllData,
      exportBackup,
      importBackup,
      incomeEntries,
      isCheckingForUpdates,
      isInstallingUpdate,
      loading,
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
