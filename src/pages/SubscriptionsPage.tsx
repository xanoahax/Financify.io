import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { BarChart } from '../components/BarChart'
import { DonutChart } from '../components/DonutChart'
import { LineChart } from '../components/LineChart'
import { useCardRowStagger } from '../hooks/useCardRowStagger'
import { useGuardedBackdropClose } from '../hooks/useGuardedBackdropClose'
import { useAppContext } from '../state/useAppContext'
import type { Subscription, SubscriptionInterval, SubscriptionStatus } from '../types/models'
import { compareDateStrings, monthLabel, todayString } from '../utils/date'
import { formatMoney } from '../utils/format'
import { tx } from '../utils/i18n'
import { categoryBreakdown, monthlyEquivalent, monthlyTotal, monthlyTrend, topSubscriptions, yearlyTotal } from '../utils/subscription'

type SubscriptionFormState = Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>
type ChangeScope = 'retroactive' | 'from-date'

type ConfirmActionState =
  | { kind: 'cancel'; id: string; name: string }
  | { kind: 'delete'; id: string; name: string }

interface PendingSubscriptionUpdateState {
  id: string
  payload: SubscriptionFormState
}

const SUBSCRIPTION_CATEGORY_PRESETS = [
  'Entertainment',
  'Fitness',
  'Cloud',
  'Software',
  'Insurance',
  'Work',
  'Utilities',
  'Finance',
  'Education',
  'Shopping',
  'General',
] as const

function parseOptionalNumberInput(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value)
}

function buildDefaultForm(): SubscriptionFormState {
  return {
    name: '',
    provider: '',
    category: 'General',
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
    return tx(language, 'JÃ¤hrlich', 'Yearly')
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
  return tx(language, 'GekÃ¼ndigt', 'Cancelled')
}

function toFormState(subscription: Subscription): SubscriptionFormState {
  return {
    ...subscription,
    endDate: subscription.endDate ?? '',
    nextPaymentOverride: subscription.nextPaymentOverride ?? '',
  }
}

export function SubscriptionsPage(): JSX.Element {
  const { subscriptions, settings, addSubscription, updateSubscription, deleteSubscription } = useAppContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [form, setForm] = useState<SubscriptionFormState>(() => buildDefaultForm())
  const [editId, setEditId] = useState<string | null>(null)
  const [effectiveFromDate, setEffectiveFromDate] = useState(todayString())
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [subscriptionSearchQuery, setSubscriptionSearchQuery] = useState('')
  const [formError, setFormError] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState | null>(null)
  const [pendingSubscriptionUpdate, setPendingSubscriptionUpdate] = useState<PendingSubscriptionUpdateState | null>(null)
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const quickActionsRef = useRef<HTMLDivElement | null>(null)
  const pageRef = useRef<HTMLElement | null>(null)
  const t = (de: string, en: string) => tx(settings.language, de, en)
  const monthLocale = settings.language === 'de' ? 'de-DE' : 'en-US'
  const today = todayString()

  useCardRowStagger(pageRef)

  const closeForm = useCallback((): void => {
    setIsFormOpen(false)
    setEditId(null)
    setEffectiveFromDate(todayString())
    setForm(buildDefaultForm())
    setFormError('')
    setPendingSubscriptionUpdate(null)
  }, [])
  const closeConfirmAction = useCallback(() => setConfirmAction(null), [])
  const closePendingSubscriptionUpdate = useCallback(() => setPendingSubscriptionUpdate(null), [])
  const formBackdropCloseGuard = useGuardedBackdropClose(closeForm)
  const confirmBackdropCloseGuard = useGuardedBackdropClose(closeConfirmAction)
  const pendingSubscriptionUpdateBackdropCloseGuard = useGuardedBackdropClose(closePendingSubscriptionUpdate)

  useEffect(() => {
    const quickAdd = searchParams.get('quickAdd')
    if (quickAdd !== '1' && quickAdd !== 'subscription') {
      return
    }
    const frame = window.requestAnimationFrame(() => {
      setIsFormOpen(true)
      setEditId(null)
      setEffectiveFromDate(todayString())
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
      if (pendingSubscriptionUpdate) {
        setPendingSubscriptionUpdate(null)
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
  }, [closeForm, confirmAction, isFormOpen, pendingSubscriptionUpdate])

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

  const hasCostImpactChange = useCallback((existing: Subscription, payload: SubscriptionFormState): boolean => {
    return (
      payload.amount !== existing.amount ||
      payload.interval !== existing.interval ||
      payload.customIntervalMonths !== existing.customIntervalMonths ||
      payload.name !== existing.name ||
      payload.category !== existing.category
    )
  }, [])

  const filtered = useMemo(() => {
    return [...subscriptions].sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a))
  }, [subscriptions])

  const categories = useMemo(() => [...new Set(subscriptions.map((item) => item.category))], [subscriptions])
  const categoryOptions = useMemo(() => {
    const unique = new Set<string>(SUBSCRIPTION_CATEGORY_PRESETS)
    for (const category of categories) {
      if (category.trim()) {
        unique.add(category)
      }
    }
    return [...unique]
  }, [categories])
  const totals = useMemo(
    () => ({
      monthly: monthlyTotal(filtered),
      yearly: yearlyTotal(filtered),
      top: topSubscriptions(filtered, 5),
      categories: categoryBreakdown(filtered),
      trend: monthlyTrend(filtered, 12).map((item) => ({ label: monthLabel(item.month, monthLocale), value: item.value })),
    }),
    [filtered, monthLocale],
  )
  const tableRows = useMemo(() => {
    const normalizedQuery = subscriptionSearchQuery.trim().toLowerCase()

    return filtered
      .filter((item) => item.status === 'cancelled' || !item.endDate || compareDateStrings(item.endDate, today) >= 0)
      .filter((item) => {
        if (!normalizedQuery) {
          return true
        }

        const searchableText = [
          item.name,
          item.provider,
          item.category,
          intervalLabel(item, settings.language),
          statusLabel(item.status, settings.language),
          formatMoney(item.amount, settings.currency, settings.privacyHideAmounts),
          item.notes,
          item.tags.join(' '),
        ]
          .join(' ')
          .toLowerCase()

        return searchableText.includes(normalizedQuery)
      })
  }, [filtered, settings.currency, settings.language, settings.privacyHideAmounts, subscriptionSearchQuery, today])

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
        const existing = subscriptions.find((item) => item.id === editId)
        if (!existing) {
          throw new Error(t('Abo nicht gefunden.', 'Subscription not found.'))
        }
        if (hasCostImpactChange(existing, payload)) {
          setPendingSubscriptionUpdate({ id: editId, payload })
          return
        }
        await updateSubscription(editId, payload)
      } else {
        await addSubscription(payload)
      }
      closeForm()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('Abo konnte nicht gespeichert werden.', 'Subscription could not be saved.'))
    }
  }

  async function applyPendingSubscriptionUpdate(scope: ChangeScope): Promise<void> {
    if (!pendingSubscriptionUpdate) {
      return
    }
    try {
      const effectiveFrom = scope === 'from-date' ? effectiveFromDate : undefined
      await updateSubscription(pendingSubscriptionUpdate.id, pendingSubscriptionUpdate.payload, { effectiveFrom })
      setPendingSubscriptionUpdate(null)
      closeForm()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('Abo konnte nicht gespeichert werden.', 'Subscription could not be saved.'))
      setPendingSubscriptionUpdate(null)
    }
  }

  function handleEdit(item: Subscription): void {
    setIsFormOpen(true)
    setEditId(item.id)
    setEffectiveFromDate(todayString())
    setForm(toFormState(item))
  }

  function openAddForm(): void {
    setIsFormOpen(true)
    setEditId(null)
    setEffectiveFromDate(todayString())
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
      setFormError(error instanceof Error ? error.message : t('Aktion konnte nicht ausgefÃ¼hrt werden.', 'Action could not be completed.'))
      setConfirmAction(null)
    }
  }

  return (
    <section ref={pageRef} className="page">
      <section className="page-top-row page-top-row-dashboard-align">
      <header className="page-header page-header-compact">
        <div className="page-title-actions">
          <h1>{t('Abo-Tracker', 'Subscription tracker')}</h1>
        </div>
        <div className="page-actions">
          <div className="shell-plus-cluster" ref={quickActionsRef}>
            <button
              type="button"
              className="shell-plus-button"
              onClick={() => {
                setQuickActionsOpen(false)
                openAddForm()
              }}
              aria-label={t('Abo hinzufügen', 'Add subscription')}
              title={t('Abo hinzufügen', 'Add subscription')}
            >
              +
            </button>
          </div>
        </div>
      </header>

        <div className="stats-grid stats-grid-top">
        <article className="card stat-card">
          <p className="muted">{t('Gesamtkosten (monatlich)', 'Total costs (monthly)')}</p>
          <p className="stat-value"><AnimatedNumber value={totals.monthly} formatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)} /></p>
        </article>
        <article className="card stat-card">
          <p className="muted">{t('Gesamtkosten (jÃ¤hrlich)', 'Total costs (yearly)')}</p>
          <p className="stat-value"><AnimatedNumber value={totals.yearly} formatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)} /></p>
        </article>
        <article className="card stat-card">
          <p className="muted">{t('Monatliche Abos', 'Monthly subscriptions')}</p>
          <p className="stat-value"><AnimatedNumber value={subscriptions.filter((item) => item.interval === 'monthly').length} formatter={(value) => Math.round(value).toString()} /></p>
        </article>
        <article className="card stat-card">
          <p className="muted">{t('JÃ¤hrliche Abos', 'Yearly subscriptions')}</p>
          <p className="stat-value"><AnimatedNumber value={subscriptions.filter((item) => item.interval === 'yearly').length} formatter={(value) => Math.round(value).toString()} /></p>
        </article>
      </div>
      </section>

      {isFormOpen ? (
        <div
          className="form-modal-backdrop"
          onMouseDown={formBackdropCloseGuard.onBackdropMouseDown}
          onClick={formBackdropCloseGuard.onBackdropClick}
          role="presentation"
        >
          <article className="card form-modal" onMouseDownCapture={formBackdropCloseGuard.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{editId ? t('Abo bearbeiten', 'Edit subscription') : t('Abo hinzufÃ¼gen', 'Add subscription')}</h2>
              <button type="button" className="icon-button" onClick={closeForm} aria-label={t('Popup schlieÃen', 'Close popup')}>
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
                <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
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
                  <option value="yearly">{t('JÃ¤hrlich', 'Yearly')}</option>
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
              {editId ? (
                <label>
                  {t('Ãnderung wirksam ab', 'Change effective from')}
                  <input type="date" value={effectiveFromDate} onChange={(event) => setEffectiveFromDate(event.target.value)} required />
                </label>
              ) : null}
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
        <div
          className="form-modal-backdrop"
          onMouseDown={confirmBackdropCloseGuard.onBackdropMouseDown}
          onClick={confirmBackdropCloseGuard.onBackdropClick}
          role="presentation"
        >
          <article className="card form-modal confirm-modal" onMouseDownCapture={confirmBackdropCloseGuard.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{confirmAction.kind === 'cancel' ? t('Abo kÃ¼ndigen?', 'Cancel subscription?') : t('Abo lÃ¶schen?', 'Delete subscription?')}</h2>
              <button type="button" className="icon-button" onClick={closeConfirmAction} aria-label={t('Popup schlieÃen', 'Close popup')}>
                x
              </button>
            </header>
            <p>
              {confirmAction.kind === 'cancel'
                ? t(`MÃ¶chtest du "${confirmAction.name}" wirklich kÃ¼ndigen? Das Abo wird als gekÃ¼ndigt markiert und aus aktiven Kosten entfernt.`, `Do you really want to cancel "${confirmAction.name}"? It will be marked as cancelled and removed from active costs.`)
                : t(`MÃ¶chtest du "${confirmAction.name}" wirklich lÃ¶schen?`, `Do you really want to delete "${confirmAction.name}"?`)}
            </p>
            <div className="form-actions">
              <button
                type="button"
                className={`button ${confirmAction.kind === 'delete' ? 'button-danger' : 'button-primary'}`}
                onClick={() => void handleConfirmAction()}
              >
                {confirmAction.kind === 'cancel' ? t('KÃ¼ndigen', 'Cancel subscription') : t('LÃ¶schen', 'Delete')}
              </button>
              <button type="button" className="button button-secondary" onClick={closeConfirmAction}>
                {t('Abbrechen', 'Cancel')}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {pendingSubscriptionUpdate ? (
        <div
          className="form-modal-backdrop"
          onMouseDown={pendingSubscriptionUpdateBackdropCloseGuard.onBackdropMouseDown}
          onClick={pendingSubscriptionUpdateBackdropCloseGuard.onBackdropClick}
          role="presentation"
        >
          <article className="card form-modal confirm-modal" onMouseDownCapture={pendingSubscriptionUpdateBackdropCloseGuard.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{t('Ãnderung anwenden', 'Apply change')}</h2>
              <button type="button" className="icon-button" onClick={closePendingSubscriptionUpdate} aria-label={t('Popup schlieÃen', 'Close popup')}>
                x
              </button>
            </header>
            <p>{t('Soll die Ãnderung rÃ¼ckwirkend gelten oder erst ab einem bestimmten Datum?', 'Should this change apply retroactively or only from a specific date?')}</p>
            <label>
              {t('Ab Datum', 'From date')}
              <input type="date" value={effectiveFromDate} onChange={(event) => setEffectiveFromDate(event.target.value)} required />
            </label>
            <div className="form-actions">
              <button type="button" className="button button-primary" onClick={() => void applyPendingSubscriptionUpdate('retroactive')}>
                {t('RÃ¼ckwirkend', 'Retroactive')}
              </button>
              <button type="button" className="button button-secondary" onClick={() => void applyPendingSubscriptionUpdate('from-date')}>
                {t('Ab Datum Ã¼bernehmen', 'Apply from date')}
              </button>
              <button type="button" className="button button-secondary" onClick={closePendingSubscriptionUpdate}>
                {t('Abbrechen', 'Cancel')}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      <section className="dashboard-grid">
        <article className="card dashboard-card dashboard-card-fit">
          <h2>{t('Trend (12 Monate)', 'Trend (12 months)')}</h2>
          <LineChart
            data={totals.trend}
            language={settings.language}
            valueFormatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)}
            reverseColorScale
          />
        </article>
        <article className="card dashboard-card">
          <h2>{t('Kategorienverteilung', 'Category breakdown')}</h2>
          <DonutChart
            data={totals.categories}
            language={settings.language}
            valueFormatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)}
            reverseColorScale
          />
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="card dashboard-card">
          <h2>{t('Top-Kosten', 'Top costs')}</h2>
          <BarChart
            data={totals.top.map((item) => ({ label: item.name, value: monthlyEquivalent(item) }))}
            language={settings.language}
            valueFormatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)}
          />
        </article>

        <article className="card dashboard-card dashboard-card-fit subscription-list-card">
          <header className="section-header">
            <h2>{t('Aboliste', 'Subscription list')}</h2>
            <div className="filters">
              <input
                type="search"
                value={subscriptionSearchQuery}
                onChange={(event) => setSubscriptionSearchQuery(event.target.value)}
                placeholder={t('Abos durchsuchen', 'Search subscriptions')}
                aria-label={t('Abos durchsuchen', 'Search subscriptions')}
                className="subscription-search-input"
              />
            </div>
          </header>
          <div className="table-wrap subscription-list-scroll">
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
                {tableRows.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <small>{item.provider || item.category}</small>
                    </td>
                    <td>{formatMoney(item.amount, settings.currency, settings.privacyHideAmounts)}</td>
                    <td>{intervalLabel(item, settings.language)}</td>
                    <td>
                      <span className={`status-pill status-${item.status}`}>{statusLabel(item.status, settings.language)}</span>
                    </td>
                    <td>
                      <div className="row-actions compact">
                        <button type="button" className="icon-button table-action-button" onClick={() => handleEdit(item)} aria-label={t('Bearbeiten', 'Edit')} title={t('Bearbeiten', 'Edit')}>
                          <svg viewBox="0 0 24 24" aria-hidden="true" className="table-action-icon">
                            <path d="M4 20h4l10-10-4-4L4 16v4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                            <path d="m12 6 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {item.status !== 'paused' ? (
                          <button type="button" className="icon-button table-action-button" onClick={() => setStatus(item.id, 'paused')} aria-label={t('Pausieren', 'Pause')} title={t('Pausieren', 'Pause')}>
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="table-action-icon">
                              <path d="M9 6v12M15 6v12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </button>
                        ) : (
                          <button type="button" className="icon-button table-action-button" onClick={() => setStatus(item.id, 'active')} aria-label={t('Reaktivieren', 'Reactivate')} title={t('Reaktivieren', 'Reactivate')}>
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="table-action-icon">
                              <path d="M8 7v10l9-5-9-5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                            </svg>
                          </button>
                        )}
                        {item.status !== 'cancelled' ? (
                          <button type="button" className="icon-button table-action-button" onClick={() => openCancelConfirmation(item)} aria-label={t('Kündigen', 'Cancel subscription')} title={t('Kündigen', 'Cancel subscription')}>
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="table-action-icon">
                              <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
                              <path d="M9 15 15 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                          </button>
                        ) : null}
                        <button type="button" className="icon-button table-action-button table-action-button-danger" onClick={() => openDeleteConfirmation(item)} aria-label={t('Löschen', 'Delete')} title={t('Löschen', 'Delete')}>
                          <svg viewBox="0 0 24 24" aria-hidden="true" className="table-action-icon">
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
            {tableRows.length === 0 ? <p className="empty-inline table-empty-message">{t('Keine Abos entsprechen der aktuellen Suche.', 'No subscriptions match the current search.')}</p> : null}
          </div>
        </article>
    </section>
  </section>
  )
}
