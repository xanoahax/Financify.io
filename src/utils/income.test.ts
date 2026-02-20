import { describe, expect, it } from 'vitest'
import type { IncomeEntry } from '../types/models'
import { materializeIncomeEntriesForRange, sumIncome } from './income'

const base: IncomeEntry = {
  id: 'income-1',
  amount: 1000,
  date: '2025-01-15',
  source: 'Job',
  tags: [],
  notes: '',
  recurring: 'none',
  createdAt: '2025-01-15T00:00:00.000Z',
  updatedAt: '2025-01-15T00:00:00.000Z',
}

describe('income recurring materialization', () => {
  it('expands monthly recurring entries inside range', () => {
    const rows = materializeIncomeEntriesForRange([{ ...base, recurring: 'monthly' }], '2025-03-01', '2025-05-31')
    expect(rows.map((row) => row.date)).toEqual(['2025-05-15', '2025-04-15', '2025-03-15'])
    expect(sumIncome(rows)).toBe(3000)
  })

  it('expands custom interval entries', () => {
    const rows = materializeIncomeEntriesForRange(
      [{ ...base, recurring: 'custom', recurringIntervalDays: 10, amount: 100 }],
      '2025-01-20',
      '2025-02-15',
    )
    expect(rows.map((row) => row.date)).toEqual(['2025-02-14', '2025-02-04', '2025-01-25'])
    expect(sumIncome(rows)).toBe(300)
  })

  it('keeps one-time entries as single item', () => {
    const rows = materializeIncomeEntriesForRange([{ ...base, recurring: 'none' }], '2025-01-01', '2025-12-31')
    expect(rows).toHaveLength(1)
  })
})

