import type { AppLanguage } from '../types/models'
import { tx } from './i18n'

export interface ShiftIncomeInput {
  date: string
  startTime: string
  endTime: string
  hourlyRate: number
  language?: AppLanguage
}

export interface ShiftIncomeResult {
  amount: number
  durationHours: number
  crossesMidnight: boolean
}

const MINUTES_PER_DAY = 24 * 60
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function toMinutes(time: string, language: AppLanguage): number {
  const match = TIME_PATTERN.exec(time)
  if (!match) {
    throw new Error(tx(language, 'Uhrzeit muss im Format HH:MM angegeben werden.', 'Time must be in HH:MM format.'))
  }
  const hours = Number(match[1])
  const minutes = Number(match[2])
  return hours * 60 + minutes
}

function ensureDate(date: string, language: AppLanguage): void {
  if (!DATE_PATTERN.test(date)) {
    throw new Error(tx(language, 'Datum muss im Format JJJJ-MM-TT angegeben werden.', 'Date must be in YYYY-MM-DD format.'))
  }
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(tx(language, 'Datum ist ungültig.', 'Date is invalid.'))
  }
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100
}

export function calculateShiftIncome(input: ShiftIncomeInput): ShiftIncomeResult {
  const language = input.language ?? 'de'

  ensureDate(input.date, language)
  if (!Number.isFinite(input.hourlyRate) || input.hourlyRate <= 0) {
    throw new Error(tx(language, 'Stundensatz muss eine positive Zahl sein.', 'Hourly rate must be a positive number.'))
  }

  const startMinutes = toMinutes(input.startTime, language)
  const endMinutes = toMinutes(input.endTime, language)
  if (startMinutes === endMinutes) {
    throw new Error(tx(language, 'Start und Ende dürfen nicht identisch sein.', 'Start and end cannot be identical.'))
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
