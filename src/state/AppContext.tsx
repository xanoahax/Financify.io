import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  clearBackgroundImageDataUrl,
  defaultSettings,
  loadBackgroundImageDataUrl,
  loadSettings,
  loadUiState,
  saveBackgroundImageDataUrl,
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
import type { AppBackup, AppLanguage, IncomeEntry, InterestScenario, InterestScenarioInput, Settings, Subscription, ToastMessage, UiState } from '../types/models'
import { tx } from '../utils/i18n'

export interface AppContextValue {
  loading: boolean
  subscriptions: Subscription[]
  incomeEntries: IncomeEntry[]
  scenarios: InterestScenario[]
  settings: Settings
  backgroundImageDataUrl: string | null
  uiState: UiState
  toasts: ToastMessage[]
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

const MAX_BACKGROUND_FILE_BYTES = 3 * 1024 * 1024

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

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const [loading, setLoading] = useState(true)
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings())
  const [backgroundImageDataUrl, setBackgroundImageDataUrlState] = useState<string | null>(() => loadBackgroundImageDataUrl())
  const [uiState, setUiStateState] = useState<UiState>(() => loadUiState())
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([])
  const [scenarios, setScenarios] = useState<InterestScenario[]>([])
  const [toasts, setToasts] = useState<ToastMessage[]>([])

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
      backgroundImageDataUrl,
      subscriptions,
      incomeEntries,
      interestScenarios: scenarios,
    }
  }, [backgroundImageDataUrl, incomeEntries, scenarios, settings, subscriptions])

  const importBackup = useCallback(
    async (payload: AppBackup, mode: 'replace' | 'merge') => {
      const mergedSubscriptions = mode === 'replace' ? payload.subscriptions : uniqueById([...subscriptions, ...payload.subscriptions])
      const mergedIncome = mode === 'replace' ? payload.incomeEntries : uniqueById([...incomeEntries, ...payload.incomeEntries])
      const mergedScenarios = mode === 'replace' ? payload.interestScenarios : uniqueById([...scenarios, ...payload.interestScenarios])

      await Promise.all([
        replaceSubscriptions(mergedSubscriptions),
        replaceIncomeEntries(mergedIncome),
        replaceInterestScenarios(mergedScenarios),
      ])

      setSubscriptions(mergedSubscriptions)
      setIncomeEntries(mergedIncome)
      setScenarios(mergedScenarios)
      if (mode === 'replace') {
        setSettingsState({ ...defaultSettings, ...payload.settings })
        if (payload.backgroundImageDataUrl) {
          saveBackgroundImageDataUrl(payload.backgroundImageDataUrl)
          setBackgroundImageDataUrlState(payload.backgroundImageDataUrl)
        } else if (payload.backgroundImageDataUrl === null) {
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
      dismissToast,
    }),
    [
      addIncomeEntry,
      addScenario,
      addSubscription,
      deleteIncomeEntry,
      deleteScenario,
      deleteSubscription,
      dismissToast,
      exportBackup,
      importBackup,
      incomeEntries,
      loading,
      scenarios,
      setSettings,
      setUiState,
      setBackgroundImageFromFile,
      clearBackgroundImage,
      settings,
      backgroundImageDataUrl,
      subscriptions,
      toasts,
      uiState,
      updateIncomeEntry,
      updateScenario,
      updateSubscription,
    ],
  )

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
}
