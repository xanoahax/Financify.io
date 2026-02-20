import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BarChart } from '../components/BarChart'
import { LineChart } from '../components/LineChart'
import { StatCard } from '../components/StatCard'
import { useAppContext } from '../state/useAppContext'
import { addDays, endOfMonth, monthLabel, startOfMonth, todayString } from '../utils/date'
import { formatMoney, toPercent } from '../utils/format'
import { materializeIncomeEntriesForRange, monthOverMonthChange, sumIncome } from '../utils/income'
import { tx } from '../utils/i18n'
import { monthlyTotal, monthlyTrend, topSubscriptions } from '../utils/subscription'

export function DashboardPage(): JSX.Element {
  const { subscriptions, incomeEntries, settings } = useAppContext()
  const today = todayString()
  const t = (de: string, en: string) => tx(settings.language, de, en)
  const monthLocale = settings.language === 'de' ? 'de-DE' : 'en-US'

  const overview = useMemo(() => {
    const monthlySubscriptions = monthlyTotal(subscriptions)
    const monthIncomeEntries = materializeIncomeEntriesForRange(incomeEntries, startOfMonth(today), endOfMonth(today))
    const monthIncome = sumIncome(monthIncomeEntries)
    const lastYearIncomeEntries = materializeIncomeEntriesForRange(incomeEntries, addDays(today, -365), today)
    const top = topSubscriptions(subscriptions, 3)
    const trend = monthlyTrend(subscriptions, 6).map((item) => ({ label: monthLabel(item.month, monthLocale), value: item.value }))
    const incomeMoM = monthOverMonthChange(lastYearIncomeEntries)
    return {
      monthlySubscriptions,
      monthIncome,
      top,
      trend,
      incomeMoM,
    }
  }, [incomeEntries, monthLocale, subscriptions, today])

  return (
    <section className="page">
      <header className="page-header">
        <h1>{t('Übersicht', 'Overview')}</h1>
        <p className="muted">{t('Deine Finanzen auf einen Blick.', 'Your finances at a glance.')}</p>
      </header>

      <div className="stats-grid">
        <StatCard
          label={t('Abos pro Monat', 'Subscriptions per month')}
          value={formatMoney(overview.monthlySubscriptions, settings.currency, settings.privacyHideAmounts)}
          hint={t('Aktive und pausierte Abos', 'Active and paused subscriptions')}
        />
        <StatCard
          label={t('Einkommen diesen Monat', 'Income this month')}
          value={formatMoney(overview.monthIncome, settings.currency, settings.privacyHideAmounts)}
          hint={`${t('Vgl. Vormonat', 'vs previous month')}: ${toPercent(overview.incomeMoM)}`}
        />
        <article className="card stat-card">
          <p className="muted">{t('Schnellaktionen', 'Quick actions')}</p>
          <div className="quick-actions-list">
            <Link to="/subscriptions?quickAdd=1" className="button button-secondary">
              {t('Abo hinzufügen', 'Add subscription')}
            </Link>
            <Link to="/income?quickAdd=1" className="button button-secondary">
              {t('Einkommen hinzufügen', 'Add income')}
            </Link>
          </div>
        </article>
      </div>

      <article className="card">
        <header className="section-header">
          <h2>{t('Teuerste Abos', 'Most expensive subscriptions')}</h2>
        </header>
        {overview.top.length === 0 ? <p className="empty-inline">{t('Noch keine Abos vorhanden.', 'No subscriptions yet.')}</p> : null}
        <BarChart data={overview.top.map((item) => ({ label: item.name, value: item.amount }))} language={settings.language} />
      </article>

      <article className="card">
        <header className="section-header">
          <h2>{t('Abo-Trend', 'Subscription trend')}</h2>
        </header>
        <LineChart data={overview.trend} language={settings.language} />
      </article>
    </section>
  )
}
