import type { IncomeEntry, InterestScenario, Subscription } from '../types/models'
import { getDb, type SubscriptionRecord } from './db'
import { getNextPaymentDate } from '../utils/subscription'

interface CacheStore<T> {
  data: T[] | null
}

interface ProfileRepositoryCache {
  subscriptions: CacheStore<Subscription>
  incomeEntries: CacheStore<IncomeEntry>
  interestScenarios: CacheStore<InterestScenario>
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
