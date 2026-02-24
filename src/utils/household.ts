import type {
  HouseholdCost,
  HouseholdCostFrequency,
  HouseholdCostSplit,
  HouseholdMember,
  HouseholdPayer,
  HouseholdSplitType,
} from '../types/models'
import { addMonths, compareDateStrings, endOfMonth, monthKey, startOfMonth, todayString } from './date'

export const HOUSEHOLD_CATEGORY_SUBCATEGORIES: Record<string, string[]> = {
  Housing: ['Rent', 'Mortgage', 'Building fees'],
  Energy: ['Electricity', 'Gas', 'Heating'],
  Water: ['Water', 'Wastewater'],
  InternetCommunication: ['Internet', 'Mobile phone', 'TV'],
  Insurance: ['Household insurance', 'Building insurance', 'Legal insurance'],
  Household: ['Cleaning supplies', 'Home service', 'Waste disposal'],
  Groceries: ['Supermarket', 'Household goods'],
  Mobility: ['Public transport', 'Fuel', 'Parking'],
  Maintenance: ['Repair fund', 'Maintenance'],
  Other: ['Other'],
}

export interface HouseholdMemberShare {
  memberId: string
  value: number
}

function monthlyFactor(frequency: HouseholdCostFrequency): number {
  if (frequency === 'weekly') {
    return 52 / 12
  }
  if (frequency === 'biweekly') {
    return 26 / 12
  }
  if (frequency === 'yearly') {
    return 1 / 12
  }
  return 1
}

export function monthlyEquivalentHouseholdCost(cost: HouseholdCost): number {
  return cost.amount * monthlyFactor(cost.frequency)
}

export function isHouseholdCostRelevantForMonth(cost: HouseholdCost, monthStart: string): boolean {
  if (cost.status !== 'active') {
    return false
  }
  const rangeStart = startOfMonth(monthStart)
  const rangeEnd = endOfMonth(monthStart)
  if (compareDateStrings(cost.startDate, rangeEnd) > 0) {
    return false
  }
  if (cost.endDate && compareDateStrings(cost.endDate, rangeStart) < 0) {
    return false
  }
  return true
}

export function monthlyHouseholdTotal(costs: HouseholdCost[], monthStart = todayString()): number {
  return costs
    .filter((cost) => isHouseholdCostRelevantForMonth(cost, monthStart))
    .reduce((sum, cost) => sum + monthlyEquivalentHouseholdCost(cost), 0)
}

export function monthlyExternalPayerTotal(
  costs: HouseholdCost[],
  payers: HouseholdPayer[],
  monthStart = todayString(),
): number {
  const externalPayerIds = new Set(payers.filter((payer) => payer.type === 'external').map((payer) => payer.id))
  return costs
    .filter((cost) => isHouseholdCostRelevantForMonth(cost, monthStart))
    .filter((cost) => Boolean(cost.payerId && externalPayerIds.has(cost.payerId)))
    .reduce((sum, cost) => sum + monthlyEquivalentHouseholdCost(cost), 0)
}

export function monthlyResidentNetTotal(
  costs: HouseholdCost[],
  payers: HouseholdPayer[],
  monthStart = todayString(),
): number {
  return Math.max(0, monthlyHouseholdTotal(costs, monthStart) - monthlyExternalPayerTotal(costs, payers, monthStart))
}

export function householdCategoryBreakdown(costs: HouseholdCost[], monthStart = todayString()): Array<{ label: string; value: number }> {
  const byCategory = new Map<string, number>()
  for (const cost of costs) {
    if (!isHouseholdCostRelevantForMonth(cost, monthStart)) {
      continue
    }
    const current = byCategory.get(cost.category) ?? 0
    byCategory.set(cost.category, current + monthlyEquivalentHouseholdCost(cost))
  }
  return [...byCategory.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

function distributeBySplitType(
  amount: number,
  splitType: HouseholdSplitType,
  memberIds: string[],
  splits: HouseholdCostSplit[],
): HouseholdMemberShare[] {
  if (memberIds.length === 0) {
    return []
  }
  if (splitType === 'equal' || splits.length === 0) {
    const share = amount / memberIds.length
    return memberIds.map((memberId) => ({ memberId, value: share }))
  }
  if (splitType === 'fixed_amount') {
    return splits.map((split) => ({ memberId: split.memberId, value: Number(split.shareAmount) || 0 }))
  }
  return splits.map((split) => ({
    memberId: split.memberId,
    value: amount * ((Number(split.sharePercent) || 0) / 100),
  }))
}

export function householdMemberBreakdown(
  costs: HouseholdCost[],
  members: HouseholdMember[],
  payers: HouseholdPayer[],
  allSplits: HouseholdCostSplit[],
  monthStart = todayString(),
): HouseholdMemberShare[] {
  const externalPayerIds = new Set(payers.filter((payer) => payer.type === 'external').map((payer) => payer.id))
  const activeMembers = members.filter((member) => member.isActive)
  const activeMemberIds = activeMembers.map((member) => member.id)
  const totals = new Map<string, number>()
  for (const memberId of activeMemberIds) {
    totals.set(memberId, 0)
  }

  for (const cost of costs) {
    if (!isHouseholdCostRelevantForMonth(cost, monthStart)) {
      continue
    }
    if (cost.payerId && externalPayerIds.has(cost.payerId)) {
      continue
    }
    const amount = monthlyEquivalentHouseholdCost(cost)
    if (!cost.isShared) {
      if (cost.responsibleMemberId && totals.has(cost.responsibleMemberId)) {
        totals.set(cost.responsibleMemberId, (totals.get(cost.responsibleMemberId) ?? 0) + amount)
      }
      continue
    }
    const costSplits = allSplits.filter((split) => split.costId === cost.id && totals.has(split.memberId))
    const distributed = distributeBySplitType(amount, cost.splitType, activeMemberIds, costSplits)
    for (const share of distributed) {
      totals.set(share.memberId, (totals.get(share.memberId) ?? 0) + share.value)
    }
  }

  return [...totals.entries()]
    .map(([memberId, value]) => ({ memberId, value }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
}

export function householdTrend(costs: HouseholdCost[], months = 12, referenceDate = todayString()): Array<{ month: string; value: number }> {
  const points: Array<{ month: string; value: number }> = []
  const currentMonthStart = startOfMonth(referenceDate)
  for (let index = months - 1; index >= 0; index -= 1) {
    const monthStart = addMonths(currentMonthStart, -index)
    points.push({
      month: monthKey(monthStart),
      value: monthlyHouseholdTotal(costs, monthStart),
    })
  }
  return points
}
