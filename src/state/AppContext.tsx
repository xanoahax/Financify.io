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
import type { AppBackup, IncomeEntry, InterestScenario, InterestScenarioInput, Settings, Subscription, ToastMessage, UiState } from '../types/models'

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

function ensurePositiveNumber(value: number, fieldLabel: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldLabel} muss eine gültige nicht-negative Zahl sein.`)
  }
}

function normalizeTags(input: string[]): string[] {
  return input
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 10)
}

const MAX_BACKGROUND_FILE_BYTES = 3 * 1024 * 1024

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Ausgewählte Bilddatei konnte nicht gelesen werden.'))
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Ausgewählte Bilddatei konnte nicht verarbeitet werden.'))
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
            text: error instanceof Error ? error.message : 'Lokale Daten konnten nicht geladen werden.',
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
  }, [pushToast])

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
        throw new Error('Bitte wähle eine Bilddatei aus.')
      }
      if (file.size > MAX_BACKGROUND_FILE_BYTES) {
        throw new Error('Bild ist zu groß. Bitte eine Datei unter 3 MB wählen.')
      }
      const dataUrl = await readFileAsDataUrl(file)
      try {
        saveBackgroundImageDataUrl(dataUrl)
      } catch {
        throw new Error('Bild konnte lokal nicht gespeichert werden. Bitte ein kleineres Bild versuchen.')
      }
      setBackgroundImageDataUrlState(dataUrl)
      pushToast({ tone: 'success', text: 'Hintergrundbild aktualisiert.' })
    },
    [pushToast],
  )

  const clearBackgroundImage = useCallback(() => {
    clearBackgroundImageDataUrl()
    setBackgroundImageDataUrlState(null)
    pushToast({ tone: 'success', text: 'Hintergrundbild entfernt.' })
  }, [pushToast])

  const addSubscription = useCallback(
    async (payload: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>) => {
      ensurePositiveNumber(payload.amount, 'Abo-Betrag')
      if (!payload.name.trim()) {
        throw new Error('Abo-Name ist erforderlich.')
      }
      if (payload.customIntervalMonths && payload.customIntervalMonths < 1) {
        throw new Error('Eigenes Intervall in Monaten muss mindestens 1 sein.')
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
      pushToast({ tone: 'success', text: 'Abo gespeichert.' })
    },
    [pushToast],
  )

  const updateSubscription = useCallback(
    async (id: string, payload: Partial<Subscription>) => {
      const existing = subscriptions.find((item) => item.id === id)
      if (!existing) {
        throw new Error('Abo nicht gefunden.')
      }
      const merged: Subscription = {
        ...existing,
        ...payload,
        tags: payload.tags ? normalizeTags(payload.tags) : existing.tags,
        updatedAt: nowIso(),
      }
      ensurePositiveNumber(merged.amount, 'Abo-Betrag')
      await saveSubscription(merged)
      setSubscriptions((current) => current.map((item) => (item.id === id ? merged : item)))
      pushToast({ tone: 'success', text: 'Abo aktualisiert.' })
    },
    [pushToast, subscriptions],
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
        text: 'Abo gelöscht.',
        actionLabel: 'Rückgängig',
        action: () => {
          void saveSubscription(existing).then(() => setSubscriptions((current) => [existing, ...current]))
        },
      })
    },
    [pushToast, subscriptions],
  )

  const addIncomeEntry = useCallback(
    async (payload: Omit<IncomeEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
      ensurePositiveNumber(payload.amount, 'Einkommensbetrag')
      if (!payload.source.trim()) {
        throw new Error('Einkommensquelle ist erforderlich.')
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
      pushToast({ tone: 'success', text: 'Einkommenseintrag gespeichert.' })
    },
    [pushToast],
  )

  const updateIncomeEntry = useCallback(
    async (id: string, payload: Partial<IncomeEntry>) => {
      const existing = incomeEntries.find((item) => item.id === id)
      if (!existing) {
        throw new Error('Einkommenseintrag nicht gefunden.')
      }
      const merged: IncomeEntry = {
        ...existing,
        ...payload,
        tags: payload.tags ? normalizeTags(payload.tags) : existing.tags,
        updatedAt: nowIso(),
      }
      ensurePositiveNumber(merged.amount, 'Einkommensbetrag')
      await saveIncomeEntry(merged)
      setIncomeEntries((current) => current.map((item) => (item.id === id ? merged : item)))
      pushToast({ tone: 'success', text: 'Einkommenseintrag aktualisiert.' })
    },
    [incomeEntries, pushToast],
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
        text: 'Einkommenseintrag gelöscht.',
        actionLabel: 'Rückgängig',
        action: () => {
          void saveIncomeEntry(existing).then(() => setIncomeEntries((current) => [existing, ...current]))
        },
      })
    },
    [incomeEntries, pushToast],
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
      pushToast({ tone: 'success', text: 'Szenario gespeichert.' })
    },
    [pushToast],
  )

  const updateScenario = useCallback(
    async (id: string, payload: InterestScenarioInput) => {
      const existing = scenarios.find((item) => item.id === id)
      if (!existing) {
        throw new Error('Szenario nicht gefunden.')
      }
      const merged: InterestScenario = { ...existing, input: payload, updatedAt: nowIso() }
      await saveInterestScenario(merged)
      setScenarios((current) => current.map((item) => (item.id === id ? merged : item)))
      pushToast({ tone: 'success', text: 'Szenario aktualisiert.' })
    },
    [pushToast, scenarios],
  )

  const deleteScenario = useCallback(
    async (id: string) => {
      await removeInterestScenario(id)
      setScenarios((current) => current.filter((item) => item.id !== id))
      pushToast({ tone: 'success', text: 'Szenario entfernt.' })
    },
    [pushToast],
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
      pushToast({ tone: 'success', text: `Backup importiert (${mode === 'replace' ? 'ersetzen' : 'zusammenführen'}).` })
    },
    [incomeEntries, pushToast, scenarios, subscriptions],
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
