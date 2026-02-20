import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart } from '../components/BarChart'
import { DonutChart } from '../components/DonutChart'
import { LineChart } from '../components/LineChart'
import { useAppContext } from '../state/useAppContext'
import type { Subscription, SubscriptionInterval, SubscriptionStatus } from '../types/models'
import { monthLabel, todayString } from '../utils/date'
import { formatMoney } from '../utils/format'
import { tx } from '../utils/i18n'
import { categoryBreakdown, monthlyEquivalent, monthlyTotal, monthlyTrend, topSubscriptions, yearlyTotal } from '../utils/subscription'

type SubscriptionFormState = Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>

type ConfirmActionState =
  | { kind: 'cancel'; id: string; name: string }
  | { kind: 'delete'; id: string; name: string }

function parseOptionalNumberInput(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value)
}

function buildDefaultForm(categoryDefault: string): SubscriptionFormState {
  return {
    name: '',
    provider: '',
    category: categoryDefault,
    tags: [],
    amount: Number.NaN,
    currency: '',
    interval: 'monthly',
    customIntervalMonths: 2,
    startDate: todayString(),
    nextPaymentOverride: '',
    noticePeriodDays: 14,
    notes: '',
    link: '',
    status: 'active',
    endDate: '',
  }
}

function intervalLabel(item: Subscription, language: 'de' | 'en'): string {
  if (item.interval === 'monthly') {
    return tx(language, 'Monatlich', 'Monthly')
  }
  if (item.interval === 'yearly') {
    return tx(language, 'Jährlich', 'Yearly')
  }
  if (item.interval === 'four-weekly') {
    return tx(language, 'Alle 4 Wochen', 'Every 4 weeks')
  }
  return tx(language, `Alle ${item.customIntervalMonths} Monate`, `Every ${item.customIntervalMonths} months`)
}

function statusLabel(status: SubscriptionStatus, language: 'de' | 'en'): string {
  if (status === 'active') {
    return tx(language, 'Aktiv', 'Active')
  }
  if (status === 'paused') {
    return tx(language, 'Pausiert', 'Paused')
  }
  return tx(language, 'Gekündigt', 'Cancelled')
}

function toFormState(subscription: Subscription): SubscriptionFormState {
  return {
    ...subscription,
    endDate: subscription.endDate ?? '',
    nextPaymentOverride: subscription.nextPaymentOverride ?? '',
  }
}

function subscriptionMatchesQuery(item: Subscription, query: string): boolean {
  const text = `${item.name} ${item.provider} ${item.category} ${item.tags.join(' ')}`.toLowerCase()
  return text.includes(query.toLowerCase())
}

export function SubscriptionsPage(): JSX.Element {
  const { subscriptions, settings, uiState, setUiState, addSubscription, updateSubscription, deleteSubscription } = useAppContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [form, setForm] = useState<SubscriptionFormState>(() => buildDefaultForm(tx(settings.language, 'Allgemein', 'General')))
  const [editId, setEditId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'amount' | 'name'>('amount')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | SubscriptionStatus>('all')
  const [formError, setFormError] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const t = (de: string, en: string) => tx(settings.language, de, en)

  const closeForm = useCallback((): void => {
    setIsFormOpen(false)
    setEditId(null)
    setForm(buildDefaultForm(tx(settings.language, 'Allgemein', 'General')))
    setFormError('')
  }, [settings.language])

  useEffect(() => {
    if (searchParams.get('quickAdd') !== '1') {
      return
    }
    const frame = window.requestAnimationFrame(() => {
      setIsFormOpen(true)
      setEditId(null)
      setForm(buildDefaultForm(tx(settings.language, 'Allgemein', 'General')))
      setFormError('')
      window.requestAnimationFrame(() => nameInputRef.current?.focus())
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('quickAdd')
      setSearchParams(nextParams, { replace: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [searchParams, setSearchParams, settings.language])

  useEffect(() => {
    if (!isFormOpen && !confirmAction) {
      return
    }
    function onEscape(event: KeyboardEvent): void {
      if (event.key !== 'Escape') {
        return
      }
      if (confirmAction) {
        setConfirmAction(null)
        return
      }
      closeForm()
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [confirmAction, isFormOpen, closeForm])

  const filtered = useMemo(() => {
    const query = uiState.globalSearch.trim()
    const rows = subscriptions
      .filter((item) => (statusFilter === 'all' ? true : item.status === statusFilter))
      .filter((item) => (categoryFilter === 'all' ? true : item.category === categoryFilter))
      .filter((item) => (query ? subscriptionMatchesQuery(item, query) : true))

    const sorted = [...rows].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      }
      return monthlyEquivalent(b) - monthlyEquivalent(a)
    })
    return sorted
  }, [categoryFilter, sortBy, statusFilter, subscriptions, uiState.globalSearch])

  const categories = useMemo(() => [...new Set(subscriptions.map((item) => item.category))], [subscriptions])
  const totals = useMemo(
    () => ({
      monthly: monthlyTotal(filtered),
      yearly: yearlyTotal(filtered),
      top: topSubscriptions(filtered, 5),
      categories: categoryBreakdown(filtered),
      trend: monthlyTrend(filtered, 12).map((item) => ({ label: monthLabel(item.month), value: item.value })),
    }),
    [filtered],
  )

  async function handleSave(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    try {
      setFormError('')
      const payload: SubscriptionFormState = {
        ...form,
        tags: form.tags,
        amount: Number(form.amount),
        noticePeriodDays: Number(form.noticePeriodDays),
        customIntervalMonths: Number(form.customIntervalMonths),
        nextPaymentOverride: form.nextPaymentOverride || undefined,
        endDate: form.endDate || undefined,
        currency: form.currency || undefined,
      }

      if (editId) {
        await updateSubscription(editId, payload)
      } else {
        await addSubscription(payload)
      }
      closeForm()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('Abo konnte nicht gespeichert werden.', 'Subscription could not be saved.'))
    }
  }

  function handleEdit(item: Subscription): void {
    setIsFormOpen(true)
    setEditId(item.id)
    setForm(toFormState(item))
  }

  function openAddForm(): void {
    setIsFormOpen(true)
    setEditId(null)
    setForm(buildDefaultForm(t('Allgemein', 'General')))
    setFormError('')
    window.requestAnimationFrame(() => nameInputRef.current?.focus())
  }

  function setStatus(id: string, status: SubscriptionStatus): void {
    void updateSubscription(id, { status, endDate: status === 'cancelled' ? todayString() : undefined })
  }

  function openCancelConfirmation(item: Subscription): void {
    setConfirmAction({ kind: 'cancel', id: item.id, name: item.name })
  }

  function openDeleteConfirmation(item: Subscription): void {
    setConfirmAction({ kind: 'delete', id: item.id, name: item.name })
  }

  async function handleConfirmAction(): Promise<void> {
    if (!confirmAction) {
      return
    }
    try {
      if (confirmAction.kind === 'cancel') {
        await updateSubscription(confirmAction.id, { status: 'cancelled', endDate: todayString() })
      } else {
        await deleteSubscription(confirmAction.id)
      }
      setConfirmAction(null)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('Aktion konnte nicht ausgeführt werden.', 'Action could not be completed.'))
      setConfirmAction(null)
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div className="page-title-actions">
          <h1>{t('Abo-Tracker', 'Subscription tracker')}</h1>
          <button type="button" className="button button-primary" onClick={openAddForm}>
            {t('Abo hinzufügen', 'Add subscription')}
          </button>
        </div>
        <div className="page-actions">
          <input
            value={uiState.globalSearch}
            onChange={(event) => setUiState({ globalSearch: event.target.value })}
            placeholder={t('Abos suchen...', 'Search subscriptions...')}
            aria-label={t('Abos suchen', 'Search subscriptions')}
          />
        </div>
      </header>

      <div className="stats-grid">
        <article className="card stat-card">
          <p className="muted">{t('Gesamtkosten (monatlich)', 'Total costs (monthly)')}</p>
          <p className="stat-value">{formatMoney(totals.monthly, settings.currency, settings.decimals, settings.privacyHideAmounts)}</p>
        </article>
        <article className="card stat-card">
          <p className="muted">{t('Gesamtkosten (jährlich)', 'Total costs (yearly)')}</p>
          <p className="stat-value">{formatMoney(totals.yearly, settings.currency, settings.decimals, settings.privacyHideAmounts)}</p>
        </article>
        <article className="card stat-card">
          <p className="muted">{t('Monatliche Abos', 'Monthly subscriptions')}</p>
          <p className="stat-value">{subscriptions.filter((item) => item.interval === 'monthly').length}</p>
        </article>
        <article className="card stat-card">
          <p className="muted">{t('Jährliche Abos', 'Yearly subscriptions')}</p>
          <p className="stat-value">{subscriptions.filter((item) => item.interval === 'yearly').length}</p>
        </article>
      </div>

      {isFormOpen ? (
        <div className="form-modal-backdrop" onClick={closeForm} role="presentation">
          <article className="card form-modal" onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{editId ? t('Abo bearbeiten', 'Edit subscription') : t('Abo hinzufügen', 'Add subscription')}</h2>
              <button type="button" className="icon-button" onClick={closeForm} aria-label={t('Popup schließen', 'Close popup')}>
                x
              </button>
            </header>
            {formError ? <p className="error-text">{formError}</p> : null}
            <form className="form-grid" onSubmit={handleSave}>
              <label>
                {t('Name', 'Name')}
                <input ref={nameInputRef} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
              </label>
              <label>
                {t('Anbieter', 'Provider')}
                <input value={form.provider} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))} />
              </label>
              <label>
                {t('Kategorie', 'Category')}
                <input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
              </label>
              <label>
                {t('Betrag', 'Amount')}
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={Number.isFinite(form.amount) ? form.amount : ''}
                  onChange={(event) => setForm((current) => ({ ...current, amount: parseOptionalNumberInput(event.target.value) }))}
                  required
                />
              </label>
              <label>
                {t('Intervall', 'Interval')}
                <select value={form.interval} onChange={(event) => setForm((current) => ({ ...current, interval: event.target.value as SubscriptionInterval }))}>
                  <option value="monthly">{t('Monatlich', 'Monthly')}</option>
                  <option value="yearly">{t('Jährlich', 'Yearly')}</option>
                  <option value="four-weekly">{t('Alle 4 Wochen', 'Every 4 weeks')}</option>
                  <option value="custom-months">{t('Eigene Monate', 'Custom months')}</option>
                </select>
              </label>
              {form.interval === 'custom-months' ? (
                <label>
                  {t('Alle X Monate', 'Every X months')}
                  <input type="number" min={1} value={form.customIntervalMonths} onChange={(event) => setForm((current) => ({ ...current, customIntervalMonths: Number(event.target.value) }))} />
                </label>
              ) : null}
              <label>
                {t('Startdatum', 'Start date')}
                <input type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} required />
              </label>
              <label className="full-width">
                {t('Notizen', 'Notes')}
                <textarea className="subscription-notes-input" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
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

      {confirmAction ? (
        <div className="form-modal-backdrop" onClick={() => setConfirmAction(null)} role="presentation">
          <article className="card form-modal confirm-modal" onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{confirmAction.kind === 'cancel' ? t('Abo kündigen?', 'Cancel subscription?') : t('Abo löschen?', 'Delete subscription?')}</h2>
              <button type="button" className="icon-button" onClick={() => setConfirmAction(null)} aria-label={t('Popup schließen', 'Close popup')}>
                x
              </button>
            </header>
            <p>
              {confirmAction.kind === 'cancel'
                ? t(`Möchtest du "${confirmAction.name}" wirklich kündigen? Das Abo wird als gekündigt markiert und aus aktiven Kosten entfernt.`, `Do you really want to cancel "${confirmAction.name}"? It will be marked as cancelled and removed from active costs.`)
                : t(`Möchtest du "${confirmAction.name}" wirklich löschen?`, `Do you really want to delete "${confirmAction.name}"?`)}
            </p>
            <div className="form-actions">
              <button
                type="button"
                className={`button ${confirmAction.kind === 'delete' ? 'button-danger' : 'button-primary'}`}
                onClick={() => void handleConfirmAction()}
              >
                {confirmAction.kind === 'cancel' ? t('Kündigen', 'Cancel subscription') : t('Löschen', 'Delete')}
              </button>
              <button type="button" className="button button-secondary" onClick={() => setConfirmAction(null)}>
                {t('Abbrechen', 'Cancel')}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      <div className="three-column">
        <article className="card">
          <h2>{t('Top-Kosten', 'Top costs')}</h2>
          <BarChart data={totals.top.map((item) => ({ label: item.name, value: monthlyEquivalent(item) }))} />
        </article>
        <article className="card">
          <h2>{t('Kategorienverteilung', 'Category breakdown')}</h2>
          <DonutChart data={totals.categories} />
        </article>
        <article className="card">
          <h2>{t('Trend (12 Monate)', 'Trend (12 months)')}</h2>
          <LineChart data={totals.trend} />
        </article>
      </div>

      <article className="card">
        <header className="section-header">
          <h2>{t('Aboliste', 'Subscription list')}</h2>
          <div className="filters">
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">{t('Alle Kategorien', 'All categories')}</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | SubscriptionStatus)}>
              <option value="all">{t('Alle Status', 'All statuses')}</option>
              <option value="active">{t('Aktiv', 'Active')}</option>
              <option value="paused">{t('Pausiert', 'Paused')}</option>
              <option value="cancelled">{t('Gekündigt', 'Cancelled')}</option>
            </select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as 'amount' | 'name')}>
              <option value="amount">{t('Nach Betrag sortieren', 'Sort by amount')}</option>
              <option value="name">{t('Nach Name sortieren', 'Sort by name')}</option>
            </select>
          </div>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('Name', 'Name')}</th>
                <th>{t('Betrag', 'Amount')}</th>
                <th>{t('Intervall', 'Interval')}</th>
                <th>{t('Status', 'Status')}</th>
                <th>{t('Aktionen', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <small>{item.provider || item.category}</small>
                  </td>
                  <td>{formatMoney(item.amount, settings.currency, settings.decimals, settings.privacyHideAmounts)}</td>
                  <td>{intervalLabel(item, settings.language)}</td>
                  <td>
                    <span className={`status-pill status-${item.status}`}>{statusLabel(item.status, settings.language)}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="button button-tertiary" onClick={() => handleEdit(item)}>
                        {t('Bearbeiten', 'Edit')}
                      </button>
                      {item.status !== 'paused' ? (
                        <button type="button" className="button button-tertiary" onClick={() => setStatus(item.id, 'paused')}>
                          {t('Pausieren', 'Pause')}
                        </button>
                      ) : (
                        <button type="button" className="button button-tertiary" onClick={() => setStatus(item.id, 'active')}>
                          {t('Reaktivieren', 'Reactivate')}
                        </button>
                      )}
                      {item.status !== 'cancelled' ? (
                        <button type="button" className="button button-tertiary" onClick={() => openCancelConfirmation(item)}>
                          {t('Kündigen', 'Cancel subscription')}
                        </button>
                      ) : null}
                      <button type="button" className="button button-danger" onClick={() => openDeleteConfirmation(item)}>
                        {t('Löschen', 'Delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? <p className="empty-inline">{t('Keine Abos entsprechen den aktuellen Filtern.', 'No subscriptions match the current filters.')}</p> : null}
        </div>
      </article>
    </section>
  )
}
