import { describe, expect, it } from 'vitest'
import type { Subscription } from '../types/models'
import { getCancelByDate, getNextPaymentDate, monthlyEquivalent } from './subscription'

const base: Subscription = {
  id: '1',
  name: 'Streaming',
  provider: 'Provider',
  category: 'Entertainment',
  tags: [],
  amount: 12,
  interval: 'monthly',
  startDate: '2025-01-01',
  noticePeriodDays: 14,
  notes: '',
  link: '',
  status: 'active',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
}

describe('subscription helpers', () => {
  it('calculates monthly equivalents for yearly intervals', () => {
    expect(monthlyEquivalent({ ...base, interval: 'yearly', amount: 120 })).toBe(10)
  })

  it('advances next payment date from start date', () => {
    const next = getNextPaymentDate(base, '2025-03-10')
    expect(next).toBe('2025-04-01')
  })

  it('derives cancel-by date from notice period', () => {
    const cancelBy = getCancelByDate(base, '2025-03-10')
    expect(cancelBy).toBe('2025-03-18')
  })
})

