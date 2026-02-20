import type { Subscription } from '../types/models'
import { addDays, addMonths, compareDateStrings, subtractDays, todayString, withinDays } from './date'

export function monthlyEquivalent(subscription: Subscription): number {
  switch (subscription.interval) {
    case 'monthly':
      return subscription.amount
    case 'yearly':
      return subscription.amount / 12
    case 'four-weekly':
      return (subscription.amount * 13) / 12
    case 'custom-months': {
      const months = subscription.customIntervalMonths && subscription.customIntervalMonths > 0 ? subscription.customIntervalMonths : 1
      return subscription.amount / months
    }
    default:
      return subscription.amount
  }
}

export function yearlyEquivalent(subscription: Subscription): number {
  return monthlyEquivalent(subscription) * 12
}

function intervalDays(subscription: Subscription): number {
  switch (subscription.interval) {
    case 'monthly':
      return 30
    case 'yearly':
      return 365
    case 'four-weekly':
      return 28
    case 'custom-months':
      return (subscription.customIntervalMonths && subscription.customIntervalMonths > 0 ? subscription.customIntervalMonths : 1) * 30
    default:
      return 30
  }
}

function nextByDays(startDate: string, days: number, today: string): string {
  let candidate = startDate
  let guard = 0
  while (compareDateStrings(candidate, today) < 0 && guard < 500) {
    candidate = addDays(candidate, days)
    guard += 1
  }
  return candidate
}

function nextByMonths(startDate: string, months: number, today: string): string {
  let candidate = startDate
  let guard = 0
  while (compareDateStrings(candidate, today) < 0 && guard < 500) {
    candidate = addMonths(candidate, months)
    guard += 1
  }
  return candidate
}

export function getNextPaymentDate(subscription: Subscription, today = todayString()): string {
  if (subscription.nextPaymentOverride) {
    return subscription.nextPaymentOverride
  }
  if (subscription.interval === 'monthly') {
    return nextByMonths(subscription.startDate, 1, today)
  }
  if (subscription.interval === 'yearly') {
    return nextByMonths(subscription.startDate, 12, today)
  }
  if (subscription.interval === 'custom-months') {
    const months = subscription.customIntervalMonths && subscription.customIntervalMonths > 0 ? subscription.customIntervalMonths : 1
    return nextByMonths(subscription.startDate, months, today)
  }
  return nextByDays(subscription.startDate, intervalDays(subscription), today)
}

export function getCancelByDate(subscription: Subscription, today = todayString()): string {
  const nextPaymentDate = getNextPaymentDate(subscription, today)
  return subtractDays(nextPaymentDate, subscription.noticePeriodDays)
}

export function monthlyTotal(subscriptions: Subscription[]): number {
  return subscriptions
    .filter((item) => item.status === 'active' || item.status === 'paused')
    .reduce((sum, item) => sum + monthlyEquivalent(item), 0)
}

export function yearlyTotal(subscriptions: Subscription[]): number {
  return monthlyTotal(subscriptions) * 12
}

export function upcomingPayments(subscriptions: Subscription[], rangeDays = 30, today = todayString()): Subscription[] {
  return subscriptions
    .filter((item) => item.status === 'active')
    .filter((item) => withinDays(getNextPaymentDate(item, today), rangeDays, today))
    .sort((a, b) => compareDateStrings(getNextPaymentDate(a, today), getNextPaymentDate(b, today)))
}

export function monthlyTrend(subscriptions: Subscription[], monthsBack = 12, today = todayString()): Array<{ month: string; value: number }> {
  const [year, month] = today.split('-').map(Number)
  const output: Array<{ month: string; value: number }> = []

  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const anchor = new Date(year, month - 1 - i, 1)
    const key = `${anchor.getFullYear()}-${`${anchor.getMonth() + 1}`.padStart(2, '0')}`
    const value = subscriptions
      .filter((item) => item.status === 'active' || item.status === 'paused')
      .filter((item) => item.startDate.slice(0, 7) <= key)
      .reduce((sum, item) => sum + monthlyEquivalent(item), 0)
    output.push({ month: key, value })
  }
  return output
}

export function topSubscriptions(subscriptions: Subscription[], limit = 5): Subscription[] {
  return [...subscriptions]
    .filter((item) => item.status === 'active' || item.status === 'paused')
    .sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a))
    .slice(0, limit)
}

export function categoryBreakdown(subscriptions: Subscription[]): Array<{ label: string; value: number }> {
  const map = new Map<string, number>()
  for (const item of subscriptions) {
    if (item.status !== 'active' && item.status !== 'paused') {
      continue
    }
    map.set(item.category, (map.get(item.category) ?? 0) + monthlyEquivalent(item))
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

