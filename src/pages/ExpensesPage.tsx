import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { DonutChart } from '../components/DonutChart'
import { LineChart } from '../components/LineChart'
import { useCardRowStagger } from '../hooks/useCardRowStagger'
import { useGuardedBackdropClose } from '../hooks/useGuardedBackdropClose'
import { useAppContext } from '../state/useAppContext'
import type { ExpenseEntry } from '../types/models'
import { addDays, addMonths, endOfMonth, endOfYear, formatDateByPattern, monthLabel, monthKey, startOfMonth, startOfYear, todayString } from '../utils/date'
import { materializeExpenseEntriesForRange, expenseByMonth, expenseCategoryBreakdown, monthOverMonthChange, monthStats, sumExpenses } from '../utils/expense'
import { formatMoney, toPercent } from '../utils/format'
import { tx } from '../utils/i18n'

type ExpenseFormState = Omit<ExpenseEntry, 'id' | 'createdAt' | 'updatedAt'>
type ChangeScope = 'retroactive' | 'from-date'
type ExpenseTrendRange = 3 | 6 | 12

interface ExpenseDeleteConfirmState {
  id: string
  title: string
  date: string
}

interface PendingExpenseUpdateState {
  id: string
  payload: ExpenseFormState
}

const EXPENSE_CATEGORY_PRESETS = {
  de: ['Lebensmittel', 'Shopping', 'Elektronik', 'Auto', 'Transport', 'Freizeit', 'Reisen', 'Gesundheit', 'Apotheke', 'Geschenke', 'Sonstiges'],
  en: ['Groceries', 'Shopping', 'Electronics', 'Car', 'Transport', 'Leisure', 'Travel', 'Health', 'Pharmacy', 'Gifts', 'Other'],
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

function persistedExpenseEntryId(entryId: string): string {
  const separatorIndex = entryId.indexOf('::')
  return separatorIndex >= 0 ? entryId.slice(0, separatorIndex) : entryId
}

function buildDefaultForm(defaultCategory: string): ExpenseFormState {
  return {
    amount: Number.NaN,
    date: todayString(),
    endDate: undefined,
    title: '',
    category: defaultCategory,
    tags: [],
    notes: '',
    recurring: 'none',
    recurringIntervalDays: undefined,
  }
}

export function ExpensesPage(): JSX.Element {
  const { expenseEntries, settings, addExpenseEntry, updateExpenseEntry, deleteExpenseEntry } = useAppContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [form, setForm] = useState<ExpenseFormState>(() => buildDefaultForm(tx(settings.language, 'Sonstiges', 'Other')))
  const [editId, setEditId] = useState<string | null>(null)
  const [effectiveFromDate, setEffectiveFromDate] = useState(todayString())
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month')
  const [selectedMonth, setSelectedMonth] = useState(() => monthKey(todayString()))
  const [selectedYear, setSelectedYear] = useState(() => todayString().slice(0, 4))
  const [entrySearchQuery, setEntrySearchQuery] = useState('')
  const [trendRange, setTrendRange] = useState<ExpenseTrendRange>(6)
  const [formError, setFormError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<ExpenseDeleteConfirmState | null>(null)
  const [pendingExpenseUpdate, setPendingExpenseUpdate] = useState<PendingExpenseUpdateState | null>(null)
  const amountInputRef = useRef<HTMLInputElement | null>(null)
  const dateInputRef = useRef<HTMLInputElement | null>(null)
  const pageRef = useRef<HTMLElement | null>(null)
  const t = useCallback((de: string, en: string) => tx(settings.language, de, en), [settings.language])
  const monthLocale = settings.language === 'de' ? 'de-DE' : 'en-US'

  useCardRowStagger(pageRef)

  const existingCategories = useMemo(() => {
    const unique = new Set<string>()
    for (const entry of expenseEntries) {
      const category = entry.category.trim()
      if (category) {
        unique.add(category)
      }
    }
    return [...unique]
  }, [expenseEntries])

  const categoryOptions = useMemo(() => {
    const presets = settings.language === 'de' ? EXPENSE_CATEGORY_PRESETS.de : EXPENSE_CATEGORY_PRESETS.en
    const unique = new Set<string>(presets)
    for (const category of existingCategories) {
      unique.add(category)
    }
    return [...unique]
  }, [existingCategories, settings.language])

  const categorySelectOptions = useMemo(() => {
    const currentCategory = form.category.trim()
    if (!currentCategory || categoryOptions.includes(currentCategory)) {
      return categoryOptions
    }
    return [currentCategory, ...categoryOptions]
  }, [categoryOptions, form.category])

  const closeForm = useCallback((): void => {
    setIsFormOpen(false)
    setEditId(null)
    setForm(buildDefaultForm(tx(settings.language, 'Sonstiges', 'Other')))
    setEffectiveFromDate(todayString())
    setTagInput('')
    setFormError('')
    setPendingExpenseUpdate(null)
  }, [settings.language])
  const closeConfirmDelete = useCallback(() => setConfirmDelete(null), [])
  const closePendingExpenseUpdate = useCallback(() => setPendingExpenseUpdate(null), [])
  const formBackdropCloseGuard = useGuardedBackdropClose(closeForm)
  const confirmBackdropCloseGuard = useGuardedBackdropClose(closeConfirmDelete)
  const pendingExpenseUpdateBackdropCloseGuard = useGuardedBackdropClose(closePendingExpenseUpdate)

  useEffect(() => {
    const quickAdd = searchParams.get('quickAdd')
    if (quickAdd !== '1' && quickAdd !== 'expense') {
      return
    }
    const frame = window.requestAnimationFrame(() => {
      setIsFormOpen(true)
      setEditId(null)
      setForm(buildDefaultForm(t('Sonstiges', 'Other')))
      setEffectiveFromDate(todayString())
      setTagInput('')
      setFormError('')
      window.requestAnimationFrame(() => amountInputRef.current?.focus())
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('quickAdd')
      setSearchParams(nextParams, { replace: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [searchParams, setSearchParams, t])

  useEffect(() => {
    if (!isFormOpen && !confirmDelete) {
      return
    }
    function onEscape(event: KeyboardEvent): void {
      if (event.key !== 'Escape') {
        return
      }
      if (pendingExpenseUpdate) {
        setPendingExpenseUpdate(null)
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
  }, [closeForm, confirmDelete, isFormOpen, pendingExpenseUpdate])

  const hasRecurringImpactChange = useCallback((existing: ExpenseEntry, payload: ExpenseFormState): boolean => {
    return (
      payload.amount !== existing.amount ||
      payload.title !== existing.title ||
      payload.category !== existing.category ||
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
    for (const entry of expenseEntries) {
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
  }, [currentYearNumber, expenseEntries])

  useEffect(() => {
    if (selectableYears.length === 0) {
      return
    }
    if (!selectableYears.includes(selectedYear)) {
      setSelectedYear(selectableYears[0])
    }
  }, [selectableYears, selectedYear])

  const periodRange = useMemo(
    () =>
      viewMode === 'month'
        ? { start: startOfMonth(selectedMonthDate), end: endOfMonth(selectedMonthDate) }
        : { start: startOfYear(selectedYearStartDate), end: endOfYear(selectedYearStartDate) },
    [selectedMonthDate, selectedYearStartDate, viewMode],
  )

  const tableEntries = useMemo(() => {
    const normalizedQuery = entrySearchQuery.trim().toLowerCase()

    return [...expenseEntries]
      .filter((item) => {
        if (!normalizedQuery) {
          return true
        }

        const searchableText = [
          formatDateByPattern(item.date, settings.dateFormat),
          item.title,
          item.category,
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
  }, [entrySearchQuery, expenseEntries, settings.currency, settings.dateFormat, settings.privacyHideAmounts, t])

  const resolvedPeriodEntries = useMemo(
    () => materializeExpenseEntriesForRange(expenseEntries, periodRange.start, periodRange.end),
    [expenseEntries, periodRange.end, periodRange.start],
  )

  const selectedYearToDateEntries = useMemo(
    () => materializeExpenseEntriesForRange(expenseEntries, startOfYear(selectedYearStartDate), isSelectedYearCurrent ? today : selectedYearEndDate),
    [expenseEntries, isSelectedYearCurrent, selectedYearEndDate, selectedYearStartDate, today],
  )

  const selectedYearForecastEntries = useMemo(
    () => materializeExpenseEntriesForRange(expenseEntries, startOfYear(selectedYearStartDate), selectedYearEndDate),
    [expenseEntries, selectedYearEndDate, selectedYearStartDate],
  )

  const selectedMonthRollingEntries = useMemo(() => {
    const rangeEnd = endOfMonth(selectedMonthDate)
    const rangeStart = startOfMonth(addMonths(selectedMonthDate, -11))
    return materializeExpenseEntriesForRange(expenseEntries, rangeStart, rangeEnd)
  }, [expenseEntries, selectedMonthDate])

  const rollingYearEntries = useMemo(
    () => materializeExpenseEntriesForRange(expenseEntries, addDays(today, -365), today),
    [expenseEntries, today],
  )

  const stats = useMemo(() => {
    const comparisonEntries = viewMode === 'month' ? selectedMonthRollingEntries : rollingYearEntries
    const monthly = expenseByMonth(comparisonEntries)
    const totalEntries = viewMode === 'year' && isSelectedYearCurrent ? selectedYearToDateEntries : resolvedPeriodEntries
    return {
      total: sumExpenses(totalEntries),
      yearForecastTotal: sumExpenses(selectedYearForecastEntries),
      monthSeries: monthly.map((item) => ({ label: monthLabel(item.month, monthLocale), value: item.value })).slice(-12),
      categorySeries: expenseCategoryBreakdown(totalEntries),
      aggregates: monthStats(comparisonEntries),
      mom: monthOverMonthChange(comparisonEntries),
    }
  }, [isSelectedYearCurrent, monthLocale, resolvedPeriodEntries, rollingYearEntries, selectedMonthRollingEntries, selectedYearForecastEntries, selectedYearToDateEntries, viewMode])

  const selectedMonthLabel = useMemo(() => monthLabel(selectedMonth, monthLocale), [monthLocale, selectedMonth])
  const trendRangeOptions: Array<{ value: ExpenseTrendRange; label: string }> = [
    { value: 3, label: t('3 Monate', '3 months') },
    { value: 6, label: t('6 Monate', '6 months') },
    { value: 12, label: t('12 Monate', '12 months') },
  ]
  const filteredTrendSeries = useMemo(() => stats.monthSeries.slice(-trendRange), [stats.monthSeries, trendRange])

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    try {
      setFormError('')
      const payload: ExpenseFormState = {
        amount: Number(form.amount),
        date: form.date,
        endDate: form.endDate || undefined,
        title: form.title.trim(),
        category: form.category.trim(),
        tags: parseTags(tagInput),
        notes: form.notes.trim(),
        recurring: form.recurring,
        recurringIntervalDays: form.recurring === 'custom' ? Number(form.recurringIntervalDays) : undefined,
      }

      if (editId) {
        const existing = expenseEntries.find((item) => item.id === editId)
        if (!existing) {
          throw new Error(t('Ausgabe konnte nicht geladen werden.', 'Expense could not be loaded.'))
        }
        const hasChangeScopePrompt = payload.recurring !== 'none' && hasRecurringImpactChange(existing, payload)
        if (hasChangeScopePrompt) {
          setPendingExpenseUpdate({ id: editId, payload })
          return
        }
        await updateExpenseEntry(editId, payload)
      } else {
        await addExpenseEntry(payload)
      }
      closeForm()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('Ausgabe konnte nicht gespeichert werden.', 'Expense could not be saved.'))
    }
  }

  async function applyPendingExpenseUpdate(scope: ChangeScope): Promise<void> {
    if (!pendingExpenseUpdate) {
      return
    }
    try {
      setFormError('')
      const options = scope === 'from-date' ? { effectiveFrom: effectiveFromDate } : undefined
      await updateExpenseEntry(pendingExpenseUpdate.id, pendingExpenseUpdate.payload, options)
      closeForm()
      setPendingExpenseUpdate(null)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('Ausgabe konnte nicht aktualisiert werden.', 'Expense could not be updated.'))
      setPendingExpenseUpdate(null)
    }
  }

  function startEdit(item: ExpenseEntry): void {
    const sourceId = persistedExpenseEntryId(item.id)
    const sourceEntry = expenseEntries.find((entry) => entry.id === sourceId)
    if (!sourceEntry) {
      setFormError(t('Ausgabe konnte nicht geladen werden.', 'Expense could not be loaded.'))
      return
    }
    setIsFormOpen(true)
    setEditId(sourceId)
    setForm({
      amount: sourceEntry.amount,
      date: sourceEntry.date,
      endDate: sourceEntry.endDate,
      title: sourceEntry.title,
      category: sourceEntry.category,
      tags: sourceEntry.tags,
      notes: sourceEntry.notes,
      recurring: sourceEntry.recurring,
      recurringIntervalDays: sourceEntry.recurringIntervalDays,
    })
    setEffectiveFromDate(sourceEntry.recurring !== 'none' ? item.date : todayString())
    setTagInput(sourceEntry.tags.join(', '))
    setFormError('')
    window.requestAnimationFrame(() => dateInputRef.current?.focus())
  }

  function openAddForm(): void {
    setIsFormOpen(true)
    setEditId(null)
    setForm(buildDefaultForm(t('Sonstiges', 'Other')))
    setEffectiveFromDate(todayString())
    setTagInput('')
    setFormError('')
    window.requestAnimationFrame(() => amountInputRef.current?.focus())
  }

  function openDeleteConfirmation(item: ExpenseEntry): void {
    setConfirmDelete({ id: persistedExpenseEntryId(item.id), title: item.title, date: item.date })
  }

  async function handleDeleteConfirmed(): Promise<void> {
    if (!confirmDelete) {
      return
    }
    try {
      await deleteExpenseEntry(confirmDelete.id)
      setConfirmDelete(null)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('Ausgabe konnte nicht gelöscht werden.', 'Expense could not be deleted.'))
      setConfirmDelete(null)
    }
  }

  return (
    <section ref={pageRef} className="page">
      <section className="page-top-row">
        <header className="page-header page-header-compact">
          <div className="page-title-actions">
            <h1>{t('Ausgaben', 'Expenses')}</h1>
          </div>
          <div className="page-actions">
            <button type="button" className="shell-plus-button" onClick={openAddForm} aria-label={t('Ausgabe hinzufügen', 'Add expense')} title={t('Ausgabe hinzufügen', 'Add expense')}>
              +
            </button>
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
              <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} aria-label={t('Jahr auswählen', 'Select year')}>
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
              {t('Ausgaben gesamt', 'Total expenses')} ({viewMode === 'month' ? selectedMonthLabel : selectedYear})
            </p>
            <p className="stat-value"><AnimatedNumber value={stats.total} formatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)} /></p>
            {viewMode === 'year' ? (
              <p className="hint">
                {t('Forecast:', 'Forecast:')} {formatMoney(stats.yearForecastTotal, settings.currency, settings.privacyHideAmounts)}
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
            reverseColorScale
          />
        </article>
        <article className="card">
          <header className="section-header">
            <h2>{t('Kategorie-Aufteilung', 'Category breakdown')}</h2>
          </header>
          <DonutChart
            data={stats.categorySeries}
            language={settings.language}
            valueFormatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)}
            reverseColorScale
          />
        </article>
      </div>

      <section className="dashboard-grid">
        <article className="card dashboard-card dashboard-card-fit card-span-2 income-entries-card">
          <header className="section-header">
            <h2>{t('Einträge', 'Entries')}</h2>
            <input
              className="entry-search-input"
              value={entrySearchQuery}
              onChange={(event) => setEntrySearchQuery(event.target.value)}
              placeholder={t('Ausgaben durchsuchen', 'Search expenses')}
              aria-label={t('Ausgaben durchsuchen', 'Search expenses')}
            />
          </header>
          <div className="income-entries-scroll">
            <ul className="clean-list table-list">
              {tableEntries.map((item) => (
                <li key={item.id} className="table-row-card">
                  <div>
                    <strong>{item.title}</strong>
                    <p className="muted">{item.category} · {formatDateByPattern(item.date, settings.dateFormat)}</p>
                  </div>
                  <div className="table-row-end">
                    <strong>{formatMoney(item.amount, settings.currency, settings.privacyHideAmounts)}</strong>
                    <div className="row-actions compact">
                      <button type="button" className="icon-button entry-action-button" onClick={() => startEdit(item)} aria-label={t('Bearbeiten', 'Edit')} title={t('Bearbeiten', 'Edit')}>
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="entry-action-icon">
                          <path d="M4 20h4l10-10-4-4L4 16v4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                          <path d="m12 6 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button type="button" className="icon-button entry-action-button entry-action-button-danger" onClick={() => openDeleteConfirmation(item)} aria-label={t('Löschen', 'Delete')} title={t('Löschen', 'Delete')}>
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="entry-action-icon">
                          <path d="M6 7h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <path d="M9 7V5h6v2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                          <path d="M8 7l1 12h6l1-12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                          <path d="M10 11v5M14 11v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {tableEntries.length === 0 ? <p className="empty-inline table-empty-message">{t('Keine Ausgaben für die aktuelle Suche.', 'No expenses match the current search.')}</p> : null}
          </div>
        </article>
      </section>

      {isFormOpen ? (
        <div className="form-modal-backdrop" onMouseDown={formBackdropCloseGuard.onBackdropMouseDown} onClick={formBackdropCloseGuard.onBackdropClick} role="presentation">
          <article className="card form-modal" onMouseDownCapture={formBackdropCloseGuard.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{editId ? t('Ausgabe bearbeiten', 'Edit expense') : t('Ausgabe hinzufügen', 'Add expense')}</h2>
              <button type="button" className="icon-button" onClick={closeForm} aria-label={t('Popup schließen', 'Close popup')}>
                x
              </button>
            </header>
            {formError ? <p className="error-text">{formError}</p> : null}
            <form className="form-grid" onSubmit={onSubmit}>
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
                {t('Ausgabe', 'Expense')}
                <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder={t('z. B. Neuer Fernseher', 'e.g. New TV')} required />
              </label>
              <label>
                {t('Kategorie', 'Category')}
                <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} required>
                  {categorySelectOptions.map((categoryOption) => (
                    <option key={categoryOption} value={categoryOption}>
                      {categoryOption}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('Wiederkehrend', 'Recurring')}
                <select value={form.recurring} onChange={(event) => setForm((current) => ({ ...current, recurring: event.target.value as ExpenseEntry['recurring'] }))}>
                  <option value="none">{t('Nein', 'No')}</option>
                  <option value="weekly">{t('Wöchentlich', 'Weekly')}</option>
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
                  {t('Änderung wirksam ab', 'Change effective from')}
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

              <div className="form-actions full-width">
                <button type="submit" className="button button-primary">
                  {editId ? t('Aktualisieren', 'Update') : t('Speichern', 'Save')}
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
        <div className="form-modal-backdrop" onMouseDown={confirmBackdropCloseGuard.onBackdropMouseDown} onClick={confirmBackdropCloseGuard.onBackdropClick} role="presentation">
          <article className="card form-modal confirm-modal" onMouseDownCapture={confirmBackdropCloseGuard.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{t('Ausgabe löschen?', 'Delete expense?')}</h2>
              <button type="button" className="icon-button" onClick={closeConfirmDelete} aria-label={t('Popup schließen', 'Close popup')}>
                x
              </button>
            </header>
            <p>
              {t('Möchtest du den Eintrag', 'Do you really want to delete the entry')} "{confirmDelete.title}" {t('vom', 'from')}{' '}
              {formatDateByPattern(confirmDelete.date, settings.dateFormat)} {t('wirklich löschen?', '?')}
            </p>
            <div className="form-actions">
              <button type="button" className="button button-danger" onClick={() => void handleDeleteConfirmed()}>
                {t('Löschen', 'Delete')}
              </button>
              <button type="button" className="button button-secondary" onClick={closeConfirmDelete}>
                {t('Abbrechen', 'Cancel')}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {pendingExpenseUpdate ? (
        <div className="form-modal-backdrop" onMouseDown={pendingExpenseUpdateBackdropCloseGuard.onBackdropMouseDown} onClick={pendingExpenseUpdateBackdropCloseGuard.onBackdropClick} role="presentation">
          <article className="card form-modal confirm-modal" onMouseDownCapture={pendingExpenseUpdateBackdropCloseGuard.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{t('Änderung anwenden', 'Apply change')}</h2>
              <button type="button" className="icon-button" onClick={closePendingExpenseUpdate} aria-label={t('Popup schließen', 'Close popup')}>
                x
              </button>
            </header>
            <p>{t('Soll die Änderung rückwirkend gelten oder erst ab einem bestimmten Datum?', 'Should the change apply retroactively or from a specific date?')}</p>
            <label>
              {t('Ab Datum', 'From date')}
              <input type="date" value={effectiveFromDate} onChange={(event) => setEffectiveFromDate(event.target.value)} required />
            </label>
            <div className="form-actions">
              <button type="button" className="button button-primary" onClick={() => void applyPendingExpenseUpdate('retroactive')}>
                {t('Rückwirkend', 'Retroactive')}
              </button>
              <button type="button" className="button button-secondary" onClick={() => void applyPendingExpenseUpdate('from-date')}>
                {t('Ab Datum übernehmen', 'Apply from date')}
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  )
}





