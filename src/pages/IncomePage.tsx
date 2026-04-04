import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { BarChart } from '../components/BarChart'
import { DonutChart } from '../components/DonutChart'
import { LineChart } from '../components/LineChart'
import { useCardRowStagger } from '../hooks/useCardRowStagger'
import { useGuardedBackdropClose } from '../hooks/useGuardedBackdropClose'
import { useAppContext } from '../state/useAppContext'
import type { IncomeEntry } from '../types/models'
import { addDays, endOfMonth, endOfYear, formatDateByPattern, monthLabel, monthKey, startOfMonth, startOfYear, todayString } from '../utils/date'
import { formatMoney, getCurrencySymbol, toPercent } from '../utils/format'
import { buildFixedSalaryIncomeTemplateEntries, incomeByMonth, materializeIncomeEntriesForRange, monthOverMonthChange, monthStats, sourceBreakdown, sumIncome } from '../utils/income'
import { tx } from '../utils/i18n'
import { calculateShiftIncome } from '../utils/shiftIncome'

type IncomeFormState = Omit<IncomeEntry, 'id' | 'createdAt' | 'updatedAt'>
type IncomeFormMode = 'manual' | 'job-shift'

interface ShiftLogFormState {
  jobId: string
  date: string
  startTime: string
  endTime: string
}

interface IncomeDeleteConfirmState {
  id: string
  source: string
  date: string
}

type ChangeScope = 'retroactive' | 'from-date'
type IncomeTrendRange = 3 | 6 | 12

interface PendingIncomeUpdateState {
  id: string
  payload: IncomeFormState
}

const INCOME_SOURCE_PRESETS = {
  de: [
    'Gehalt',
    'Freelance',
    'Nebenjob',
    'Bonus',
    'Trinkgeld',
    'Provision',
    'Investitionen',
    'Dividenden',
    'Zinsen',
    'Vermietung',
    'R\u00fcckerstattung',
    'Geschenk',
    'Taschengeld',
    'Sonstiges',
  ],
  en: [
    'Salary',
    'Freelance',
    'Side job',
    'Bonus',
    'Tips',
    'Commission',
    'Investments',
    'Dividends',
    'Interest',
    'Rental income',
    'Refund',
    'Gift',
    'Allowance',
    'Other',
  ],
} as const

function parseTags(input: string): string[] {
  return input
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function parseOptionalNumberInput(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value)
}

function persistedIncomeEntryId(entryId: string): string {
  const separatorIndex = entryId.indexOf('::')
  return separatorIndex >= 0 ? entryId.slice(0, separatorIndex) : entryId
}

function isJobShiftIncomeEntry(entry: IncomeEntry): boolean {
  const tags = entry.tags.map((tag) => tag.trim().toLowerCase())
  return tags.includes('dienst') || tags.includes('shift')
}

function incomeSourceLabel(entry: IncomeEntry, language: 'de' | 'en'): string {
  if (!isJobShiftIncomeEntry(entry)) {
    return entry.source
  }
  return `${tx(language, 'Job', 'Job')}: ${entry.source}`
}

function formatDurationHours(hours: number, language: 'de' | 'en'): string {
  const rounded = Math.round(hours * 100) / 100
  if (Number.isInteger(rounded)) {
    return `${rounded.toFixed(0)} ${tx(language, 'h', 'h')}`
  }
  const numeric = language === 'de' ? rounded.toFixed(2).replace('.', ',') : rounded.toFixed(2)
  return `${numeric} ${tx(language, 'h', 'h')}`
}

function buildDefaultForm(sourceDefault: string): IncomeFormState {
  return {
    amount: Number.NaN,
    date: todayString(),
    endDate: undefined,
    source: sourceDefault,
    tags: [],
    notes: '',
    recurring: 'none',
    recurringIntervalDays: undefined,
  }
}

function buildDefaultShiftForm(defaultJobId: string): ShiftLogFormState {
  return {
    jobId: defaultJobId,
    date: todayString(),
    startTime: '09:00',
    endTime: '17:00',
  }
}

export function IncomePage(): JSX.Element {
  const { incomeEntries, settings, addIncomeEntry, updateIncomeEntry, deleteIncomeEntry } = useAppContext()
  const shiftJobs = settings.shiftJobs.filter((job) => job.employmentType === 'casual')
  const fixedSalaryTemplateEntries = useMemo(() => buildFixedSalaryIncomeTemplateEntries(settings.shiftJobs), [settings.shiftJobs])
  const analyticEntries = useMemo(() => [...incomeEntries, ...fixedSalaryTemplateEntries], [fixedSalaryTemplateEntries, incomeEntries])
  const resolvedDefaultShiftJobId = shiftJobs.some((job) => job.id === settings.defaultShiftJobId) ? settings.defaultShiftJobId : (shiftJobs[0]?.id ?? '')
  const [searchParams, setSearchParams] = useSearchParams()
  const [form, setForm] = useState<IncomeFormState>(() => buildDefaultForm(tx(settings.language, 'Gehalt', 'Salary')))
  const [formMode, setFormMode] = useState<IncomeFormMode>('manual')
  const [shiftForm, setShiftForm] = useState<ShiftLogFormState>(buildDefaultShiftForm(resolvedDefaultShiftJobId))
  const [editId, setEditId] = useState<string | null>(null)
  const [effectiveFromDate, setEffectiveFromDate] = useState(todayString())
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month')
  const [selectedMonth, setSelectedMonth] = useState(() => monthKey(todayString()))
  const [selectedYear, setSelectedYear] = useState(() => todayString().slice(0, 4))
  const [entrySearchQuery, setEntrySearchQuery] = useState('')
  const [trendRange, setTrendRange] = useState<IncomeTrendRange>(6)
  const [formError, setFormError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<IncomeDeleteConfirmState | null>(null)
  const [pendingIncomeUpdate, setPendingIncomeUpdate] = useState<PendingIncomeUpdateState | null>(null)
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const amountInputRef = useRef<HTMLInputElement | null>(null)
  const dateInputRef = useRef<HTMLInputElement | null>(null)
  const shiftDateInputRef = useRef<HTMLInputElement | null>(null)
  const quickActionsRef = useRef<HTMLDivElement | null>(null)
  const pageRef = useRef<HTMLElement | null>(null)
  const t = useCallback((de: string, en: string) => tx(settings.language, de, en), [settings.language])
  const monthLocale = settings.language === 'de' ? 'de-DE' : 'en-US'
  const currencySymbol = getCurrencySymbol(settings.currency)

  useCardRowStagger(pageRef)
  const existingManualSources = useMemo(() => {
    const unique = new Set<string>()
    for (const entry of incomeEntries) {
      if (isJobShiftIncomeEntry(entry)) {
        continue
      }
      const source = entry.source.trim()
      if (source) {
        unique.add(source)
      }
    }
    return [...unique]
  }, [incomeEntries])
  const manualSourceOptions = useMemo(() => {
    const presets = settings.language === 'de' ? INCOME_SOURCE_PRESETS.de : INCOME_SOURCE_PRESETS.en
    const unique = new Set<string>(presets)
    for (const source of existingManualSources) {
      unique.add(source)
    }
    return [...unique]
  }, [existingManualSources, settings.language])
  const manualSourceSelectOptions = useMemo(() => {
    if (formMode !== 'manual') {
      return manualSourceOptions
    }
    const currentSource = form.source.trim()
    if (!currentSource || manualSourceOptions.includes(currentSource)) {
      return manualSourceOptions
    }
    return [currentSource, ...manualSourceOptions]
  }, [form.source, formMode, manualSourceOptions])
  const selectedShiftJob = useMemo(
    () => shiftJobs.find((job) => job.id === shiftForm.jobId) ?? shiftJobs.find((job) => job.id === resolvedDefaultShiftJobId) ?? null,
    [resolvedDefaultShiftJobId, shiftForm.jobId, shiftJobs],
  )

  const closeForm = useCallback((): void => {
    setIsFormOpen(false)
    setEditId(null)
    setFormMode('manual')
    setForm(buildDefaultForm(tx(settings.language, 'Gehalt', 'Salary')))
    setEffectiveFromDate(todayString())
    setShiftForm(buildDefaultShiftForm(resolvedDefaultShiftJobId))
    setTagInput('')
    setFormError('')
    setPendingIncomeUpdate(null)
  }, [resolvedDefaultShiftJobId, settings.language])
  const closeConfirmDelete = useCallback(() => setConfirmDelete(null), [])
  const closePendingIncomeUpdate = useCallback(() => setPendingIncomeUpdate(null), [])
  const formBackdropCloseGuard = useGuardedBackdropClose(closeForm)
  const confirmBackdropCloseGuard = useGuardedBackdropClose(closeConfirmDelete)
  const pendingIncomeUpdateBackdropCloseGuard = useGuardedBackdropClose(closePendingIncomeUpdate)

  useEffect(() => {
    const quickAdd = searchParams.get('quickAdd')
    if (quickAdd !== '1' && quickAdd !== 'income' && quickAdd !== 'shift') {
      return
    }
    const nextMode: IncomeFormMode = quickAdd === 'shift' ? 'job-shift' : 'manual'
    const frame = window.requestAnimationFrame(() => {
      setIsFormOpen(true)
      setEditId(null)
      setFormMode(nextMode)
      setForm(buildDefaultForm(tx(settings.language, 'Gehalt', 'Salary')))
      setEffectiveFromDate(todayString())
      setShiftForm(buildDefaultShiftForm(resolvedDefaultShiftJobId))
      setTagInput('')
      setFormError('')
      window.requestAnimationFrame(() => {
        if (nextMode === 'job-shift') {
          shiftDateInputRef.current?.focus()
          return
        }
        amountInputRef.current?.focus()
      })
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('quickAdd')
      setSearchParams(nextParams, { replace: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [resolvedDefaultShiftJobId, searchParams, setSearchParams, settings.language, t])

  useEffect(() => {
    if (!isFormOpen && !confirmDelete) {
      return
    }
    function onEscape(event: KeyboardEvent): void {
      if (event.key !== 'Escape') {
        return
      }
      if (pendingIncomeUpdate) {
        setPendingIncomeUpdate(null)
        return
      }
      if (confirmDelete) {
        setConfirmDelete(null)
        return
      }
      closeForm()
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [closeForm, confirmDelete, isFormOpen, pendingIncomeUpdate])

  useEffect(() => {
    if (!quickActionsOpen) {
      return
    }
    function onDocumentMouseDown(event: MouseEvent): void {
      if (!quickActionsRef.current?.contains(event.target as Node)) {
        setQuickActionsOpen(false)
      }
    }
    function onDocumentKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setQuickActionsOpen(false)
      }
    }
    window.addEventListener('mousedown', onDocumentMouseDown)
    window.addEventListener('keydown', onDocumentKeyDown)
    return () => {
      window.removeEventListener('mousedown', onDocumentMouseDown)
      window.removeEventListener('keydown', onDocumentKeyDown)
    }
  }, [quickActionsOpen])

  const hasRecurringImpactChange = useCallback((existing: IncomeEntry, payload: IncomeFormState): boolean => {
    return (
      payload.amount !== existing.amount ||
      payload.source !== existing.source ||
      payload.recurring !== existing.recurring ||
      (payload.recurringIntervalDays ?? undefined) !== (existing.recurringIntervalDays ?? undefined)
    )
  }, [])

  const today = todayString()
  const selectedMonthDate = `${selectedMonth}-01`
  const currentYearNumber = Number(today.slice(0, 4))
  const effectiveSelectedYear = selectedYear
  const selectedYearStartDate = `${effectiveSelectedYear}-01-01`
  const selectedYearEndDate = endOfYear(selectedYearStartDate)
  const isSelectedYearCurrent = effectiveSelectedYear === String(currentYearNumber)
  const selectableYears = useMemo(() => {
    const years = new Set<number>()
    for (const entry of analyticEntries) {
      const startYear = Number(entry.date.slice(0, 4))
      if (!Number.isFinite(startYear)) {
        continue
      }
      if (entry.recurring === 'none') {
        if (startYear <= currentYearNumber) {
          years.add(startYear)
        }
        continue
      }
      const rawEndYear = entry.endDate ? Number(entry.endDate.slice(0, 4)) : currentYearNumber
      const boundedEndYear = Number.isFinite(rawEndYear) ? Math.min(rawEndYear, currentYearNumber) : currentYearNumber
      for (let year = startYear; year <= boundedEndYear; year += 1) {
        if (year <= currentYearNumber) {
          years.add(year)
        }
      }
    }
    return [...years].sort((a, b) => b - a).map((year) => String(year))
  }, [analyticEntries, currentYearNumber])

  useEffect(() => {
    if (selectableYears.length === 0) {
      return
    }
    if (!selectableYears.includes(selectedYear)) {
      setSelectedYear(selectableYears[0])
    }
  }, [selectableYears, selectedYear])

  const sourceAndQueryFiltered = useMemo(() => {
    return analyticEntries
  }, [analyticEntries])

  const periodRange = useMemo(
    () =>
      viewMode === 'month'
        ? { start: startOfMonth(selectedMonthDate), end: endOfMonth(selectedMonthDate) }
        : { start: startOfYear(selectedYearStartDate), end: endOfYear(selectedYearStartDate) },
    [selectedMonthDate, selectedYearStartDate, viewMode],
  )

  const tableEntries = useMemo(() => {
    const normalizedQuery = entrySearchQuery.trim().toLowerCase()

    return [...incomeEntries]
      .filter((item) => {
        if (!normalizedQuery) {
          return true
        }

        const searchableText = [
          formatDateByPattern(item.date, settings.dateFormat),
          incomeSourceLabel(item, settings.language),
          item.recurring === 'none' ? t('Einmalig', 'One-time') : t('Wiederkehrend', 'Recurring'),
          item.notes,
          item.tags.join(' '),
          formatMoney(item.amount, settings.currency, settings.privacyHideAmounts),
        ]
          .join(' ')
          .toLowerCase()

        return searchableText.includes(normalizedQuery)
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [entrySearchQuery, incomeEntries, settings.currency, settings.dateFormat, settings.language, settings.privacyHideAmounts, t])

  const resolvedPeriodEntries = useMemo(
    () => materializeIncomeEntriesForRange(sourceAndQueryFiltered, periodRange.start, periodRange.end),
    [periodRange.end, periodRange.start, sourceAndQueryFiltered],
  )

  const selectedYearToDateEntries = useMemo(
    () =>
      materializeIncomeEntriesForRange(
        sourceAndQueryFiltered,
        startOfYear(selectedYearStartDate),
        isSelectedYearCurrent ? today : selectedYearEndDate,
      ),
    [isSelectedYearCurrent, selectedYearEndDate, selectedYearStartDate, sourceAndQueryFiltered, today],
  )

  const selectedYearForecastEntries = useMemo(
    () => materializeIncomeEntriesForRange(sourceAndQueryFiltered, startOfYear(selectedYearStartDate), selectedYearEndDate),
    [selectedYearEndDate, selectedYearStartDate, sourceAndQueryFiltered],
  )

  const rollingYearEntries = useMemo(
    () => materializeIncomeEntriesForRange(sourceAndQueryFiltered, addDays(today, -365), today),
    [sourceAndQueryFiltered, today],
  )

  const stats = useMemo(() => {
    const monthly = incomeByMonth(rollingYearEntries)
    const totalEntries = viewMode === 'year' && isSelectedYearCurrent ? selectedYearToDateEntries : resolvedPeriodEntries
    return {
      total: sumIncome(totalEntries),
      yearForecastTotal: sumIncome(selectedYearForecastEntries),
      monthSeries: monthly.map((item) => ({ label: monthLabel(item.month, monthLocale), value: item.value })).slice(-12),
      sourceSeries: sourceBreakdown(totalEntries, (entry) => incomeSourceLabel(entry, settings.language)),
      aggregates: monthStats(rollingYearEntries),
      mom: monthOverMonthChange(rollingYearEntries),
    }
  }, [isSelectedYearCurrent, monthLocale, resolvedPeriodEntries, rollingYearEntries, selectedYearForecastEntries, selectedYearToDateEntries, settings.language, viewMode])
  const selectedMonthLabel = useMemo(() => monthLabel(selectedMonth, monthLocale), [monthLocale, selectedMonth])
  const trendRangeOptions: Array<{ value: IncomeTrendRange; label: string }> = [
    { value: 3, label: t('3 Monate', '3 months') },
    { value: 6, label: t('6 Monate', '6 months') },
    { value: 12, label: t('12 Monate', '12 months') },
  ]
  const filteredTrendSeries = useMemo(() => stats.monthSeries.slice(-trendRange), [stats.monthSeries, trendRange])

  const shiftHourlyRate = useMemo(() => {
    const rate = Number(selectedShiftJob?.hourlyRate)
    return Number.isFinite(rate) && rate > 0 ? rate : 18
  }, [selectedShiftJob?.hourlyRate])

  const shiftPreview = useMemo(() => {
    if (editId || formMode !== 'job-shift' || !selectedShiftJob) {
      return null
    }
    try {
      return calculateShiftIncome({
        date: shiftForm.date,
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        hourlyRate: shiftHourlyRate,
        language: settings.language,
      })
    } catch {
      return null
    }
  }, [editId, formMode, selectedShiftJob, settings.language, shiftForm.date, shiftForm.endTime, shiftForm.startTime, shiftHourlyRate])

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    try {
      setFormError('')
      if (!editId && formMode === 'job-shift') {
        if (!selectedShiftJob) {
          throw new Error(
            t(
              'Kein fallweiser Job konfiguriert. Bitte zuerst in den Einstellungen einen fallweisen Job anlegen.',
              'No casual job configured. Please add a casual job in settings first.',
            ),
          )
        }
        const result = calculateShiftIncome({
          date: shiftForm.date,
          startTime: shiftForm.startTime,
          endTime: shiftForm.endTime,
          hourlyRate: shiftHourlyRate,
          language: settings.language,
        })
        await addIncomeEntry({
          amount: result.amount,
          date: shiftForm.date,
          source: selectedShiftJob.name,
          tags: [selectedShiftJob.name, t('Dienst', 'Shift')],
          notes: t(
            `Dienst ${shiftForm.startTime}-${shiftForm.endTime}${result.crossesMidnight ? ' (Ã¼ber Mitternacht)' : ''}`,
            `Shift ${shiftForm.startTime}-${shiftForm.endTime}${result.crossesMidnight ? ' (overnight)' : ''}`,
          ),
          recurring: 'none',
          recurringIntervalDays: undefined,
        })
        closeForm()
        return
      }

      const payload: IncomeFormState = {
        ...form,
        amount: Number(form.amount),
        endDate: form.endDate || undefined,
        tags: parseTags(tagInput),
        recurringIntervalDays: form.recurring === 'custom' ? Number(form.recurringIntervalDays) : undefined,
      }
      if (editId) {
        const existing = incomeEntries.find((item) => item.id === editId)
        if (!existing) {
          throw new Error(t('Eintrag konnte nicht geladen werden.', 'Entry could not be loaded.'))
        }
        const involvesRecurring = existing.recurring !== 'none' || payload.recurring !== 'none'
        if (involvesRecurring && hasRecurringImpactChange(existing, payload)) {
          setPendingIncomeUpdate({ id: editId, payload })
          return
        }
        await updateIncomeEntry(editId, payload)
      } else {
        await addIncomeEntry(payload)
      }
      closeForm()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('Einkommenseintrag konnte nicht gespeichert werden.', 'Income entry could not be saved.'))
    }
  }

  async function applyPendingIncomeUpdate(scope: ChangeScope): Promise<void> {
    if (!pendingIncomeUpdate) {
      return
    }
    try {
      const effectiveFrom = scope === 'from-date' ? effectiveFromDate : undefined
      await updateIncomeEntry(pendingIncomeUpdate.id, pendingIncomeUpdate.payload, { effectiveFrom })
      setPendingIncomeUpdate(null)
      closeForm()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('Einkommenseintrag konnte nicht gespeichert werden.', 'Income entry could not be saved.'))
      setPendingIncomeUpdate(null)
    }
  }

  function startEdit(item: IncomeEntry): void {
    const sourceId = persistedIncomeEntryId(item.id)
    const sourceEntry = incomeEntries.find((entry) => entry.id === sourceId)
    if (!sourceEntry) {
      setFormError(t('Eintrag konnte nicht geladen werden.', 'Entry could not be loaded.'))
      return
    }
    setIsFormOpen(true)
    setEditId(sourceId)
    setFormMode('manual')
    setForm({
      amount: sourceEntry.amount,
      date: sourceEntry.date,
      endDate: sourceEntry.endDate,
      source: sourceEntry.source,
      tags: sourceEntry.tags,
      notes: sourceEntry.notes,
      recurring: sourceEntry.recurring,
      recurringIntervalDays: sourceEntry.recurringIntervalDays,
    })
    setEffectiveFromDate(sourceEntry.recurring !== 'none' ? item.date : todayString())
    setShiftForm(buildDefaultShiftForm(resolvedDefaultShiftJobId))
    setTagInput(sourceEntry.tags.join(', '))
    setFormError('')
    window.requestAnimationFrame(() => dateInputRef.current?.focus())
  }

  function openAddForm(nextMode: IncomeFormMode = 'manual'): void {
    setIsFormOpen(true)
    setEditId(null)
    setFormMode(nextMode)
    setForm(buildDefaultForm(t('Gehalt', 'Salary')))
    setEffectiveFromDate(todayString())
    setShiftForm(buildDefaultShiftForm(resolvedDefaultShiftJobId))
    setTagInput('')
    setFormError('')
    window.requestAnimationFrame(() => {
      if (nextMode === 'job-shift') {
        shiftDateInputRef.current?.focus()
        return
      }
      amountInputRef.current?.focus()
    })
  }

  function openDeleteConfirmation(item: IncomeEntry): void {
    setConfirmDelete({ id: persistedIncomeEntryId(item.id), source: incomeSourceLabel(item, settings.language), date: item.date })
  }

  async function handleDeleteConfirmed(): Promise<void> {
    if (!confirmDelete) {
      return
    }
    try {
      await deleteIncomeEntry(confirmDelete.id)
      setConfirmDelete(null)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('Einkommenseintrag konnte nicht gelÃ¶scht werden.', 'Income entry could not be deleted.'))
      setConfirmDelete(null)
    }
  }

  return (
    <section ref={pageRef} className="page">
      <section className="page-top-row">
      <header className="page-header page-header-compact">
        <div className="page-title-actions">
          <h1>{t('Einkommen', 'Income')}</h1>
        </div>
        <div className="page-actions">
          <div className="shell-plus-cluster" ref={quickActionsRef}>
            <button
              type="button"
              className="shell-plus-button"
              onClick={() => setQuickActionsOpen((current) => !current)}
              aria-label={t('Schnell hinzufügen', 'Quick add')}
              aria-expanded={quickActionsOpen}
              aria-haspopup="menu"
              title={t('Schnell hinzufügen', 'Quick add')}
            >
              +
            </button>
            {quickActionsOpen ? (
              <div className="shell-plus-menu" role="menu" aria-label={t('Schnellaktionen', 'Quick actions')}>
                <button
                  type="button"
                  className="shell-plus-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setQuickActionsOpen(false)
                    openAddForm('manual')
                  }}
                >
                  {t('Einkommen hinzufügen', 'Add income')}
                </button>
                <button
                  type="button"
                  className="shell-plus-menu-item"
                  role="menuitem"
                  disabled={shiftJobs.length === 0}
                  title={shiftJobs.length === 0 ? t('Bitte zuerst einen fallweisen Job in Einstellungen anlegen.', 'Please add a casual job in settings first.') : undefined}
                  onClick={() => {
                    setQuickActionsOpen(false)
                    openAddForm('job-shift')
                  }}
                >
                  {t('Dienst loggen', 'Log shift')}
                </button>
              </div>
            ) : null}
          </div>
          <div className="segmented">
            <button type="button" className={viewMode === 'month' ? 'active' : ''} onClick={() => setViewMode('month')}>
              {t('Monat', 'Month')}
            </button>
            <button type="button" className={viewMode === 'year' ? 'active' : ''} onClick={() => setViewMode('year')}>
              {t('Jahr', 'Year')}
            </button>
          </div>
          {viewMode === 'month' ? (
            <input
              type="month"
              value={selectedMonth}
              max={monthKey(today)}
              onChange={(event) => setSelectedMonth(event.target.value || monthKey(today))}
              aria-label={t('Monat auswählen', 'Select month')}
            />
          ) : null}
          {viewMode === 'year' ? (
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              aria-label={t('Jahr auswählen', 'Select year')}
            >
              {selectableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </header>

      <div className="stats-grid stats-grid-top">
        <article className="card stat-card">
          <p className="muted">
            {t('Einkommen gesamt', 'Total income')} ({viewMode === 'month' ? selectedMonthLabel : selectedYear})
          </p>
          <p className="stat-value"><AnimatedNumber value={stats.total} formatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)} /></p>
          {viewMode === 'year' ? (
            <p className="hint">
              {t('Forecast:', 'Forecast:')}{' '}
              {formatMoney(stats.yearForecastTotal, settings.currency, settings.privacyHideAmounts)}
            </p>
          ) : null}
        </article>
        <article className="card stat-card">
          <p className="muted">{t('Monatlicher Durchschnitt', 'Monthly average')}</p>
          <p className="stat-value"><AnimatedNumber value={stats.aggregates.average} formatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)} /></p>
        </article>
        <article className="card stat-card">
          <p className="muted">{t('Monatlicher Median', 'Monthly median')}</p>
          <p className="stat-value"><AnimatedNumber value={stats.aggregates.median} formatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)} /></p>
          <p className="hint">{t('Vgl. Vormonat', 'vs previous month')}: {toPercent(stats.mom)}</p>
        </article>
      </div>
      </section>

      <div className="two-column two-column-equal">
        <article className="card">
          <header className="section-header">
            <h2>{t('Trend (12 Monate)', 'Trend (12 months)')}</h2>
            <div className="segmented dashboard-range-filter" role="tablist" aria-label={t('Trend-Zeitraum', 'Trend range')}>
              {trendRangeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={trendRange === option.value ? 'active' : ''}
                  role="tab"
                  aria-selected={trendRange === option.value}
                  onClick={() => setTrendRange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </header>
          <LineChart
            data={filteredTrendSeries}
            language={settings.language}
            valueFormatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)}
          />
        </article>
        <article className="card">
          <header className="section-header">
            <h2>{t('Quellenaufteilung', 'Source breakdown')}</h2>
          </header>
          <DonutChart
            data={stats.sourceSeries}
            language={settings.language}
            valueFormatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)}
          />
        </article>
      </div>

      {isFormOpen ? (
        <div
          className="form-modal-backdrop"
          onMouseDown={formBackdropCloseGuard.onBackdropMouseDown}
          onClick={formBackdropCloseGuard.onBackdropClick}
          role="presentation"
        >
          <article className="card form-modal" onMouseDownCapture={formBackdropCloseGuard.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>
                {editId ? t('Einkommen bearbeiten', 'Edit income') : formMode === 'job-shift' ? t('Dienst loggen', 'Log shift') : t('Einkommen hinzufÃ¼gen', 'Add income')}
              </h2>
              <button type="button" className="icon-button" onClick={closeForm} aria-label={t('Popup schlieÃen', 'Close popup')}>
                x
              </button>
            </header>
            {!editId ? (
              <div className="segmented" role="tablist" aria-label={t('Einkommen-Eingabeoption', 'Income input mode')}>
                <button
                  type="button"
                  className={formMode === 'manual' ? 'active' : ''}
                  onClick={() => {
                    setFormMode('manual')
                    setFormError('')
                    window.requestAnimationFrame(() => amountInputRef.current?.focus())
                  }}
                >
                  {t('Manuell', 'Manual')}
                </button>
                <button
                  type="button"
                  className={formMode === 'job-shift' ? 'active' : ''}
                  onClick={() => {
                    setFormMode('job-shift')
                    setFormError('')
                    window.requestAnimationFrame(() => shiftDateInputRef.current?.focus())
                  }}
                  disabled={shiftJobs.length === 0}
                >
                  {t('Job-Dienst', 'Job shift')}
                </button>
              </div>
            ) : null}
            {formError ? <p className="error-text">{formError}</p> : null}
            <form className="form-grid" onSubmit={onSubmit}>
              {!editId && formMode === 'job-shift' ? (
                <>
                  <label>
                    {t('Job', 'Job')}
                    <select
                      value={shiftForm.jobId}
                      onChange={(event) => setShiftForm((current) => ({ ...current, jobId: event.target.value }))}
                      required
                    >
                      {shiftJobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t('Datum', 'Date')}
                    <input ref={shiftDateInputRef} type="date" value={shiftForm.date} onChange={(event) => setShiftForm((current) => ({ ...current, date: event.target.value }))} required />
                  </label>
                  <label>
                    {t('Start', 'Start')}
                    <input type="time" value={shiftForm.startTime} onChange={(event) => setShiftForm((current) => ({ ...current, startTime: event.target.value }))} required />
                  </label>
                  <label>
                    {t('Ende', 'End')}
                    <input type="time" value={shiftForm.endTime} onChange={(event) => setShiftForm((current) => ({ ...current, endTime: event.target.value }))} required />
                  </label>
                  <div className="stat-tile full-width">
                    <small className="muted">{t('Stundensatz (netto)', 'Hourly rate (net)')}: {shiftHourlyRate} {currencySymbol}/h</small>
                    <strong>
                      {t('Berechnetes Einkommen', 'Calculated income')}:{' '}
                      {shiftPreview ? formatMoney(shiftPreview.amount, settings.currency, settings.privacyHideAmounts) : 'â'}
                    </strong>
                    <small className="muted">
                      {shiftPreview
                        ? `${t('Dauer', 'Duration')}: ${formatDurationHours(shiftPreview.durationHours, settings.language)}${shiftPreview.crossesMidnight ? t(' (Ã¼ber Mitternacht)', ' (overnight)') : ''}`
                        : t('Bitte gÃ¼ltige Start- und Endzeit eingeben.', 'Please enter valid start and end times.')}
                    </small>
                  </div>
                </>
              ) : (
                <>
                  <label>
                    {t('Betrag', 'Amount')}
                    <input
                      ref={amountInputRef}
                      type="number"
                      min={0}
                      step="0.01"
                      value={Number.isFinite(form.amount) ? form.amount : ''}
                      onChange={(event) => setForm((current) => ({ ...current, amount: parseOptionalNumberInput(event.target.value) }))}
                      required
                    />
                  </label>
                  <label>
                    {t('Datum', 'Date')}
                    <input ref={dateInputRef} type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} required />
                  </label>
                  <label>
                    {t('Quelle', 'Source')}
                    <select value={form.source} onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))} required>
                      {manualSourceSelectOptions.map((sourceOption) => (
                        <option key={sourceOption} value={sourceOption}>
                          {sourceOption}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t('Wiederkehrend', 'Recurring')}
                    <select value={form.recurring} onChange={(event) => setForm((current) => ({ ...current, recurring: event.target.value as IncomeEntry['recurring'] }))}>
                      <option value="none">{t('Nein', 'No')}</option>
                      <option value="weekly">{t('WÃ¶chentlich', 'Weekly')}</option>
                      <option value="monthly">{t('Monatlich', 'Monthly')}</option>
                      <option value="custom">{t('Eigene Tage', 'Custom days')}</option>
                    </select>
                  </label>
                  {form.recurring === 'custom' ? (
                    <label>
                      {t('Alle X Tage', 'Every X days')}
                      <input type="number" min={1} value={form.recurringIntervalDays ?? 30} onChange={(event) => setForm((current) => ({ ...current, recurringIntervalDays: Number(event.target.value) }))} />
                    </label>
                  ) : null}
                  {editId && form.recurring !== 'none' ? (
                    <label>
                      {t('Ãnderung wirksam ab', 'Change effective from')}
                      <input type="date" value={effectiveFromDate} onChange={(event) => setEffectiveFromDate(event.target.value)} required />
                    </label>
                  ) : null}
                  <label>
                    {t('Tags (kommagetrennt)', 'Tags (comma-separated)')}
                    <input value={tagInput} onChange={(event) => setTagInput(event.target.value)} />
                  </label>
                  <label className="full-width">
                    {t('Notizen', 'Notes')}
                    <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
                  </label>
                </>
              )}

              <div className="form-actions full-width">
                <button type="submit" className="button button-primary">
                  {editId ? t('Aktualisieren', 'Update') : formMode === 'job-shift' ? t('Dienst speichern', 'Save shift') : t('Speichern', 'Save')}
                </button>
                <button type="button" className="button button-secondary" onClick={closeForm}>
                  {t('Abbrechen', 'Cancel')}
                </button>
              </div>
            </form>
          </article>
        </div>
      ) : null}

      {confirmDelete ? (
        <div
          className="form-modal-backdrop"
          onMouseDown={confirmBackdropCloseGuard.onBackdropMouseDown}
          onClick={confirmBackdropCloseGuard.onBackdropClick}
          role="presentation"
        >
          <article className="card form-modal confirm-modal" onMouseDownCapture={confirmBackdropCloseGuard.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{t('Einkommenseintrag lÃ¶schen?', 'Delete income entry?')}</h2>
              <button type="button" className="icon-button" onClick={closeConfirmDelete} aria-label={t('Popup schlieÃen', 'Close popup')}>
                x
              </button>
            </header>
            <p>
              {t('MÃ¶chtest du den Eintrag', 'Do you really want to delete the entry')} "{confirmDelete.source}" {t('vom', 'from')}{' '}
              {formatDateByPattern(confirmDelete.date, settings.dateFormat)} {t('wirklich lÃ¶schen?', '?')}
            </p>
            <div className="form-actions">
              <button type="button" className="button button-danger" onClick={() => void handleDeleteConfirmed()}>
                {t('LÃ¶schen', 'Delete')}
              </button>
              <button type="button" className="button button-secondary" onClick={closeConfirmDelete}>
                {t('Abbrechen', 'Cancel')}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {pendingIncomeUpdate ? (
        <div
          className="form-modal-backdrop"
          onMouseDown={pendingIncomeUpdateBackdropCloseGuard.onBackdropMouseDown}
          onClick={pendingIncomeUpdateBackdropCloseGuard.onBackdropClick}
          role="presentation"
        >
          <article className="card form-modal confirm-modal" onMouseDownCapture={pendingIncomeUpdateBackdropCloseGuard.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{t('Ãnderung anwenden', 'Apply change')}</h2>
              <button type="button" className="icon-button" onClick={closePendingIncomeUpdate} aria-label={t('Popup schlieÃen', 'Close popup')}>
                x
              </button>
            </header>
            <p>{t('Soll die Ãnderung rÃ¼ckwirkend gelten oder erst ab einem bestimmten Datum?', 'Should this change apply retroactively or only from a specific date?')}</p>
            <label>
              {t('Ab Datum', 'From date')}
              <input type="date" value={effectiveFromDate} onChange={(event) => setEffectiveFromDate(event.target.value)} required />
            </label>
            <div className="form-actions">
              <button type="button" className="button button-primary" onClick={() => void applyPendingIncomeUpdate('retroactive')}>
                {t('RÃ¼ckwirkend', 'Retroactive')}
              </button>
              <button type="button" className="button button-secondary" onClick={() => void applyPendingIncomeUpdate('from-date')}>
                {t('Ab Datum Ã¼bernehmen', 'Apply from date')}
              </button>
              <button type="button" className="button button-secondary" onClick={closePendingIncomeUpdate}>
                {t('Abbrechen', 'Cancel')}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      <section className="dashboard-grid">
        <article className="card dashboard-card dashboard-card-fit">
          <header className="section-header">
            <h2>{t('Einkommen pro Monat', 'Income per month')}</h2>
          </header>
          <BarChart data={stats.monthSeries} language={settings.language} />
        </article>

        <article className="card dashboard-card dashboard-card-fit income-entries-card">
          <header className="section-header">
            <h2>{t('Eintr?ge', 'Entries')}</h2>
            <div className="filters">
              <input
                type="search"
                value={entrySearchQuery}
                onChange={(event) => setEntrySearchQuery(event.target.value)}
                placeholder={t('Eintr?ge durchsuchen', 'Search entries')}
                aria-label={t('Eintr?ge durchsuchen', 'Search entries')}
                className="entry-search-input"
              />
            </div>
          </header>
          <div className="table-wrap income-entries-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t('Datum', 'Date')}</th>
                  <th>{t('Quelle', 'Source')}</th>
                  <th>{t('Betrag', 'Amount')}</th>
                  <th>{t('Typ', 'Type')}</th>
                  <th>{t('Aktionen', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {tableEntries.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateByPattern(item.date, settings.dateFormat)}</td>
                    <td>{incomeSourceLabel(item, settings.language)}</td>
                    <td>{formatMoney(item.amount, settings.currency, settings.privacyHideAmounts)}</td>
                    <td>{item.recurring === 'none' ? t('Einmalig', 'One-time') : t('Wiederkehrend', 'Recurring')}</td>
                    <td>
                      <div className="row-actions compact">
                        <button type="button" className="icon-button entry-action-button" onClick={() => startEdit(item)} aria-label={t('Bearbeiten', 'Edit')} title={t('Bearbeiten', 'Edit')}>
                          <svg viewBox="0 0 24 24" aria-hidden="true" className="entry-action-icon">
                            <path d="M4 20h4l10-10-4-4L4 16v4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                            <path d="m12 6 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button type="button" className="icon-button entry-action-button entry-action-button-danger" onClick={() => openDeleteConfirmation(item)} aria-label={t('L?schen', 'Delete')} title={t('L?schen', 'Delete')}>
                          <svg viewBox="0 0 24 24" aria-hidden="true" className="entry-action-icon">
                            <path d="M6 7h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <path d="M9 7V5h6v2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                            <path d="M8 7l1 12h6l1-12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                            <path d="M10 11v5M14 11v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tableEntries.length === 0 ? <p className="empty-inline table-empty-message">{t('Keine Einkommenseintr?ge f?r die aktuelle Auswahl.', 'No income entries for the current selection.')}</p> : null}
          </div>
        </article>
      </section>
    </section>
  )
}
