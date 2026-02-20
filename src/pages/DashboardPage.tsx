import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BarChart } from '../components/BarChart'
import { LineChart } from '../components/LineChart'
import { StatCard } from '../components/StatCard'
import { useAppContext } from '../state/useAppContext'
import { addDays, endOfMonth, monthLabel, startOfMonth, todayString } from '../utils/date'
import { materializeIncomeEntriesForRange, monthOverMonthChange, sumIncome } from '../utils/income'
import { formatMoney, toPercent } from '../utils/format'
import { monthlyTotal, monthlyTrend, topSubscriptions } from '../utils/subscription'

export function DashboardPage(): JSX.Element {
  const { subscriptions, incomeEntries, settings } = useAppContext()
  const today = todayString()

  const overview = useMemo(() => {
    const monthlySubscriptions = monthlyTotal(subscriptions)
    const monthIncomeEntries = materializeIncomeEntriesForRange(incomeEntries, startOfMonth(today), endOfMonth(today))
    const monthIncome = sumIncome(monthIncomeEntries)
    const lastYearIncomeEntries = materializeIncomeEntriesForRange(incomeEntries, addDays(today, -365), today)
    const top = topSubscriptions(subscriptions, 3)
    const trend = monthlyTrend(subscriptions, 6).map((item) => ({ label: monthLabel(item.month), value: item.value }))
    const incomeMoM = monthOverMonthChange(lastYearIncomeEntries)
    return {
      monthlySubscriptions,
      monthIncome,
      top,
      trend,
      incomeMoM,
    }
  }, [incomeEntries, subscriptions, today])

  return (
    <section className="page">
      <header className="page-header">
        <h1>Übersicht</h1>
        <p className="muted">Deine Finanzen auf einen Blick.</p>
      </header>

      <div className="stats-grid">
        <StatCard
          label="Abos pro Monat"
          value={formatMoney(overview.monthlySubscriptions, settings.currency, settings.decimals, settings.privacyHideAmounts)}
          hint="Aktive und pausierte Abos"
        />
        <StatCard
          label="Einkommen diesen Monat"
          value={formatMoney(overview.monthIncome, settings.currency, settings.decimals, settings.privacyHideAmounts)}
          hint={`Vgl. Vormonat: ${toPercent(overview.incomeMoM)}`}
        />
        <article className="card stat-card">
          <p className="muted">Schnellaktionen</p>
          <div className="quick-actions-list">
            <Link to="/subscriptions?quickAdd=1" className="button button-secondary">
              Abo hinzufügen
            </Link>
            <Link to="/income?quickAdd=1" className="button button-secondary">
              Einkommen hinzufügen
            </Link>
          </div>
        </article>
      </div>

      <article className="card">
        <header className="section-header">
          <h2>Teuerste Abos</h2>
        </header>
        {overview.top.length === 0 ? <p className="empty-inline">Noch keine Abos vorhanden.</p> : null}
        <BarChart data={overview.top.map((item) => ({ label: item.name, value: item.amount }))} />
      </article>

      <article className="card">
        <header className="section-header">
          <h2>Abo-Trend</h2>
        </header>
        <LineChart data={overview.trend} />
      </article>
    </section>
  )
}

