import { useMemo, useRef, useState } from 'react'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { DonutChart } from '../components/DonutChart'
import { StatCard } from '../components/StatCard'
import { useCardRowStagger } from '../hooks/useCardRowStagger'
import { useAppContext } from '../state/useAppContext'
import type { IncomeEntry } from '../types/models'
import { addDays, formatDateByPattern, monthLabel, parseDate, todayString } from '../utils/date'
import { materializeExpenseEntriesForRange, sumExpenses } from '../utils/expense'
import { formatMoney, toPercent } from '../utils/format'
import { monthlyResidentNetTotal } from '../utils/household'
import { buildFixedSalaryIncomeTemplateEntries, incomeByMonth, materializeIncomeEntriesForRange, sourceBreakdown, sumIncome } from '../utils/income'
import { tx } from '../utils/i18n'
import { categoryBreakdown, monthlyTotalAt } from '../utils/subscription'

type RangePreset = '30d' | '6m' | '12m' | 'custom'

function resolveRange(preset: RangePreset, customStart: string, customEnd: string): { start: string; end: string } {
  const end = todayString()
  if (preset === '30d') {
    return { start: addDays(end, -30), end }
  }
  if (preset === '6m') {
    return { start: addDays(end, -183), end }
  }
  if (preset === '12m') {
    return { start: addDays(end, -365), end }
  }
  return { start: customStart, end: customEnd }
}

function rangeLengthDays(start: string, end: string): number {
  return Math.max(1, Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / (1000 * 60 * 60 * 24)))
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

export function StatsPage(): JSX.Element {
  const { subscriptions, incomeEntries, expenseEntries, householdCosts, householdPayers, settings } = useAppContext()
  const pageRef = useRef<HTMLElement | null>(null)
  const [preset, setPreset] = useState<RangePreset>('30d')
  const [customStart, setCustomStart] = useState(addDays(todayString(), -90))
  const [customEnd, setCustomEnd] = useState(todayString())
  const t = (de: string, en: string) => tx(settings.language, de, en)
  const monthLocale = settings.language === 'de' ? 'de-DE' : 'en-US'

  useCardRowStagger(pageRef)

  const range = resolveRange(preset, customStart, customEnd)
  const rangeDays = rangeLengthDays(range.start, range.end)

  const data = useMemo(() => {
    const allIncomeEntries = [...incomeEntries, ...buildFixedSalaryIncomeTemplateEntries(settings.shiftJobs)]
    const incomeInRange = materializeIncomeEntriesForRange(allIncomeEntries, range.start, range.end)
    const expensesInRange = materializeExpenseEntriesForRange(expenseEntries, range.start, range.end)
    const previousStart = addDays(range.start, -rangeDays)
    const previousEnd = addDays(range.end, -rangeDays)
    const previousIncome = materializeIncomeEntriesForRange(allIncomeEntries, previousStart, previousEnd)

    const activeSubscriptions = subscriptions.filter((item) => item.status === 'active' || item.status === 'paused')
    const monthlySubscriptionSpend = monthlyTotalAt(activeSubscriptions, range.end)
    const monthlyHouseholdSpend = monthlyResidentNetTotal(householdCosts, householdPayers, range.end)
    const monthsInRange = Math.max(1, rangeDays / 30)
    const estimatedRecurringSpend = (monthlySubscriptionSpend + monthlyHouseholdSpend) * monthsInRange
    const expenseTotal = sumExpenses(expensesInRange)
    const totalSpend = estimatedRecurringSpend + expenseTotal
    const incomeTotal = sumIncome(incomeInRange)
    const previousIncomeTotal = sumIncome(previousIncome)
    const incomeDelta = previousIncomeTotal === 0 ? 0 : ((incomeTotal - previousIncomeTotal) / previousIncomeTotal) * 100

    return {
      incomeTotal,
      monthlySubscriptionSpend,
      monthlyHouseholdSpend,
      estimatedRecurringSpend,
      expenseTotal,
      cashflow: incomeTotal - totalSpend,
      incomeDelta,
      monthlyIncomeSeries: incomeByMonth(incomeInRange).map((item) => ({ label: monthLabel(item.month, monthLocale), value: item.value })),
      sourceSeries: sourceBreakdown(incomeInRange, (entry) => incomeSourceLabel(entry, settings.language)),
      categorySeries: categoryBreakdown(activeSubscriptions),
      previousRange: { start: previousStart, end: previousEnd },
    }
  }, [expenseEntries, householdCosts, householdPayers, incomeEntries, monthLocale, range.end, range.start, rangeDays, settings.language, settings.shiftJobs, subscriptions])

  return (
    <section ref={pageRef} className="page">
      <section className="page-top-row page-top-row-dashboard-align">
      <header className="page-header page-header-compact">
        <h1>{t('Statistiken', 'Statistics')}</h1>
        <div className="page-actions">
          <select value={preset} onChange={(event) => setPreset(event.target.value as RangePreset)}>
            <option value="30d">{t('Letzte 30 Tage', 'Last 30 days')}</option>
            <option value="6m">{t('Letzte 6 Monate', 'Last 6 months')}</option>
            <option value="12m">{t('Letzte 12 Monate', 'Last 12 months')}</option>
            <option value="custom">{t('Eigener Zeitraum', 'Custom range')}</option>
          </select>
          {preset === 'custom' ? (
            <>
              <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
              <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
            </>
          ) : null}
        </div>
        <p className="muted">
          {t('Zeitraum', 'Range')}: {formatDateByPattern(range.start, settings.dateFormat)} - {formatDateByPattern(range.end, settings.dateFormat)}
        </p>
      </header>

        <div className="stats-grid stats-grid-top">
        <StatCard
          label={t('Einkommen (gewählter Zeitraum)', 'Income (selected range)')}
          value={<AnimatedNumber value={data.incomeTotal} formatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)} />}
          hint={`${t('ggü. Vorzeitraum', 'vs previous range')} ${toPercent(data.incomeDelta)}`}
        />
        <StatCard
          label={t('Geschätzte laufende Kosten', 'Estimated recurring costs')}
          value={<AnimatedNumber value={data.estimatedRecurringSpend} formatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)} />}
          hint={`${formatMoney(data.monthlySubscriptionSpend, settings.currency, settings.privacyHideAmounts)} ${t('Abos', 'subscriptions')} + ${formatMoney(data.monthlyHouseholdSpend, settings.currency, settings.privacyHideAmounts)} ${t('Haushalt', 'household')} ${t('pro Monat', 'per month')}`}
        />
        <StatCard
          label={t('Cashflow', 'Cashflow')}
          value={<AnimatedNumber value={data.cashflow} formatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)} />}
          hint={`${t('inkl.', 'incl.')} ${formatMoney(data.expenseTotal, settings.currency, settings.privacyHideAmounts)} ${t('sonstige Ausgaben', 'other expenses')}`}
        />
      </div>
      </section>

      <section className="dashboard-grid">
        <article className="card dashboard-card">
          <h2>{t('Einkommensquellen', 'Income sources')}</h2>
          <DonutChart
            data={data.sourceSeries}
            language={settings.language}
            valueFormatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)}
          />
        </article>
        <article className="card dashboard-card">
          <h2>{t('Abo-Kategorien', 'Subscription categories')}</h2>
          <DonutChart
            data={data.categorySeries}
            language={settings.language}
            valueFormatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)}
            reverseColorScale
          />
        </article>
      </section>
    </section>
  )
}


