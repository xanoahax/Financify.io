import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart } from '../components/BarChart'
import { DonutChart } from '../components/DonutChart'
import { LineChart } from '../components/LineChart'
import { useAppContext } from '../state/useAppContext'
import type { IncomeEntry } from '../types/models'
import { addDays, endOfMonth, endOfYear, formatDateByPattern, monthLabel, monthKey, startOfMonth, startOfYear, todayString } from '../utils/date'
import { formatMoney, getCurrencySymbol, toPercent } from '../utils/format'
import { incomeByMonth, materializeIncomeEntriesForRange, monthOverMonthChange, monthStats, sourceBreakdown, sumIncome } from '../utils/income'
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

function parseTags(input: string): string[] {
  return input
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function parseOptionalNumberInput(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value)
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
  const { incomeEntries, settings, uiState, setUiState, addIncomeEntry, updateIncomeEntry, deleteIncomeEntry } = useAppContext()
  const shiftJobs = settings.shiftJobs
  const resolvedDefaultShiftJobId = shiftJobs.some((job) => job.id === settings.defaultShiftJobId) ? settings.defaultShiftJobId : (shiftJobs[0]?.id ?? '')
  const [searchParams, setSearchParams] = useSearchParams()
  const [form, setForm] = useState<IncomeFormState>(() => buildDefaultForm(tx(settings.language, 'Gehalt', 'Salary')))
  const [formMode, setFormMode] = useState<IncomeFormMode>('manual')
  const [shiftForm, setShiftForm] = useState<ShiftLogFormState>(buildDefaultShiftForm(resolvedDefaultShiftJobId))
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
  const monthLocale = settings.language === 'de' ? 'de-DE' : 'en-US'
  const currencySymbol = getCurrencySymbol(settings.currency)
  const selectedShiftJob = useMemo(
    () => shiftJobs.find((job) => job.id === shiftForm.jobId) ?? shiftJobs.find((job) => job.id === resolvedDefaultShiftJobId) ?? null,
    [resolvedDefaultShiftJobId, shiftForm.jobId, shiftJobs],
  )

  const closeForm = useCallback((): void => {
    setIsFormOpen(false)
    setEditId(null)
    setFormMode('manual')
    setForm(buildDefaultForm(tx(settings.language, 'Gehalt', 'Salary')))
    setShiftForm(buildDefaultShiftForm(resolvedDefaultShiftJobId))
    setTagInput('')
    setFormError('')
  }, [resolvedDefaultShiftJobId, settings.language])

  useEffect(() => {
    if (searchParams.get('quickAdd') !== '1') {
      return
    }
    const frame = window.requestAnimationFrame(() => {
      setIsFormOpen(true)
      setEditId(null)
      setFormMode('manual')
      setForm(buildDefaultForm(tx(settings.language, 'Gehalt', 'Salary')))
      setShiftForm(buildDefaultShiftForm(resolvedDefaultShiftJobId))
      setTagInput('')
      setFormError('')
      window.requestAnimationFrame(() => amountInputRef.current?.focus())
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('quickAdd')
      setSearchParams(nextParams, { replace: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [resolvedDefaultShiftJobId, searchParams, setSearchParams, settings.language])

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
  const sources = useMemo(
    () => [...new Set(incomeEntries.map((item) => incomeSourceLabel(item, settings.language)))],
    [incomeEntries, settings.language],
  )

  const sourceAndQueryFiltered = useMemo(() => {
    const query = uiState.globalSearch.trim().toLowerCase()
    return incomeEntries
      .filter((item) => {
        const sourceLabel = incomeSourceLabel(item, settings.language)
        return sourceFilter === 'all' ? true : sourceLabel === sourceFilter
      })
      .filter((item) => {
        if (!query) {
          return true
        }
        const sourceLabel = incomeSourceLabel(item, settings.language)
        const text = `${sourceLabel} ${item.source} ${item.notes} ${item.tags.join(' ')}`.toLowerCase()
        return text.includes(query)
      })
  }, [incomeEntries, settings.language, sourceFilter, uiState.globalSearch])

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
      monthSeries: monthly.map((item) => ({ label: monthLabel(item.month, monthLocale), value: item.value })).slice(-12),
      sourceSeries: sourceBreakdown(resolvedPeriodEntries, (entry) => incomeSourceLabel(entry, settings.language)),
      aggregates: monthStats(rollingYearEntries),
      mom: monthOverMonthChange(rollingYearEntries),
    }
  }, [monthLocale, resolvedPeriodEntries, rollingYearEntries, settings.language])

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
          throw new Error(t('Kein Job konfiguriert. Bitte zuerst in den Einstellungen einen Job anlegen.', 'No job configured. Please add a job in settings first.'))
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
    setShiftForm(buildDefaultShiftForm(resolvedDefaultShiftJobId))
    setTagInput(item.tags.join(', '))
    setFormError('')
    window.requestAnimationFrame(() => dateInputRef.current?.focus())
  }

  function openAddForm(nextMode: IncomeFormMode = 'manual'): void {
    setIsFormOpen(true)
    setEditId(null)
    setFormMode(nextMode)
    setForm(buildDefaultForm(t('Gehalt', 'Salary')))
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
    setConfirmDelete({ id: item.id, source: incomeSourceLabel(item, settings.language), date: item.date })
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
          <button
            type="button"
            className="button button-secondary"
            onClick={() => openAddForm('job-shift')}
            disabled={shiftJobs.length === 0}
            title={shiftJobs.length === 0 ? t('Bitte zuerst einen Job in Einstellungen anlegen.', 'Please add a job in settings first.') : undefined}
          >
            {t('Dienst loggen', 'Log shift')}
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
          <p className="stat-value">{formatMoney(stats.total, settings.currency, settings.privacyHideAmounts)}</p>
          <p className="hint">{t('Enthält wiederkehrende Einträge im gewählten Zeitraum.', 'Includes recurring entries in the selected period.')}</p>
        </article>
        <article className="card stat-card">
          <p className="muted">{t('Monatlicher Durchschnitt', 'Monthly average')}</p>
          <p className="stat-value">{formatMoney(stats.aggregates.average, settings.currency, settings.privacyHideAmounts)}</p>
        </article>
        <article className="card stat-card">
          <p className="muted">{t('Monatlicher Median', 'Monthly median')}</p>
          <p className="stat-value">{formatMoney(stats.aggregates.median, settings.currency, settings.privacyHideAmounts)}</p>
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
          <DonutChart data={stats.sourceSeries} language={settings.language} />
        </article>
        <article className="card">
          <header className="section-header">
            <h2>{t('Trend (12 Monate)', 'Trend (12 months)')}</h2>
          </header>
          <LineChart data={stats.monthSeries} language={settings.language} />
        </article>
      </div>

      {isFormOpen ? (
        <div className="form-modal-backdrop" onClick={closeForm} role="presentation">
          <article className="card form-modal" onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>
                {editId ? t('Einkommen bearbeiten', 'Edit income') : formMode === 'job-shift' ? t('Dienst loggen', 'Log shift') : t('Einkommen hinzufügen', 'Add income')}
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
                    {t('Quelle', 'Source')}
                    <input value={selectedShiftJob?.name ?? ''} readOnly aria-readonly="true" />
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
                    <small className="muted">{t('Stundensatz', 'Hourly rate')}: {shiftHourlyRate} {currencySymbol}/h</small>
                    <strong>
                      {t('Berechnetes Einkommen', 'Calculated income')}:{' '}
                      {shiftPreview ? formatMoney(shiftPreview.amount, settings.currency, settings.privacyHideAmounts) : '—'}
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
        <BarChart data={stats.monthSeries} language={settings.language} />
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
                  <td>{incomeSourceLabel(item, settings.language)}</td>
                  <td>{formatMoney(item.amount, settings.currency, settings.privacyHideAmounts)}</td>
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
          {tableEntries.length === 0 ? <p className="empty-inline table-empty-message">{t('Keine Einkommenseinträge für die ausgewählte Ansicht.', 'No income entries for the selected view.')}</p> : null}
        </div>
      </article>
    </section>
  )
}
