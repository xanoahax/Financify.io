import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { IncomeEntry, InterestScenario, Subscription } from '../types/models'

const DB_NAME = 'financify-db'
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

let dbPromise: Promise<IDBPDatabase<FinancifySchema>> | null = null

export function getDb(): Promise<IDBPDatabase<FinancifySchema>> {
  if (!dbPromise) {
    dbPromise = openDB<FinancifySchema>(DB_NAME, DB_VERSION, {
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
  return dbPromise
}

export type { SubscriptionRecord }

