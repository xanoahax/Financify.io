export interface ShiftIncomeInput {
  date: string
  startTime: string
  endTime: string
  hourlyRate: number
}

export interface ShiftIncomeResult {
  amount: number
  durationHours: number
  crossesMidnight: boolean
}

const MINUTES_PER_DAY = 24 * 60
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function toMinutes(time: string): number {
  const match = TIME_PATTERN.exec(time)
  if (!match) {
    throw new Error('Uhrzeit muss im Format HH:MM angegeben werden.')
  }
  const hours = Number(match[1])
  const minutes = Number(match[2])
  return hours * 60 + minutes
}

function ensureDate(date: string): void {
  if (!DATE_PATTERN.test(date)) {
    throw new Error('Datum muss im Format JJJJ-MM-TT angegeben werden.')
  }
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Datum ist ungültig.')
  }
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100
}

export function calculateShiftIncome(input: ShiftIncomeInput): ShiftIncomeResult {
  ensureDate(input.date)
  if (!Number.isFinite(input.hourlyRate) || input.hourlyRate <= 0) {
    throw new Error('Stundensatz muss eine positive Zahl sein.')
  }

  const startMinutes = toMinutes(input.startTime)
  const endMinutes = toMinutes(input.endTime)
  if (startMinutes === endMinutes) {
    throw new Error('Start und Ende dürfen nicht identisch sein.')
  }

  const crossesMidnight = endMinutes < startMinutes
  const durationMinutes = crossesMidnight ? endMinutes + MINUTES_PER_DAY - startMinutes : endMinutes - startMinutes
  const durationHours = durationMinutes / 60

  return {
    amount: roundToCents(durationHours * input.hourlyRate),
    durationHours,
    crossesMidnight,
  }
}
