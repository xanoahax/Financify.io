import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
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
import { DEFAULT_PROFILE_ID } from './profileStore'

const LEGACY_DB_NAME = 'financify-db'
const DB_VERSION = 3

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
  households: {
    key: string
    value: Household
    indexes: {
      type: Household['type']
    }
  }
  householdMembers: {
    key: string
    value: HouseholdMember
    indexes: {
      householdId: string
    }
  }
  householdPayers: {
    key: string
    value: HouseholdPayer
    indexes: {
      householdId: string
      type: HouseholdPayer['type']
      linkedMemberId: HouseholdPayer['linkedMemberId']
    }
  }
  householdCosts: {
    key: string
    value: HouseholdCost
    indexes: {
      householdId: string
      status: HouseholdCost['status']
      category: string
    }
  }
  householdCostSplits: {
    key: string
    value: HouseholdCostSplit
    indexes: {
      costId: string
      memberId: string
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
      if (!db.objectStoreNames.contains('subscriptions')) {
        const subscriptions = db.createObjectStore('subscriptions', { keyPath: 'id' })
        subscriptions.createIndex('status', 'status')
        subscriptions.createIndex('category', 'category')
        subscriptions.createIndex('nextPaymentDateCache', 'nextPaymentDateCache')
      }

      if (!db.objectStoreNames.contains('incomeEntries')) {
        const incomes = db.createObjectStore('incomeEntries', { keyPath: 'id' })
        incomes.createIndex('date', 'date')
        incomes.createIndex('source', 'source')
      }

      if (!db.objectStoreNames.contains('interestScenarios')) {
        const scenarios = db.createObjectStore('interestScenarios', { keyPath: 'id' })
        scenarios.createIndex('createdAt', 'createdAt')
      }

      if (!db.objectStoreNames.contains('households')) {
        const households = db.createObjectStore('households', { keyPath: 'id' })
        households.createIndex('type', 'type')
      }

      if (!db.objectStoreNames.contains('householdMembers')) {
        const members = db.createObjectStore('householdMembers', { keyPath: 'id' })
        members.createIndex('householdId', 'householdId')
      }

      if (!db.objectStoreNames.contains('householdPayers')) {
        const payers = db.createObjectStore('householdPayers', { keyPath: 'id' })
        payers.createIndex('householdId', 'householdId')
        payers.createIndex('type', 'type')
        payers.createIndex('linkedMemberId', 'linkedMemberId')
      }

      if (!db.objectStoreNames.contains('householdCosts')) {
        const costs = db.createObjectStore('householdCosts', { keyPath: 'id' })
        costs.createIndex('householdId', 'householdId')
        costs.createIndex('status', 'status')
        costs.createIndex('category', 'category')
      }

      if (!db.objectStoreNames.contains('householdCostSplits')) {
        const splits = db.createObjectStore('householdCostSplits', { keyPath: 'id' })
        splits.createIndex('costId', 'costId')
        splits.createIndex('memberId', 'memberId')
      }
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
  const tx = db.transaction(['subscriptions', 'incomeEntries', 'interestScenarios', 'households', 'householdMembers', 'householdPayers', 'householdCosts', 'householdCostSplits'], 'readonly')
  const [subscriptionsCount, incomesCount, scenariosCount, householdsCount, membersCount, payersCount, costsCount, splitsCount] = await Promise.all([
    tx.objectStore('subscriptions').count(),
    tx.objectStore('incomeEntries').count(),
    tx.objectStore('interestScenarios').count(),
    tx.objectStore('households').count(),
    tx.objectStore('householdMembers').count(),
    tx.objectStore('householdPayers').count(),
    tx.objectStore('householdCosts').count(),
    tx.objectStore('householdCostSplits').count(),
  ])
  await tx.done
  return subscriptionsCount + incomesCount + scenariosCount + householdsCount + membersCount + payersCount + costsCount + splitsCount > 0
}

export function resetDbCache(): void {
  dbPromises.clear()
}

export type { SubscriptionRecord }
