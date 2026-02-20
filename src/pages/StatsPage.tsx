import { useMemo, useState } from 'react'
import { BarChart } from '../components/BarChart'
import { DonutChart } from '../components/DonutChart'
import { StatCard } from '../components/StatCard'
import { useAppContext } from '../state/useAppContext'
import { addDays, formatDateByPattern, monthLabel, parseDate, todayString } from '../utils/date'
import { formatMoney, toPercent } from '../utils/format'
import { incomeByMonth, materializeIncomeEntriesForRange, sourceBreakdown, sumIncome } from '../utils/income'
import { tx } from '../utils/i18n'
import { categoryBreakdown, monthlyTotal } from '../utils/subscription'

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

export function StatsPage(): JSX.Element {
  const { subscriptions, incomeEntries, settings } = useAppContext()
  const [preset, setPreset] = useState<RangePreset>('12m')
  const [customStart, setCustomStart] = useState(addDays(todayString(), -90))
  const [customEnd, setCustomEnd] = useState(todayString())
  const t = (de: string, en: string) => tx(settings.language, de, en)
  const monthLocale = settings.language === 'de' ? 'de-DE' : 'en-US'

  const range = resolveRange(preset, customStart, customEnd)
  const rangeDays = rangeLengthDays(range.start, range.end)

  const data = useMemo(() => {
    const incomeInRange = materializeIncomeEntriesForRange(incomeEntries, range.start, range.end)
    const previousStart = addDays(range.start, -rangeDays)
    const previousEnd = addDays(range.end, -rangeDays)
    const previousIncome = materializeIncomeEntriesForRange(incomeEntries, previousStart, previousEnd)

    const activeSubscriptions = subscriptions.filter((item) => item.status === 'active' || item.status === 'paused')
    const monthlySpend = monthlyTotal(activeSubscriptions)
    const monthsInRange = Math.max(1, rangeDays / 30)
    const estimatedSpend = monthlySpend * monthsInRange
    const incomeTotal = sumIncome(incomeInRange)
    const previousIncomeTotal = sumIncome(previousIncome)
    const incomeDelta = previousIncomeTotal === 0 ? 0 : ((incomeTotal - previousIncomeTotal) / previousIncomeTotal) * 100

    return {
      incomeTotal,
      monthlySpend,
      estimatedSpend,
      cashflow: incomeTotal - estimatedSpend,
      incomeDelta,
      monthlyIncomeSeries: incomeByMonth(incomeInRange).map((item) => ({ label: monthLabel(item.month, monthLocale), value: item.value })),
      sourceSeries: sourceBreakdown(incomeInRange),
      categorySeries: categoryBreakdown(activeSubscriptions),
      previousRange: { start: previousStart, end: previousEnd },
    }
  }, [incomeEntries, monthLocale, range.end, range.start, rangeDays, subscriptions])

  return (
    <section className="page">
      <header className="page-header">
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
      </header>

      <p className="muted">
        {t('Zeitraum', 'Range')}: {formatDateByPattern(range.start, settings.dateFormat)} - {formatDateByPattern(range.end, settings.dateFormat)}
      </p>

      <div className="stats-grid">
        <StatCard
          label={t('Einkommen (gewählter Zeitraum)', 'Income (selected range)')}
          value={formatMoney(data.incomeTotal, settings.currency, settings.privacyHideAmounts)}
          hint={`${t('ggü. Vorzeitraum', 'vs previous range')} ${toPercent(data.incomeDelta)}`}
        />
        <StatCard
          label={t('Geschätzte Abo-Ausgaben', 'Estimated subscription expenses')}
          value={formatMoney(data.estimatedSpend, settings.currency, settings.privacyHideAmounts)}
          hint={`${formatMoney(data.monthlySpend, settings.currency, settings.privacyHideAmounts)} ${t('pro Monat', 'per month')}`}
        />
        <StatCard
          label={t('Cashflow', 'Cashflow')}
          value={formatMoney(data.cashflow, settings.currency, settings.privacyHideAmounts)}
          hint={`${t('Vorzeitraum', 'Previous range')}: ${formatDateByPattern(data.previousRange.start, settings.dateFormat)} - ${formatDateByPattern(data.previousRange.end, settings.dateFormat)}`}
        />
      </div>

      <div className="three-column">
        <article className="card">
          <h2>{t('Einkommenstrend', 'Income trend')}</h2>
          <BarChart data={data.monthlyIncomeSeries} language={settings.language} />
        </article>
        <article className="card">
          <h2>{t('Einkommensquellen', 'Income sources')}</h2>
          <DonutChart data={data.sourceSeries} language={settings.language} />
        </article>
        <article className="card">
          <h2>{t('Abo-Kategorien', 'Subscription categories')}</h2>
          <DonutChart data={data.categorySeries} language={settings.language} />
        </article>
      </div>
    </section>
  )
}
