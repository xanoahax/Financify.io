import { describe, expect, it } from 'vitest'
import { calculateInterestScenario } from './interest'

describe('interest calculator', () => {
  it('builds timeline with month zero plus duration', () => {
    const result = calculateInterestScenario({
      name: 'test',
      startCapital: 1000,
      recurringContribution: 100,
      contributionFrequency: 'monthly',
      annualInterestRate: 12,
      durationMonths: 12,
      interestFrequency: 'monthly',
      advancedEnabled: false,
      annualInflationRate: 0,
      gainsTaxRate: 0,
      annualContributionIncrease: 0,
    })

    expect(result.timeline.length).toBe(13)
    expect(result.endBalance).toBeGreaterThan(2200)
    expect(result.totalContribution).toBe(1200)
  })

  it('applies advanced inflation + tax outputs', () => {
    const result = calculateInterestScenario({
      name: 'advanced',
      startCapital: 10000,
      recurringContribution: 0,
      contributionFrequency: 'monthly',
      annualInterestRate: 8,
      durationMonths: 24,
      interestFrequency: 'monthly',
      advancedEnabled: true,
      annualInflationRate: 2,
      gainsTaxRate: 25,
      annualContributionIncrease: 0,
    })

    expect(result.realEndBalance).toBeDefined()
    expect((result.realEndBalance ?? 0) < result.endBalance).toBe(true)
  })
})

