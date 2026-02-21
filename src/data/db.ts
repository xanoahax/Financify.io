import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { IncomeEntry, InterestScenario, Subscription } from '../types/models'
import { DEFAULT_PROFILE_ID } from './profileStore'

const LEGACY_DB_NAME = 'financify-db'
const DB_VERSION = 1

interface SubscriptionRecord extends Subscription {
  nextPaymentDateCache: string
}

interface FinancifySchema extends DBSchema {
  subscriptions: {
    key: string
    value: SubscriptionRecord
    indexes: {
      status: SubscriptionRecord['status']
      category: string
      nextPaymentDateCache: string
    }
  }
  incomeEntries: {
    key: string
    value: IncomeEntry
    indexes: {
      date: string
      source: string
    }
  }
  interestScenarios: {
    key: string
    value: InterestScenario
    indexes: {
      createdAt: string
    }
  }
}

const dbPromises = new Map<string, Promise<IDBPDatabase<FinancifySchema>>>()

function resolveDbName(profileId: string): string {
  if (profileId === DEFAULT_PROFILE_ID) {
    return LEGACY_DB_NAME
  }
  return `${LEGACY_DB_NAME}-${profileId}`
}

function createDb(dbName: string): Promise<IDBPDatabase<FinancifySchema>> {
  return openDB<FinancifySchema>(dbName, DB_VERSION, {
    upgrade(db) {
      const subscriptions = db.createObjectStore('subscriptions', { keyPath: 'id' })
      subscriptions.createIndex('status', 'status')
      subscriptions.createIndex('category', 'category')
      subscriptions.createIndex('nextPaymentDateCache', 'nextPaymentDateCache')

      const incomes = db.createObjectStore('incomeEntries', { keyPath: 'id' })
      incomes.createIndex('date', 'date')
      incomes.createIndex('source', 'source')

      const scenarios = db.createObjectStore('interestScenarios', { keyPath: 'id' })
      scenarios.createIndex('createdAt', 'createdAt')
    },
  })
}

export function getDb(profileId: string): Promise<IDBPDatabase<FinancifySchema>> {
  const dbName = resolveDbName(profileId)
  const existing = dbPromises.get(dbName)
  if (existing) {
    return existing
  }
  const dbPromise = createDb(dbName)
  dbPromises.set(dbName, dbPromise)
  return dbPromise
}

export async function deleteProfileDb(profileId: string): Promise<void> {
  const dbName = resolveDbName(profileId)
  const existing = dbPromises.get(dbName)
  if (existing) {
    try {
      const db = await existing
      db.close()
    } catch {
      // Ignore close errors and continue deleting.
    }
    dbPromises.delete(dbName)
  }

  await new Promise<void>((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase(dbName)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error(`Failed to delete database ${dbName}`))
    request.onblocked = () => resolve()
  })
}

export async function hasLegacyDbData(): Promise<boolean> {
  const db = await getDb(DEFAULT_PROFILE_ID)
  const tx = db.transaction(['subscriptions', 'incomeEntries', 'interestScenarios'], 'readonly')
  const [subscriptionsCount, incomesCount, scenariosCount] = await Promise.all([
    tx.objectStore('subscriptions').count(),
    tx.objectStore('incomeEntries').count(),
    tx.objectStore('interestScenarios').count(),
  ])
  await tx.done
  return subscriptionsCount + incomesCount + scenariosCount > 0
}

export function resetDbCache(): void {
  dbPromises.clear()
}

export type { SubscriptionRecord }
