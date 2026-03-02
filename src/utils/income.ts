import type { FixedSalaryRevision, IncomeEntry, ShiftJobConfig } from '../types/models'
import { addDays, addMonths, compareDateStrings, differenceInDays, monthKey } from './date'
import { median } from './format'

export function sumIncome(entries: IncomeEntry[]): number {
  return entries.reduce((sum, item) => sum + item.amount, 0)
}

export function incomeByMonth(entries: IncomeEntry[]): Array<{ month: string; value: number }> {
  const map = new Map<string, number>()
  for (const entry of entries) {
    const key = monthKey(entry.date)
    map.set(key, (map.get(key) ?? 0) + entry.amount)
  }
  return [...map.entries()]
    .map(([month, value]) => ({ month, value }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

export function sourceBreakdown(
  entries: IncomeEntry[],
  labelForEntry: (entry: IncomeEntry) => string = (entry) => entry.source,
): Array<{ label: string; value: number }> {
  const map = new Map<string, number>()
  for (const entry of entries) {
    const label = labelForEntry(entry)
    map.set(label, (map.get(label) ?? 0) + entry.amount)
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

export function monthStats(entries: IncomeEntry[]): {
  average: number
  median: number
  best?: { month: string; value: number }
  worst?: { month: string; value: number }
} {
  const monthly = incomeByMonth(entries)
  if (monthly.length === 0) {
    return { average: 0, median: 0 }
  }

  const values = monthly.map((item) => item.value)
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const medianValue = median(values)
  const sorted = [...monthly].sort((a, b) => b.value - a.value)
  return {
    average,
    median: medianValue,
    best: sorted[0],
    worst: sorted[sorted.length - 1],
  }
}

export function monthOverMonthChange(entries: IncomeEntry[]): number {
  const monthly = incomeByMonth(entries)
  if (monthly.length < 2) {
    return 0
  }
  const current = monthly[monthly.length - 1].value
  const previous = monthly[monthly.length - 2].value
  if (previous === 0) {
    return 0
  }
  return ((current - previous) / previous) * 100
}

function recurringIntervalDays(entry: IncomeEntry): number | null {
  if (entry.recurring === 'weekly') {
    return 7
  }
  if (entry.recurring === 'custom') {
    return entry.recurringIntervalDays && entry.recurringIntervalDays > 0 ? entry.recurringIntervalDays : null
  }
  return null
}

function nextRecurringDate(current: string, entry: IncomeEntry): string | null {
  if (entry.recurring === 'monthly') {
    return addMonths(current, 1)
  }
  const intervalDays = recurringIntervalDays(entry)
  if (intervalDays) {
    return addDays(current, intervalDays)
  }
  return null
}

function fastForwardToRangeStart(startDate: string, rangeStart: string, entry: IncomeEntry): string {
  const monthly = entry.recurring === 'monthly'
  if (compareDateStrings(startDate, rangeStart) >= 0 || entry.recurring === 'none') {
    return startDate
  }

  if (monthly) {
    let current = startDate
    let guard = 0
    while (compareDateStrings(current, rangeStart) < 0 && guard < 600) {
      current = addMonths(current, 1)
      guard += 1
    }
    return current
  }

  const intervalDays = recurringIntervalDays(entry)
  if (!intervalDays) {
    return startDate
  }
  const daysDiff = differenceInDays(startDate, rangeStart)
  const jumps = Math.max(0, Math.floor(daysDiff / intervalDays))
  let current = addDays(startDate, jumps * intervalDays)
  while (compareDateStrings(current, rangeStart) < 0) {
    current = addDays(current, intervalDays)
  }
  return current
}

export function materializeIncomeEntriesForRange(entries: IncomeEntry[], rangeStart: string, rangeEnd: string): IncomeEntry[] {
  const resolved: IncomeEntry[] = []

  for (const entry of entries) {
    if (entry.endDate && compareDateStrings(entry.endDate, rangeStart) < 0) {
      continue
    }
    if (compareDateStrings(entry.date, rangeEnd) > 0) {
      continue
    }

    if (entry.recurring === 'none') {
      const isWithinRange = compareDateStrings(entry.date, rangeStart) >= 0 && compareDateStrings(entry.date, rangeEnd) <= 0
      const isBeforeEndDate = !entry.endDate || compareDateStrings(entry.date, entry.endDate) <= 0
      if (isWithinRange && isBeforeEndDate) {
        resolved.push({ ...entry, id: `${entry.id}::${entry.date}` })
      }
      continue
    }

    let currentDate = fastForwardToRangeStart(entry.date, rangeStart, entry)
    let guard = 0
    while (compareDateStrings(currentDate, rangeEnd) <= 0 && guard < 2000) {
      if (entry.endDate && compareDateStrings(currentDate, entry.endDate) > 0) {
        break
      }
      if (compareDateStrings(currentDate, rangeStart) >= 0) {
        resolved.push({ ...entry, id: `${entry.id}::${currentDate}`, date: currentDate })
      }
      const nextDate = nextRecurringDate(currentDate, entry)
      if (!nextDate || compareDateStrings(nextDate, currentDate) <= 0) {
        break
      }
      currentDate = nextDate
      guard += 1
    }
  }

  return resolved.sort((a, b) => b.date.localeCompare(a.date))
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

function toDateStamp(date: string): string {
  return `${date}T00:00:00.000Z`
}

function clampDayToMonth(day: number): number {
  return Math.min(Math.max(day, 1), 28)
}

function firstAnnualBonusDate(startDate: string, month: number): string {
  const [startYearRaw, , startDayRaw] = startDate.split('-')
  const startYear = Number(startYearRaw)
  const startDay = Number(startDayRaw)
  const safeDay = clampDayToMonth(Number.isFinite(startDay) ? startDay : 1)
  let candidate = `${startYear}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
  if (compareDateStrings(candidate, startDate) < 0) {
    candidate = `${startYear + 1}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
  }
  return candidate
}

export function buildFixedSalaryIncomeTemplateEntries(jobs: ShiftJobConfig[]): IncomeEntry[] {
  function normalizeFixedSalaryRevisions(job: ShiftJobConfig): FixedSalaryRevision[] {
    const fromHistory = Array.isArray(job.fixedSalaryRevisions)
      ? job.fixedSalaryRevisions
          .filter((revision) => Number.isFinite(Number(revision.salaryAmount)) && Number(revision.salaryAmount) > 0)
          .filter((revision) => /^\d{4}-\d{2}-\d{2}$/.test(revision.startDate))
          .map((revision) => ({
            startDate: revision.startDate,
            endDate: revision.endDate ?? null,
            salaryAmount: Number(revision.salaryAmount),
            fixedPayInterval: revision.fixedPayInterval ?? 'monthly',
            has13thSalary: Boolean(revision.has13thSalary),
            has14thSalary: Boolean(revision.has14thSalary),
          }))
          .sort((left, right) => compareDateStrings(left.startDate, right.startDate))
      : []
    if (fromHistory.length > 0) {
      return fromHistory
    }

    const salaryAmount = Number(job.salaryAmount)
    if (!Number.isFinite(salaryAmount) || salaryAmount <= 0) {
      return []
    }
    const startDate = typeof job.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(job.startDate) ? job.startDate : todayDateString()
    return [
      {
        startDate,
        endDate: null,
        salaryAmount,
        fixedPayInterval: job.fixedPayInterval ?? 'monthly',
        has13thSalary: Boolean(job.has13thSalary),
        has14thSalary: Boolean(job.has14thSalary),
      },
    ]
  }

  const generated: IncomeEntry[] = []
  for (const job of jobs) {
    if (job.employmentType !== 'fixed') {
      continue
    }
    const revisions = normalizeFixedSalaryRevisions(job)
    for (let revisionIndex = 0; revisionIndex < revisions.length; revisionIndex += 1) {
      const revision = revisions[revisionIndex]
      const startDate = revision.startDate
      const salaryAmount = revision.salaryAmount
      const payInterval = revision.fixedPayInterval ?? 'monthly'
      const baseRecurring: IncomeEntry['recurring'] = payInterval === 'monthly' ? 'monthly' : payInterval === 'weekly' ? 'weekly' : 'custom'
      const baseInterval = payInterval === 'biweekly' ? 14 : undefined
      generated.push({
        id: `job-fixed-${job.id}-base-${revisionIndex}`,
        amount: salaryAmount,
        date: startDate,
        endDate: revision.endDate ?? undefined,
        source: job.name,
        tags: ['job', 'fixed-salary', job.name],
        notes: 'Auto-generated fixed salary income.',
        recurring: baseRecurring,
        recurringIntervalDays: baseInterval,
        createdAt: toDateStamp(startDate),
        updatedAt: toDateStamp(startDate),
      })

      if (revision.has13thSalary) {
        const bonusDate = firstAnnualBonusDate(startDate, 6)
        generated.push({
          id: `job-fixed-${job.id}-13-${revisionIndex}`,
          amount: salaryAmount,
          date: bonusDate,
          endDate: revision.endDate ?? undefined,
          source: job.name,
          tags: ['job', 'fixed-salary', '13th-salary', job.name],
          notes: 'Auto-generated 13th salary.',
          recurring: 'custom',
          recurringIntervalDays: 365,
          createdAt: toDateStamp(bonusDate),
          updatedAt: toDateStamp(bonusDate),
        })
      }

      if (revision.has14thSalary) {
        const bonusDate = firstAnnualBonusDate(startDate, 11)
        generated.push({
          id: `job-fixed-${job.id}-14-${revisionIndex}`,
          amount: salaryAmount,
          date: bonusDate,
          endDate: revision.endDate ?? undefined,
          source: job.name,
          tags: ['job', 'fixed-salary', '14th-salary', job.name],
          notes: 'Auto-generated 14th salary.',
          recurring: 'custom',
          recurringIntervalDays: 365,
          createdAt: toDateStamp(bonusDate),
          updatedAt: toDateStamp(bonusDate),
        })
      }
    }
  }
  return generated
}

