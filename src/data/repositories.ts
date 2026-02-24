import type {
  Household,
  HouseholdCost,
  HouseholdCostSplit,
  HouseholdMember,
  HouseholdPayer,
  IncomeEntry,
  InterestScenario,
  Subscription,
} from '../types/models'
import { getDb, type SubscriptionRecord } from './db'
import { getNextPaymentDate } from '../utils/subscription'

interface CacheStore<T> {
  data: T[] | null
}

interface ProfileRepositoryCache {
  subscriptions: CacheStore<Subscription>
  incomeEntries: CacheStore<IncomeEntry>
  interestScenarios: CacheStore<InterestScenario>
  households: CacheStore<Household>
  householdMembers: CacheStore<HouseholdMember>
  householdPayers: CacheStore<HouseholdPayer>
  householdCosts: CacheStore<HouseholdCost>
  householdCostSplits: CacheStore<HouseholdCostSplit>
}

const cacheByProfile = new Map<string, ProfileRepositoryCache>()

function getProfileCache(profileId: string): ProfileRepositoryCache {
  const existing = cacheByProfile.get(profileId)
  if (existing) {
    return existing
  }
  const created: ProfileRepositoryCache = {
    subscriptions: { data: null },
    incomeEntries: { data: null },
    interestScenarios: { data: null },
    households: { data: null },
    householdMembers: { data: null },
    householdPayers: { data: null },
    householdCosts: { data: null },
    householdCostSplits: { data: null },
  }
  cacheByProfile.set(profileId, created)
  return created
}

function cloneRows<T>(rows: T[]): T[] {
  return rows.map((item) => ({ ...item }))
}

function mapSubscriptionRecord(record: SubscriptionRecord): Subscription {
  const { nextPaymentDateCache, ...subscription } = record
  void nextPaymentDateCache
  return subscription
}

function toSubscriptionRecord(subscription: Subscription): SubscriptionRecord {
  return {
    ...subscription,
    nextPaymentDateCache: getNextPaymentDate(subscription),
  }
}

async function getAllCached<T>(
  profileId: string,
  storeName: keyof ProfileRepositoryCache,
  fetcher: () => Promise<T[]>,
): Promise<T[]> {
  const storeCache = getProfileCache(profileId)[storeName] as CacheStore<T>
  if (storeCache.data) {
    return cloneRows(storeCache.data)
  }
  const rows = await fetcher()
  storeCache.data = cloneRows(rows)
  return cloneRows(rows)
}

function markDirty(profileId: string, storeName: keyof ProfileRepositoryCache): void {
  getProfileCache(profileId)[storeName].data = null
}

export function clearRepositoryCache(profileId?: string): void {
  if (!profileId) {
    cacheByProfile.clear()
    return
  }
  cacheByProfile.delete(profileId)
}

export async function listSubscriptions(profileId: string): Promise<Subscription[]> {
  return getAllCached(profileId, 'subscriptions', async () => {
    const db = await getDb(profileId)
    const rows = await db.getAll('subscriptions')
    return rows.map(mapSubscriptionRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  })
}

export async function saveSubscription(profileId: string, subscription: Subscription): Promise<void> {
  const db = await getDb(profileId)
  await db.put('subscriptions', toSubscriptionRecord(subscription))
  markDirty(profileId, 'subscriptions')
}

export async function removeSubscription(profileId: string, id: string): Promise<void> {
  const db = await getDb(profileId)
  await db.delete('subscriptions', id)
  markDirty(profileId, 'subscriptions')
}

export async function replaceSubscriptions(profileId: string, subscriptions: Subscription[]): Promise<void> {
  const db = await getDb(profileId)
  const tx = db.transaction('subscriptions', 'readwrite')
  await tx.store.clear()
  for (const item of subscriptions) {
    await tx.store.put(toSubscriptionRecord(item))
  }
  await tx.done
  markDirty(profileId, 'subscriptions')
}

export async function listIncomeEntries(profileId: string): Promise<IncomeEntry[]> {
  return getAllCached(profileId, 'incomeEntries', async () => {
    const db = await getDb(profileId)
    const rows = await db.getAll('incomeEntries')
    return rows.sort((a, b) => b.date.localeCompare(a.date))
  })
}

export async function saveIncomeEntry(profileId: string, entry: IncomeEntry): Promise<void> {
  const db = await getDb(profileId)
  await db.put('incomeEntries', entry)
  markDirty(profileId, 'incomeEntries')
}

export async function removeIncomeEntry(profileId: string, id: string): Promise<void> {
  const db = await getDb(profileId)
  await db.delete('incomeEntries', id)
  markDirty(profileId, 'incomeEntries')
}

export async function replaceIncomeEntries(profileId: string, entries: IncomeEntry[]): Promise<void> {
  const db = await getDb(profileId)
  const tx = db.transaction('incomeEntries', 'readwrite')
  await tx.store.clear()
  for (const item of entries) {
    await tx.store.put(item)
  }
  await tx.done
  markDirty(profileId, 'incomeEntries')
}

export async function listInterestScenarios(profileId: string): Promise<InterestScenario[]> {
  return getAllCached(profileId, 'interestScenarios', async () => {
    const db = await getDb(profileId)
    const rows = await db.getAll('interestScenarios')
    return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  })
}

export async function saveInterestScenario(profileId: string, scenario: InterestScenario): Promise<void> {
  const db = await getDb(profileId)
  await db.put('interestScenarios', scenario)
  markDirty(profileId, 'interestScenarios')
}

export async function removeInterestScenario(profileId: string, id: string): Promise<void> {
  const db = await getDb(profileId)
  await db.delete('interestScenarios', id)
  markDirty(profileId, 'interestScenarios')
}

export async function replaceInterestScenarios(profileId: string, scenarios: InterestScenario[]): Promise<void> {
  const db = await getDb(profileId)
  const tx = db.transaction('interestScenarios', 'readwrite')
  await tx.store.clear()
  for (const item of scenarios) {
    await tx.store.put(item)
  }
  await tx.done
  markDirty(profileId, 'interestScenarios')
}

export async function listHouseholds(profileId: string): Promise<Household[]> {
  return getAllCached(profileId, 'households', async () => {
    const db = await getDb(profileId)
    const rows = await db.getAll('households')
    return rows.sort((a, b) => {
      if (a.isArchived !== b.isArchived) {
        return Number(a.isArchived) - Number(b.isArchived)
      }
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  })
}

export async function saveHousehold(profileId: string, household: Household): Promise<void> {
  const db = await getDb(profileId)
  await db.put('households', household)
  markDirty(profileId, 'households')
}

export async function removeHousehold(profileId: string, id: string): Promise<void> {
  const db = await getDb(profileId)
  await db.delete('households', id)
  markDirty(profileId, 'households')
}

export async function replaceHouseholds(profileId: string, households: Household[]): Promise<void> {
  const db = await getDb(profileId)
  const tx = db.transaction('households', 'readwrite')
  await tx.store.clear()
  for (const item of households) {
    await tx.store.put(item)
  }
  await tx.done
  markDirty(profileId, 'households')
}

export async function listHouseholdMembers(profileId: string): Promise<HouseholdMember[]> {
  return getAllCached(profileId, 'householdMembers', async () => {
    const db = await getDb(profileId)
    const rows = await db.getAll('householdMembers')
    return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  })
}

export async function saveHouseholdMember(profileId: string, member: HouseholdMember): Promise<void> {
  const db = await getDb(profileId)
  await db.put('householdMembers', member)
  markDirty(profileId, 'householdMembers')
}

export async function removeHouseholdMember(profileId: string, id: string): Promise<void> {
  const db = await getDb(profileId)
  await db.delete('householdMembers', id)
  markDirty(profileId, 'householdMembers')
}

export async function replaceHouseholdMembers(profileId: string, members: HouseholdMember[]): Promise<void> {
  const db = await getDb(profileId)
  const tx = db.transaction('householdMembers', 'readwrite')
  await tx.store.clear()
  for (const item of members) {
    await tx.store.put(item)
  }
  await tx.done
  markDirty(profileId, 'householdMembers')
}

export async function listHouseholdPayers(profileId: string): Promise<HouseholdPayer[]> {
  return getAllCached(profileId, 'householdPayers', async () => {
    const db = await getDb(profileId)
    const rows = await db.getAll('householdPayers')
    return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  })
}

export async function saveHouseholdPayer(profileId: string, payer: HouseholdPayer): Promise<void> {
  const db = await getDb(profileId)
  await db.put('householdPayers', payer)
  markDirty(profileId, 'householdPayers')
}

export async function removeHouseholdPayer(profileId: string, id: string): Promise<void> {
  const db = await getDb(profileId)
  await db.delete('householdPayers', id)
  markDirty(profileId, 'householdPayers')
}

export async function replaceHouseholdPayers(profileId: string, payers: HouseholdPayer[]): Promise<void> {
  const db = await getDb(profileId)
  const tx = db.transaction('householdPayers', 'readwrite')
  await tx.store.clear()
  for (const item of payers) {
    await tx.store.put(item)
  }
  await tx.done
  markDirty(profileId, 'householdPayers')
}

export async function listHouseholdCosts(profileId: string): Promise<HouseholdCost[]> {
  return getAllCached(profileId, 'householdCosts', async () => {
    const db = await getDb(profileId)
    const rows = await db.getAll('householdCosts')
    return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  })
}

export async function saveHouseholdCost(profileId: string, cost: HouseholdCost): Promise<void> {
  const db = await getDb(profileId)
  await db.put('householdCosts', cost)
  markDirty(profileId, 'householdCosts')
}

export async function removeHouseholdCost(profileId: string, id: string): Promise<void> {
  const db = await getDb(profileId)
  await db.delete('householdCosts', id)
  markDirty(profileId, 'householdCosts')
}

export async function replaceHouseholdCosts(profileId: string, costs: HouseholdCost[]): Promise<void> {
  const db = await getDb(profileId)
  const tx = db.transaction('householdCosts', 'readwrite')
  await tx.store.clear()
  for (const item of costs) {
    await tx.store.put(item)
  }
  await tx.done
  markDirty(profileId, 'householdCosts')
}

export async function listHouseholdCostSplits(profileId: string): Promise<HouseholdCostSplit[]> {
  return getAllCached(profileId, 'householdCostSplits', async () => {
    const db = await getDb(profileId)
    const rows = await db.getAll('householdCostSplits')
    return rows.sort((a, b) => a.costId.localeCompare(b.costId) || a.memberId.localeCompare(b.memberId))
  })
}

export async function saveHouseholdCostSplit(profileId: string, split: HouseholdCostSplit): Promise<void> {
  const db = await getDb(profileId)
  await db.put('householdCostSplits', split)
  markDirty(profileId, 'householdCostSplits')
}

export async function removeHouseholdCostSplit(profileId: string, id: string): Promise<void> {
  const db = await getDb(profileId)
  await db.delete('householdCostSplits', id)
  markDirty(profileId, 'householdCostSplits')
}

export async function replaceHouseholdCostSplits(profileId: string, splits: HouseholdCostSplit[]): Promise<void> {
  const db = await getDb(profileId)
  const tx = db.transaction('householdCostSplits', 'readwrite')
  await tx.store.clear()
  for (const item of splits) {
    await tx.store.put(item)
  }
  await tx.done
  markDirty(profileId, 'householdCostSplits')
}
