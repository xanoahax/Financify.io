import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { DonutChart } from '../components/DonutChart'
import { LineChart } from '../components/LineChart'
import { useCardRowStagger } from '../hooks/useCardRowStagger'
import { useAppContext } from '../state/useAppContext'
import { addMonths, endOfMonth, monthLabel, startOfMonth, todayString } from '../utils/date'
import { formatMoney, toPercent } from '../utils/format'
import {
  buildFixedSalaryIncomeTemplateEntries,
  incomeByMonth,
  materializeIncomeEntriesForRange,
  sumIncome,
} from '../utils/income'
import { tx } from '../utils/i18n'
import { monthlyHouseholdTotal } from '../utils/household'
import { categoryBreakdown, monthlyTotal } from '../utils/subscription'

export interface DashboardQuickAction {
  id: string
  label: string
  iconDark: string
  iconLight: string
  run: () => void
}

type DashboardTrendRange = 3 | 6 | 12

interface DashboardPageProps {
  quickActions: DashboardQuickAction[]
}

export function DashboardPage({ quickActions }: DashboardPageProps): JSX.Element {
  const { subscriptions, incomeEntries, settings, householdCosts, householdMembers } = useAppContext()
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const [trendRange, setTrendRange] = useState<DashboardTrendRange>(6)
  const quickActionsRef = useRef<HTMLDivElement | null>(null)
  const pageRef = useRef<HTMLElement | null>(null)
  const today = todayString()
  const t = (de: string, en: string) => tx(settings.language, de, en)
  const monthLocale = settings.language === 'de' ? 'de-DE' : 'en-US'

  useCardRowStagger(pageRef)

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

  const overview = useMemo(() => {
    const allIncomeEntries = [...incomeEntries, ...buildFixedSalaryIncomeTemplateEntries(settings.shiftJobs)]
    const monthIncomeEntries = materializeIncomeEntriesForRange(allIncomeEntries, startOfMonth(today), endOfMonth(today))
    const monthIncome = sumIncome(monthIncomeEntries)
    const incomeTrendRangeEnd = endOfMonth(today)
    const incomeTrendRangeStart = startOfMonth(addMonths(today, -11))
    const incomeTrendEntries = materializeIncomeEntriesForRange(allIncomeEntries, incomeTrendRangeStart, incomeTrendRangeEnd)
    const incomeSeriesRaw = incomeByMonth(incomeTrendEntries).slice(-12)
    const incomeSeries = incomeSeriesRaw.map((item) => ({
      label: monthLabel(item.month, monthLocale),
      value: item.value,
    }))
    const incomeAverage = incomeSeriesRaw.length > 0 ? incomeSeriesRaw.reduce((sum, item) => sum + item.value, 0) / incomeSeriesRaw.length : 0
    const incomeAverageDelta = incomeAverage > 0 ? (monthIncome - incomeAverage) / incomeAverage : 0

    return {
      monthlySubscriptions: monthlyTotal(subscriptions),
      monthlyHousehold: monthlyHouseholdTotal(householdCosts),
      monthIncome,
      incomeAverage,
      incomeAverageDelta,
      incomeSeries,
      subscriptionCategories: categoryBreakdown(subscriptions),
      residentCount: householdMembers.filter((member) => member.isActive).length,
    }
  }, [householdCosts, householdMembers, incomeEntries, monthLocale, settings.shiftJobs, subscriptions, today])

  const trendRangeOptions: Array<{ value: DashboardTrendRange; label: string }> = [
    { value: 3, label: t('3 Monate', '3 months') },
    { value: 6, label: t('6 Monate', '6 months') },
    { value: 12, label: t('12 Monate', '12 months') },
  ]
  const filteredIncomeSeries = overview.incomeSeries.slice(-trendRange)

  return (
    <section ref={pageRef} className="page dashboard-page">
      <section className="dashboard-top-row">
        <div className="dashboard-hero">
          <h1>{t('Welcome back!', 'Welcome back!')}</h1>
          <p className="dashboard-hero-copy">{t('Deine Finanzen auf einen Blick.', 'Your finances at a glance.')}</p>
        </div>
        <div className="dashboard-summary-spacer" aria-hidden="true" />
        <div className="dashboard-hero-actions" ref={quickActionsRef}>
          <div className="shell-plus-cluster">
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
              <div className="dashboard-quick-actions-stack" role="group" aria-label={t('Schnellaktionen', 'Quick actions')}>
                {quickActions.map((action, index) => (
                  <button
                    key={action.id}
                    type="button"
                    className="dashboard-quick-action-button"
                    style={{ '--quick-action-delay': `${index * 55}ms` } as CSSProperties}
                    onClick={() => {
                      setQuickActionsOpen(false)
                      action.run()
                    }}
                    aria-label={action.label}
                    title={action.label}
                  >
                    <img
                      src={settings.theme === 'dark' ? action.iconLight : action.iconDark}
                      alt=""
                      className="dashboard-quick-action-icon"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="dashboard-summary-grid" aria-label={t('Kennzahlen', 'Key metrics')}>
          <article className="dashboard-summary">
            <p className="dashboard-summary-label">{t('Einkommen diesen Monat', 'Income this month')}</p>
            <div className="dashboard-summary-value-row">
              <strong><AnimatedNumber value={overview.monthIncome} formatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)} /></strong>
              <span className="dashboard-summary-pill">
                {overview.incomeAverage > 0 ? toPercent(overview.incomeAverageDelta) : t('—', '—')}
              </span>
            </div>
          </article>
          <article className="dashboard-summary">
            <p className="dashboard-summary-label">{t('Abos pro Monat', 'Subscriptions per month')}</p>
            <div className="dashboard-summary-value-row">
              <strong><AnimatedNumber value={overview.monthlySubscriptions} formatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)} /></strong>
            </div>
          </article>
          <article className="dashboard-summary">
            <p className="dashboard-summary-label">{t('Haushaltskosten pro Monat', 'Household costs per month')}</p>
            <div className="dashboard-summary-value-row">
              <strong><AnimatedNumber value={overview.monthlyHousehold} formatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)} /></strong>
            </div>
          </article>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="card dashboard-card">
          <header className="section-header">
            <h2>{t('Einkommenstrend', 'Income trend')}</h2>
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
            data={filteredIncomeSeries}
            language={settings.language}
            valueFormatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)}
          />
        </article>

        <article className="card dashboard-card">
          <header className="section-header">
            <h2>{t('Abo-Verteilung', 'Subscription distribution')}</h2>
          </header>
          <DonutChart
            data={overview.subscriptionCategories}
            language={settings.language}
            valueFormatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)}
            reverseColorScale
          />
        </article>

        <article className="card dashboard-card card-span-2">
          <header className="section-header">
            <h2>{t('Haushalt', 'Household')}</h2>
          </header>
          <div className="dashboard-household-stats">
            <div className="dashboard-household-stat">
              <span className="dashboard-household-label">{t('Monatliche Kosten', 'Monthly cost')}</span>
              <strong><AnimatedNumber value={overview.monthlyHousehold} formatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)} /></strong>
            </div>
            <div className="dashboard-household-stat">
              <span className="dashboard-household-label">{t('Bewohner', 'Residents')}</span>
              <strong>{overview.residentCount}</strong>
            </div>
          </div>
        </article>

      </section>
    </section>
  )
}








