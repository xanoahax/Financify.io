import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart } from '../components/BarChart'
import { DonutChart } from '../components/DonutChart'
import { LineChart } from '../components/LineChart'
import { useAppContext } from '../state/useAppContext'
import type { IncomeEntry } from '../types/models'
import { addDays, endOfMonth, endOfYear, formatDateByPattern, monthLabel, monthKey, startOfMonth, startOfYear, todayString } from '../utils/date'
import { formatMoney, toPercent } from '../utils/format'
import { incomeByMonth, materializeIncomeEntriesForRange, monthOverMonthChange, monthStats, sourceBreakdown, sumIncome } from '../utils/income'
import { tx } from '../utils/i18n'
import { calculateShiftIncome } from '../utils/shiftIncome'

type IncomeFormState = Omit<IncomeEntry, 'id' | 'createdAt' | 'updatedAt'>
type IncomeFormMode = 'manual' | 'foodaffairs-shift'

interface ShiftLogFormState {
  date: string
  startTime: string
  endTime: string
}

interface IncomeDeleteConfirmState {
  id: string
  source: string
  date: string
}

const FOOD_AFFAIRS_SOURCE = 'FoodAffairs'

function parseTags(input: string): string[] {
  return input
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function parseOptionalNumberInput(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value)
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
    source: sourceDefault,
    tags: [],
    notes: '',
    recurring: 'none',
    recurringIntervalDays: undefined,
  }
}

function buildDefaultShiftForm(): ShiftLogFormState {
  return {
    date: todayString(),
    startTime: '09:00',
    endTime: '17:00',
  }
}

export function IncomePage(): JSX.Element {
  const { incomeEntries, settings, uiState, setUiState, addIncomeEntry, updateIncomeEntry, deleteIncomeEntry } = useAppContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [form, setForm] = useState<IncomeFormState>(() => buildDefaultForm(tx(settings.language, 'Gehalt', 'Salary')))
  const [formMode, setFormMode] = useState<IncomeFormMode>('manual')
  const [shiftForm, setShiftForm] = useState<ShiftLogFormState>(buildDefaultShiftForm())
  const [editId, setEditId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [formError, setFormError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<IncomeDeleteConfirmState | null>(null)
  const amountInputRef = useRef<HTMLInputElement | null>(null)
  const dateInputRef = useRef<HTMLInputElement | null>(null)
  const shiftDateInputRef = useRef<HTMLInputElement | null>(null)
  const t = (de: string, en: string) => tx(settings.language, de, en)

  const closeForm = useCallback((): void => {
    setIsFormOpen(false)
    setEditId(null)
    setFormMode('manual')
    setForm(buildDefaultForm(tx(settings.language, 'Gehalt', 'Salary')))
    setShiftForm(buildDefaultShiftForm())
    setTagInput('')
    setFormError('')
  }, [settings.language])

  useEffect(() => {
    if (searchParams.get('quickAdd') !== '1') {
      return
    }
    const frame = window.requestAnimationFrame(() => {
      setIsFormOpen(true)
      setEditId(null)
      setFormMode('manual')
      setForm(buildDefaultForm(tx(settings.language, 'Gehalt', 'Salary')))
      setShiftForm(buildDefaultShiftForm())
      setTagInput('')
      setFormError('')
      window.requestAnimationFrame(() => amountInputRef.current?.focus())
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('quickAdd')
      setSearchParams(nextParams, { replace: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [searchParams, setSearchParams, settings.language])

  useEffect(() => {
    if (!isFormOpen && !confirmDelete) {
      return
    }
    function onEscape(event: KeyboardEvent): void {
      if (event.key !== 'Escape') {
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
  }, [confirmDelete, isFormOpen, closeForm])

  const today = todayString()
  const currentMonth = monthKey(today)
  const currentYear = today.slice(0, 4)
  const sources = useMemo(() => [...new Set(incomeEntries.map((item) => item.source))], [incomeEntries])

  const sourceAndQueryFiltered = useMemo(() => {
    const query = uiState.globalSearch.trim().toLowerCase()
    return incomeEntries
      .filter((item) => (sourceFilter === 'all' ? true : item.source === sourceFilter))
      .filter((item) => {
        if (!query) {
          return true
        }
        const text = `${item.source} ${item.notes} ${item.tags.join(' ')}`.toLowerCase()
        return text.includes(query)
      })
  }, [incomeEntries, sourceFilter, uiState.globalSearch])

  const periodRange = useMemo(
    () =>
      viewMode === 'month'
        ? { start: startOfMonth(today), end: endOfMonth(today) }
        : { start: startOfYear(today), end: endOfYear(today) },
    [today, viewMode],
  )

  const tableEntries = useMemo(() => {
    return sourceAndQueryFiltered
      .filter((item) => (viewMode === 'month' ? monthKey(item.date) === currentMonth : item.date.startsWith(currentYear)))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [currentMonth, currentYear, sourceAndQueryFiltered, viewMode])

  const resolvedPeriodEntries = useMemo(
    () => materializeIncomeEntriesForRange(sourceAndQueryFiltered, periodRange.start, periodRange.end),
    [periodRange.end, periodRange.start, sourceAndQueryFiltered],
  )

  const rollingYearEntries = useMemo(
    () => materializeIncomeEntriesForRange(sourceAndQueryFiltered, addDays(today, -365), today),
    [sourceAndQueryFiltered, today],
  )

  const stats = useMemo(() => {
    const monthly = incomeByMonth(rollingYearEntries)
    return {
      total: sumIncome(resolvedPeriodEntries),
      monthSeries: monthly.map((item) => ({ label: monthLabel(item.month), value: item.value })).slice(-12),
      sourceSeries: sourceBreakdown(resolvedPeriodEntries),
      aggregates: monthStats(rollingYearEntries),
      mom: monthOverMonthChange(rollingYearEntries),
    }
  }, [resolvedPeriodEntries, rollingYearEntries])

  const foodAffairsHourlyRate = useMemo(() => {
    const rate = Number(settings.foodAffairsHourlyRate)
    return Number.isFinite(rate) && rate > 0 ? rate : 18
  }, [settings.foodAffairsHourlyRate])

  const shiftPreview = useMemo(() => {
    if (editId || formMode !== 'foodaffairs-shift') {
      return null
    }
    try {
      return calculateShiftIncome({
        date: shiftForm.date,
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        hourlyRate: foodAffairsHourlyRate,
      })
    } catch {
      return null
    }
  }, [editId, foodAffairsHourlyRate, formMode, shiftForm.date, shiftForm.endTime, shiftForm.startTime])

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    try {
      setFormError('')
      if (!editId && formMode === 'foodaffairs-shift') {
        const result = calculateShiftIncome({
          date: shiftForm.date,
          startTime: shiftForm.startTime,
          endTime: shiftForm.endTime,
          hourlyRate: foodAffairsHourlyRate,
        })
        await addIncomeEntry({
          amount: result.amount,
          date: shiftForm.date,
          source: FOOD_AFFAIRS_SOURCE,
          tags: ['FoodAffairs', t('Dienst', 'Shift')],
          notes: t(
            `Dienst ${shiftForm.startTime}-${shiftForm.endTime}${result.crossesMidnight ? ' (über Mitternacht)' : ''}`,
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
        tags: parseTags(tagInput),
        recurringIntervalDays: form.recurring === 'custom' ? Number(form.recurringIntervalDays) : undefined,
      }
      if (editId) {
        await updateIncomeEntry(editId, payload)
      } else {
        await addIncomeEntry(payload)
      }
      closeForm()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('Einkommenseintrag konnte nicht gespeichert werden.', 'Income entry could not be saved.'))
    }
  }

  function startEdit(item: IncomeEntry): void {
    setIsFormOpen(true)
    setEditId(item.id)
    setFormMode('manual')
    setForm({
      amount: item.amount,
      date: item.date,
      source: item.source,
      tags: item.tags,
      notes: item.notes,
      recurring: item.recurring,
      recurringIntervalDays: item.recurringIntervalDays,
    })
    setShiftForm(buildDefaultShiftForm())
    setTagInput(item.tags.join(', '))
    setFormError('')
    window.requestAnimationFrame(() => dateInputRef.current?.focus())
  }

  function openAddForm(nextMode: IncomeFormMode = 'manual'): void {
    setIsFormOpen(true)
    setEditId(null)
    setFormMode(nextMode)
    setForm(buildDefaultForm(t('Gehalt', 'Salary')))
    setShiftForm(buildDefaultShiftForm())
    setTagInput('')
    setFormError('')
    window.requestAnimationFrame(() => {
      if (nextMode === 'foodaffairs-shift') {
        shiftDateInputRef.current?.focus()
        return
      }
      amountInputRef.current?.focus()
    })
  }

  function openDeleteConfirmation(item: IncomeEntry): void {
    setConfirmDelete({ id: item.id, source: item.source, date: item.date })
  }

  async function handleDeleteConfirmed(): Promise<void> {
    if (!confirmDelete) {
      return
    }
    try {
      await deleteIncomeEntry(confirmDelete.id)
      setConfirmDelete(null)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('Einkommenseintrag konnte nicht gelöscht werden.', 'Income entry could not be deleted.'))
      setConfirmDelete(null)
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div className="page-title-actions">
          <h1>{t('Einkommen', 'Income')}</h1>
          <button type="button" className="button button-primary" onClick={() => openAddForm('manual')}>
            {t('Einkommen hinzufügen', 'Add income')}
          </button>
          <button type="button" className="button button-secondary" onClick={() => openAddForm('foodaffairs-shift')}>
            {t('FoodAffairs-Dienst loggen', 'Log FoodAffairs shift')}
          </button>
        </div>
        <div className="page-actions">
          <div className="segmented">
            <button type="button" className={viewMode === 'month' ? 'active' : ''} onClick={() => setViewMode('month')}>
              {t('Monat', 'Month')}
            </button>
            <button type="button" className={viewMode === 'year' ? 'active' : ''} onClick={() => setViewMode('year')}>
              {t('Jahr', 'Year')}
            </button>
          </div>
          <input
            value={uiState.globalSearch}
            onChange={(event) => setUiState({ globalSearch: event.target.value })}
            placeholder={t('Einkommen suchen...', 'Search income...')}
            aria-label={t('Einkommen suchen', 'Search income')}
          />
        </div>
      </header>

      <div className="stats-grid">
        <article className="card stat-card">
          <p className="muted">{t('Einkommen gesamt', 'Total income')} ({viewMode === 'month' ? t('Monat', 'month') : t('Jahr', 'year')})</p>
          <p className="stat-value">{formatMoney(stats.total, settings.currency, settings.decimals, settings.privacyHideAmounts)}</p>
          <p className="hint">{t('Enthält wiederkehrende Einträge im gewählten Zeitraum.', 'Includes recurring entries in the selected period.')}</p>
        </article>
        <article className="card stat-card">
          <p className="muted">{t('Monatlicher Durchschnitt', 'Monthly average')}</p>
          <p className="stat-value">{formatMoney(stats.aggregates.average, settings.currency, settings.decimals, settings.privacyHideAmounts)}</p>
        </article>
        <article className="card stat-card">
          <p className="muted">{t('Monatlicher Median', 'Monthly median')}</p>
          <p className="stat-value">{formatMoney(stats.aggregates.median, settings.currency, settings.decimals, settings.privacyHideAmounts)}</p>
          <p className="hint">{t('Vgl. Vormonat', 'vs previous month')}: {toPercent(stats.mom)}</p>
        </article>
      </div>

      <div className="two-column two-column-equal">
        <article className="card">
          <header className="section-header">
            <h2>{t('Quellenaufteilung', 'Source breakdown')}</h2>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value="all">{t('Alle Quellen', 'All sources')}</option>
              {sources.map((source) => (
                <option value={source} key={source}>
                  {source}
                </option>
              ))}
            </select>
          </header>
          <DonutChart data={stats.sourceSeries} />
        </article>
        <article className="card">
          <header className="section-header">
            <h2>{t('Trend (12 Monate)', 'Trend (12 months)')}</h2>
          </header>
          <LineChart data={stats.monthSeries} />
        </article>
      </div>

      {isFormOpen ? (
        <div className="form-modal-backdrop" onClick={closeForm} role="presentation">
          <article className="card form-modal" onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>
                {editId ? t('Einkommen bearbeiten', 'Edit income') : formMode === 'foodaffairs-shift' ? t('FoodAffairs-Dienst loggen', 'Log FoodAffairs shift') : t('Einkommen hinzufügen', 'Add income')}
              </h2>
              <button type="button" className="icon-button" onClick={closeForm} aria-label={t('Popup schließen', 'Close popup')}>
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
                  className={formMode === 'foodaffairs-shift' ? 'active' : ''}
                  onClick={() => {
                    setFormMode('foodaffairs-shift')
                    setFormError('')
                    window.requestAnimationFrame(() => shiftDateInputRef.current?.focus())
                  }}
                >
                  {t('FoodAffairs-Dienst', 'FoodAffairs shift')}
                </button>
              </div>
            ) : null}
            {formError ? <p className="error-text">{formError}</p> : null}
            <form className="form-grid" onSubmit={onSubmit}>
              {!editId && formMode === 'foodaffairs-shift' ? (
                <>
                  <label>
                    {t('Datum', 'Date')}
                    <input ref={shiftDateInputRef} type="date" value={shiftForm.date} onChange={(event) => setShiftForm((current) => ({ ...current, date: event.target.value }))} required />
                  </label>
                  <label>
                    {t('Quelle', 'Source')}
                    <input value={FOOD_AFFAIRS_SOURCE} readOnly aria-readonly="true" />
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
                    <small className="muted">{t('Stundensatz', 'Hourly rate')}: {foodAffairsHourlyRate} €/h</small>
                    <strong>
                      {t('Berechnetes Einkommen', 'Calculated income')}:{' '}
                      {shiftPreview ? formatMoney(shiftPreview.amount, settings.currency, settings.decimals, settings.privacyHideAmounts) : '—'}
                    </strong>
                    <small className="muted">
                      {shiftPreview
                        ? `${t('Dauer', 'Duration')}: ${formatDurationHours(shiftPreview.durationHours, settings.language)}${shiftPreview.crossesMidnight ? t(' (über Mitternacht)', ' (overnight)') : ''}`
                        : t('Bitte gültige Start- und Endzeit eingeben.', 'Please enter valid start and end times.')}
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
                    <input value={form.source} onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))} required />
                  </label>
                  <label>
                    {t('Wiederkehrend', 'Recurring')}
                    <select value={form.recurring} onChange={(event) => setForm((current) => ({ ...current, recurring: event.target.value as IncomeEntry['recurring'] }))}>
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
                  {editId ? t('Aktualisieren', 'Update') : formMode === 'foodaffairs-shift' ? t('Dienst speichern', 'Save shift') : t('Speichern', 'Save')}
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
        <div className="form-modal-backdrop" onClick={() => setConfirmDelete(null)} role="presentation">
          <article className="card form-modal confirm-modal" onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{t('Einkommenseintrag löschen?', 'Delete income entry?')}</h2>
              <button type="button" className="icon-button" onClick={() => setConfirmDelete(null)} aria-label={t('Popup schließen', 'Close popup')}>
                x
              </button>
            </header>
            <p>
              {t('Möchtest du den Eintrag', 'Do you really want to delete the entry')} "{confirmDelete.source}" {t('vom', 'from')}{' '}
              {formatDateByPattern(confirmDelete.date, settings.dateFormat)} {t('wirklich löschen?', '?')}
            </p>
            <div className="form-actions">
              <button type="button" className="button button-danger" onClick={() => void handleDeleteConfirmed()}>
                {t('Löschen', 'Delete')}
              </button>
              <button type="button" className="button button-secondary" onClick={() => setConfirmDelete(null)}>
                {t('Abbrechen', 'Cancel')}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      <article className="card">
        <header className="section-header">
          <h2>{t('Einkommen pro Monat', 'Income per month')}</h2>
        </header>
        <BarChart data={stats.monthSeries} />
      </article>

      <article className="card">
        <header className="section-header">
          <h2>{t('Einträge', 'Entries')}</h2>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('Datum', 'Date')}</th>
                <th>{t('Quelle', 'Source')}</th>
                <th>{t('Betrag', 'Amount')}</th>
                <th>{t('Tags', 'Tags')}</th>
                <th>{t('Aktionen', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {tableEntries.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateByPattern(item.date, settings.dateFormat)}</td>
                  <td>{item.source}</td>
                  <td>{formatMoney(item.amount, settings.currency, settings.decimals, settings.privacyHideAmounts)}</td>
                  <td>{item.tags.join(', ') || '-'}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="button button-tertiary" onClick={() => startEdit(item)}>
                        {t('Bearbeiten', 'Edit')}
                      </button>
                      <button type="button" className="button button-danger" onClick={() => openDeleteConfirmation(item)}>
                        {t('Löschen', 'Delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tableEntries.length === 0 ? <p className="empty-inline">{t('Keine Einkommenseinträge für die ausgewählte Ansicht.', 'No income entries for the selected view.')}</p> : null}
        </div>
      </article>
    </section>
  )
}
