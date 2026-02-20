import type { InterestPoint, InterestScenarioInput } from '../types/models'
import { addMonths, todayString } from './date'

export interface InterestResult {
  endBalance: number
  totalContribution: number
  totalInterest: number
  realEndBalance?: number
  timeline: InterestPoint[]
}

export function calculateInterestScenario(input: InterestScenarioInput, startDate = todayString()): InterestResult {
  const timeline: InterestPoint[] = []
  let balance = input.startCapital
  let totalContribution = 0
  let totalInterest = 0
  let currentContribution = input.recurringContribution

  timeline.push({
    month: 0,
    date: startDate,
    contribution: 0,
    interestEarned: 0,
    balance,
    totalContribution,
    totalInterest,
    realBalance: input.advancedEnabled ? balance : undefined,
  })

  const monthlyRate = input.annualInterestRate / 100 / 12
  const yearlyRate = input.annualInterestRate / 100
  const gainsTaxMultiplier = input.advancedEnabled ? 1 - input.gainsTaxRate / 100 : 1
  const annualInflation = input.advancedEnabled ? input.annualInflationRate / 100 : 0
  const contributionGrowth = input.advancedEnabled ? input.annualContributionIncrease / 100 : 0

  for (let month = 1; month <= input.durationMonths; month += 1) {
    const isYearStart = month === 1 || (month - 1) % 12 === 0
    if (month > 1 && isYearStart && contributionGrowth !== 0) {
      currentContribution *= 1 + contributionGrowth
    }

    let contribution = 0
    if (input.contributionFrequency === 'monthly') {
      contribution = currentContribution
    } else if (isYearStart) {
      contribution = currentContribution
    }

    balance += contribution
    totalContribution += contribution

    let grossInterest = 0
    if (input.interestFrequency === 'monthly') {
      grossInterest = balance * monthlyRate
    } else if (month % 12 === 0) {
      grossInterest = balance * yearlyRate
    }

    const netInterest = grossInterest * gainsTaxMultiplier
    balance += netInterest
    totalInterest += netInterest

    const date = addMonths(startDate, month)
    const yearsElapsed = month / 12
    const inflationFactor = (1 + annualInflation) ** yearsElapsed
    const realBalance = input.advancedEnabled ? balance / inflationFactor : undefined

    timeline.push({
      month,
      date,
      contribution,
      interestEarned: netInterest,
      balance,
      totalContribution,
      totalInterest,
      realBalance,
    })
  }

  const lastPoint = timeline[timeline.length - 1]
  return {
    endBalance: lastPoint.balance,
    totalContribution: lastPoint.totalContribution,
    totalInterest: lastPoint.totalInterest,
    realEndBalance: lastPoint.realBalance,
    timeline,
  }
}

