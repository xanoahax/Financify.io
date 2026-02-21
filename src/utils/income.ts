import type { IncomeEntry } from '../types/models'
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
    if (compareDateStrings(entry.date, rangeEnd) > 0) {
      continue
    }

    if (entry.recurring === 'none') {
      if (compareDateStrings(entry.date, rangeStart) >= 0) {
        resolved.push({ ...entry, id: `${entry.id}::${entry.date}` })
      }
      continue
    }

    let currentDate = fastForwardToRangeStart(entry.date, rangeStart, entry)
    let guard = 0
    while (compareDateStrings(currentDate, rangeEnd) <= 0 && guard < 2000) {
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
