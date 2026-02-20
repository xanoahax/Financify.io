import type { IncomeEntry, InterestScenario, Subscription } from '../types/models'
import { getDb, type SubscriptionRecord } from './db'
import { getNextPaymentDate } from '../utils/subscription'

interface CacheStore<T> {
  data: T[] | null
}

const cache = {
  subscriptions: { data: null } as CacheStore<Subscription>,
  incomeEntries: { data: null } as CacheStore<IncomeEntry>,
  interestScenarios: { data: null } as CacheStore<InterestScenario>,
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

async function getAllCached<T>(storeName: keyof typeof cache, fetcher: () => Promise<T[]>): Promise<T[]> {
  const storeCache = cache[storeName] as CacheStore<T>
  if (storeCache.data) {
    return cloneRows(storeCache.data)
  }
  const rows = await fetcher()
  storeCache.data = cloneRows(rows)
  return cloneRows(rows)
}

function markDirty(storeName: keyof typeof cache): void {
  cache[storeName].data = null
}

export async function listSubscriptions(): Promise<Subscription[]> {
  return getAllCached('subscriptions', async () => {
    const db = await getDb()
    const rows = await db.getAll('subscriptions')
    return rows.map(mapSubscriptionRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  })
}

export async function saveSubscription(subscription: Subscription): Promise<void> {
  const db = await getDb()
  await db.put('subscriptions', toSubscriptionRecord(subscription))
  markDirty('subscriptions')
}

export async function removeSubscription(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('subscriptions', id)
  markDirty('subscriptions')
}

export async function replaceSubscriptions(subscriptions: Subscription[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('subscriptions', 'readwrite')
  await tx.store.clear()
  for (const item of subscriptions) {
    await tx.store.put(toSubscriptionRecord(item))
  }
  await tx.done
  markDirty('subscriptions')
}

export async function listIncomeEntries(): Promise<IncomeEntry[]> {
  return getAllCached('incomeEntries', async () => {
    const db = await getDb()
    const rows = await db.getAll('incomeEntries')
    return rows.sort((a, b) => b.date.localeCompare(a.date))
  })
}

export async function saveIncomeEntry(entry: IncomeEntry): Promise<void> {
  const db = await getDb()
  await db.put('incomeEntries', entry)
  markDirty('incomeEntries')
}

export async function removeIncomeEntry(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('incomeEntries', id)
  markDirty('incomeEntries')
}

export async function replaceIncomeEntries(entries: IncomeEntry[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('incomeEntries', 'readwrite')
  await tx.store.clear()
  for (const item of entries) {
    await tx.store.put(item)
  }
  await tx.done
  markDirty('incomeEntries')
}

export async function listInterestScenarios(): Promise<InterestScenario[]> {
  return getAllCached('interestScenarios', async () => {
    const db = await getDb()
    const rows = await db.getAll('interestScenarios')
    return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  })
}

export async function saveInterestScenario(scenario: InterestScenario): Promise<void> {
  const db = await getDb()
  await db.put('interestScenarios', scenario)
  markDirty('interestScenarios')
}

export async function removeInterestScenario(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('interestScenarios', id)
  markDirty('interestScenarios')
}

export async function replaceInterestScenarios(scenarios: InterestScenario[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('interestScenarios', 'readwrite')
  await tx.store.clear()
  for (const item of scenarios) {
    await tx.store.put(item)
  }
  await tx.done
  markDirty('interestScenarios')
}
