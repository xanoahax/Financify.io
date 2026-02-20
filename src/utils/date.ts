const MS_PER_DAY = 24 * 60 * 60 * 1000

export function parseDate(input: string): Date {
  const [year, month, day] = input.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function toDateStringLocal(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayString(): string {
  return toDateStringLocal(new Date())
}

export function addMonths(input: string, months: number): string {
  const date = parseDate(input)
  const targetMonth = date.getMonth() + months
  const target = new Date(date.getFullYear(), targetMonth, date.getDate(), 12, 0, 0, 0)
  return toDateStringLocal(target)
}

export function addDays(input: string, days: number): string {
  const date = parseDate(input)
  date.setDate(date.getDate() + days)
  return toDateStringLocal(date)
}

export function subtractDays(input: string, days: number): string {
  return addDays(input, -days)
}

export function compareDateStrings(a: string, b: string): number {
  return parseDate(a).getTime() - parseDate(b).getTime()
}

export function differenceInDays(from: string, to: string): number {
  const ms = parseDate(to).getTime() - parseDate(from).getTime()
  return Math.floor(ms / MS_PER_DAY)
}

export function formatDateByPattern(input: string, format: 'DD.MM.YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'): string {
  const [year, month, day] = input.split('-')
  if (format === 'DD.MM.YYYY') {
    return `${day}.${month}.${year}`
  }
  if (format === 'MM/DD/YYYY') {
    return `${month}/${day}/${year}`
  }
  return `${year}-${month}-${day}`
}

export function monthKey(input: string): string {
  return input.slice(0, 7)
}

export function startOfMonth(input: string): string {
  const date = parseDate(input)
  return toDateStringLocal(new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0))
}

export function endOfMonth(input: string): string {
  const date = parseDate(input)
  return toDateStringLocal(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0, 0))
}

export function startOfYear(input: string): string {
  const date = parseDate(input)
  return toDateStringLocal(new Date(date.getFullYear(), 0, 1, 12, 0, 0, 0))
}

export function endOfYear(input: string): string {
  const date = parseDate(input)
  return toDateStringLocal(new Date(date.getFullYear(), 11, 31, 12, 0, 0, 0))
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

export function withinDays(input: string, daysAhead: number, fromDate = todayString()): boolean {
  const diff = differenceInDays(fromDate, input)
  return diff >= 0 && diff <= daysAhead
}
