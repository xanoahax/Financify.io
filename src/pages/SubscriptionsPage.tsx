import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart } from '../components/BarChart'
import { DonutChart } from '../components/DonutChart'
import { LineChart } from '../components/LineChart'
import { useAppContext } from '../state/useAppContext'
import type { Subscription, SubscriptionInterval, SubscriptionStatus } from '../types/models'
import { monthLabel, todayString } from '../utils/date'
import { formatMoney } from '../utils/format'
import {
  categoryBreakdown,
  monthlyEquivalent,
  monthlyTotal,
  monthlyTrend,
  topSubscriptions,
  yearlyTotal,
} from '../utils/subscription'

type SubscriptionFormState = Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>

type ConfirmActionState =
  | { kind: 'cancel'; id: string; name: string }
  | { kind: 'delete'; id: string; name: string }

function buildDefaultForm(): SubscriptionFormState {
  return {
    name: '',
    provider: '',
    category: 'Allgemein',
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

function parseOptionalNumberInput(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value)
}

function intervalLabel(item: Subscription): string {
  if (item.interval === 'monthly') {
    return 'Monatlich'
  }
  if (item.interval === 'yearly') {
    return 'Jährlich'
  }
  if (item.interval === 'four-weekly') {
    return 'Alle 4 Wochen'
  }
  return `Alle ${item.customIntervalMonths} Monate`
}

function statusLabel(status: SubscriptionStatus): string {
  if (status === 'active') {
    return 'Aktiv'
  }
  if (status === 'paused') {
    return 'Pausiert'
  }
  return 'Gekündigt'
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
  const [form, setForm] = useState<SubscriptionFormState>(buildDefaultForm())
  const [editId, setEditId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'amount' | 'name'>('amount')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | SubscriptionStatus>('all')
  const [formError, setFormError] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  function closeForm(): void {
    setIsFormOpen(false)
    setEditId(null)
    setForm(buildDefaultForm())
    setFormError('')
  }

  useEffect(() => {
    if (searchParams.get('quickAdd') !== '1') {
      return
    }
    const frame = window.requestAnimationFrame(() => {
      setIsFormOpen(true)
      setEditId(null)
      setForm(buildDefaultForm())
      setFormError('')
      window.requestAnimationFrame(() => nameInputRef.current?.focus())
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('quickAdd')
      setSearchParams(nextParams, { replace: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [searchParams, setSearchParams])

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
  }, [confirmAction, isFormOpen])

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
      setFormError(error instanceof Error ? error.message : 'Abo konnte nicht gespeichert werden.')
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
    setForm(buildDefaultForm())
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
      setFormError(error instanceof Error ? error.message : 'Aktion konnte nicht ausgeführt werden.')
      setConfirmAction(null)
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div className="page-title-actions">
          <h1>Abo-Tracker</h1>
          <button type="button" className="button button-primary" onClick={openAddForm}>
            Abo hinzufügen
          </button>
        </div>
        <div className="page-actions">
          <input
            value={uiState.globalSearch}
            onChange={(event) => setUiState({ globalSearch: event.target.value })}
            placeholder="Abos suchen..."
            aria-label="Abos suchen"
          />
        </div>
      </header>

      <div className="stats-grid">
        <article className="card stat-card">
          <p className="muted">Gesamtkosten (monatlich)</p>
          <p className="stat-value">{formatMoney(totals.monthly, settings.currency, settings.decimals, settings.privacyHideAmounts)}</p>
        </article>
        <article className="card stat-card">
          <p className="muted">Gesamtkosten (jährlich)</p>
          <p className="stat-value">{formatMoney(totals.yearly, settings.currency, settings.decimals, settings.privacyHideAmounts)}</p>
        </article>
        <article className="card stat-card">
          <p className="muted">Monatliche Abos</p>
          <p className="stat-value">{subscriptions.filter((item) => item.interval === 'monthly').length}</p>
        </article>
        <article className="card stat-card">
          <p className="muted">Jährliche Abos</p>
          <p className="stat-value">{subscriptions.filter((item) => item.interval === 'yearly').length}</p>
        </article>
      </div>

      {isFormOpen ? (
        <div className="form-modal-backdrop" onClick={closeForm} role="presentation">
          <article className="card form-modal" onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{editId ? 'Abo bearbeiten' : 'Abo hinzufügen'}</h2>
              <button type="button" className="icon-button" onClick={closeForm} aria-label="Popup schließen">
                x
              </button>
            </header>
            {formError ? <p className="error-text">{formError}</p> : null}
            <form className="form-grid" onSubmit={handleSave}>
            <label>
              Name
              <input ref={nameInputRef} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            </label>
            <label>
              Anbieter
              <input value={form.provider} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))} />
            </label>
            <label>
              Kategorie
              <input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
            </label>
            <label>
              Betrag
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
              Intervall
              <select
                value={form.interval}
                onChange={(event) => setForm((current) => ({ ...current, interval: event.target.value as SubscriptionInterval }))}
              >
                <option value="monthly">Monatlich</option>
                <option value="yearly">Jährlich</option>
                <option value="four-weekly">Alle 4 Wochen</option>
                <option value="custom-months">Eigene Monate</option>
              </select>
            </label>
            {form.interval === 'custom-months' ? (
              <label>
                Alle X Monate
                <input
                  type="number"
                  min={1}
                  value={form.customIntervalMonths}
                  onChange={(event) => setForm((current) => ({ ...current, customIntervalMonths: Number(event.target.value) }))}
                />
              </label>
            ) : null}
            <label>
              Startdatum
              <input type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} required />
            </label>
            <label className="full-width">
              Notizen
              <textarea className="subscription-notes-input" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
            </label>
            <div className="form-actions full-width">
              <button type="submit" className="button button-primary">
                {editId ? 'Aktualisieren' : 'Speichern'}
              </button>
              <button type="button" className="button button-secondary" onClick={closeForm}>
                Abbrechen
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
              <h2>{confirmAction.kind === 'cancel' ? 'Abo kündigen?' : 'Abo löschen?'}</h2>
              <button type="button" className="icon-button" onClick={() => setConfirmAction(null)} aria-label="Popup schließen">
                x
              </button>
            </header>
            <p>
              {confirmAction.kind === 'cancel'
                ? `Möchtest du "${confirmAction.name}" wirklich kündigen? Das Abo wird als gekündigt markiert und aus aktiven Kosten entfernt.`
                : `Möchtest du "${confirmAction.name}" wirklich löschen?`}
            </p>
            <div className="form-actions">
              <button
                type="button"
                className={`button ${confirmAction.kind === 'delete' ? 'button-danger' : 'button-primary'}`}
                onClick={() => void handleConfirmAction()}
              >
                {confirmAction.kind === 'cancel' ? 'Kündigen' : 'Löschen'}
              </button>
              <button type="button" className="button button-secondary" onClick={() => setConfirmAction(null)}>
                Abbrechen
              </button>
            </div>
          </article>
        </div>
      ) : null}

      <div className="three-column">
        <article className="card">
          <h2>Top-Kosten</h2>
          <BarChart data={totals.top.map((item) => ({ label: item.name, value: monthlyEquivalent(item) }))} />
        </article>
        <article className="card">
          <h2>Kategorienverteilung</h2>
          <DonutChart data={totals.categories} />
        </article>
        <article className="card">
          <h2>Trend (12 Monate)</h2>
          <LineChart data={totals.trend} />
        </article>
      </div>

      <article className="card">
        <header className="section-header">
          <h2>Aboliste</h2>
          <div className="filters">
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">Alle Kategorien</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | SubscriptionStatus)}>
              <option value="all">Alle Status</option>
              <option value="active">Aktiv</option>
              <option value="paused">Pausiert</option>
              <option value="cancelled">Gekündigt</option>
            </select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as 'amount' | 'name')}>
              <option value="amount">Nach Betrag sortieren</option>
              <option value="name">Nach Name sortieren</option>
            </select>
          </div>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Betrag</th>
                <th>Intervall</th>
                <th>Status</th>
                <th>Aktionen</th>
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
                  <td>{intervalLabel(item)}</td>
                  <td>
                    <span className={`status-pill status-${item.status}`}>{statusLabel(item.status)}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="button button-tertiary" onClick={() => handleEdit(item)}>
                        Bearbeiten
                      </button>
                      {item.status !== 'paused' ? (
                        <button type="button" className="button button-tertiary" onClick={() => setStatus(item.id, 'paused')}>
                          Pausieren
                        </button>
                      ) : (
                        <button type="button" className="button button-tertiary" onClick={() => setStatus(item.id, 'active')}>
                          Reaktivieren
                        </button>
                      )}
                      {item.status !== 'cancelled' ? (
                        <button type="button" className="button button-tertiary" onClick={() => openCancelConfirmation(item)}>
                          Kündigen
                        </button>
                      ) : null}
                      <button type="button" className="button button-danger" onClick={() => openDeleteConfirmation(item)}>
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? <p className="empty-inline">Keine Abos entsprechen den aktuellen Filtern.</p> : null}
        </div>
      </article>
    </section>
  )
}


