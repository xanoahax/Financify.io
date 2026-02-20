import { describe, expect, it } from 'vitest'
import { calculateShiftIncome } from './shiftIncome'

describe('calculateShiftIncome', () => {
  it('berechnet Einkommen für einen Dienst am selben Tag', () => {
    const result = calculateShiftIncome({
      date: '2026-02-20',
      startTime: '08:00',
      endTime: '12:30',
      hourlyRate: 18,
    })

    expect(result.durationHours).toBe(4.5)
    expect(result.amount).toBe(81)
    expect(result.crossesMidnight).toBe(false)
  })

  it('berechnet Einkommen für Dienste über Mitternacht', () => {
    const result = calculateShiftIncome({
      date: '2026-02-20',
      startTime: '22:00',
      endTime: '02:00',
      hourlyRate: 18,
    })

    expect(result.durationHours).toBe(4)
    expect(result.amount).toBe(72)
    expect(result.crossesMidnight).toBe(true)
  })

  it('wirft Fehler bei identischer Start- und Endzeit', () => {
    expect(() =>
      calculateShiftIncome({
        date: '2026-02-20',
        startTime: '10:00',
        endTime: '10:00',
        hourlyRate: 18,
      }),
    ).toThrow('Start und Ende dürfen nicht identisch sein.')
  })
})
