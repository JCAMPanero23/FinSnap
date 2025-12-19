import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Transaction, Account, Category, RecurringRule, WarrantyItem } from '../types';

interface FinSnapDB extends DBSchema {
  transactions: {
    key: string;
    value: Transaction;
    indexes: { 'date': string; 'accountId': string; 'category': string; 'type': string };
  };
  accounts: {
    key: string;
    value: Account;
  };
  categories: {
    key: string;
    value: Category;
  };
  recurring_rules: {
    key: string;
    value: RecurringRule;
  };
  warranties: {
    key: string;
    value: WarrantyItem;
  };
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'finsnap_db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<FinSnapDB> | null = null;

export async function initDB(): Promise<IDBPDatabase<FinSnapDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<FinSnapDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Transactions store
      if (!db.objectStoreNames.contains('transactions')) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
        txStore.createIndex('date', 'date');
        txStore.createIndex('accountId', 'accountId');
        txStore.createIndex('category', 'category');
        txStore.createIndex('type', 'type');
      }

      // Accounts store
      if (!db.objectStoreNames.contains('accounts')) {
        db.createObjectStore('accounts', { keyPath: 'id' });
      }

      // Categories store
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }

      // Recurring rules store
      if (!db.objectStoreNames.contains('recurring_rules')) {
        db.createObjectStore('recurring_rules', { keyPath: 'id' });
      }

      // Warranties store
      if (!db.objectStoreNames.contains('warranties')) {
        db.createObjectStore('warranties', { keyPath: 'id' });
      }

      // Settings store (key-value pairs)
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    },
  });

  return dbInstance;
}

// Transactions
export async function getAllTransactions(): Promise<Transaction[]> {
  const db = await initDB();
  return db.getAll('transactions');
}

export async function getTransaction(id: string): Promise<Transaction | undefined> {
  const db = await initDB();
  return db.get('transactions', id);
}

export async function saveTransaction(transaction: Transaction): Promise<void> {
  const db = await initDB();
  await db.put('transactions', transaction);
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('transactions', id);
}

export async function clearTransactions(): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('transactions', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

// Accounts
export async function getAllAccounts(): Promise<Account[]> {
  const db = await initDB();
  return db.getAll('accounts');
}

export async function saveAccount(account: Account): Promise<void> {
  const db = await initDB();
  await db.put('accounts', account);
}

export async function deleteAccount(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('accounts', id);
}

export async function clearAccounts(): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('accounts', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

// Categories
export async function getAllCategories(): Promise<Category[]> {
  const db = await initDB();
  return db.getAll('categories');
}

export async function saveCategory(category: Category): Promise<void> {
  const db = await initDB();
  await db.put('categories', category);
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('categories', id);
}

export async function clearCategories(): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('categories', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

// Recurring Rules
export async function getAllRecurringRules(): Promise<RecurringRule[]> {
  const db = await initDB();
  return db.getAll('recurring_rules');
}

export async function saveRecurringRule(rule: RecurringRule): Promise<void> {
  const db = await initDB();
  await db.put('recurring_rules', rule);
}

export async function deleteRecurringRule(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('recurring_rules', id);
}

export async function clearRecurringRules(): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('recurring_rules', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

// Warranties
export async function getAllWarranties(): Promise<WarrantyItem[]> {
  const db = await initDB();
  return db.getAll('warranties');
}

export async function saveWarranty(warranty: WarrantyItem): Promise<void> {
  const db = await initDB();
  await db.put('warranties', warranty);
}

export async function deleteWarranty(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('warranties', id);
}

export async function clearWarranties(): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('warranties', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

// Settings
export async function getSetting(key: string): Promise<any> {
  const db = await initDB();
  return db.get('settings', key);
}

export async function saveSetting(key: string, value: any): Promise<void> {
  const db = await initDB();
  await db.put('settings', value, key);
}

export async function deleteSetting(key: string): Promise<void> {
  const db = await initDB();
  await db.delete('settings', key);
}

export async function clearSettings(): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('settings', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

// Clear all data
export async function clearAllData(): Promise<void> {
  await clearTransactions();
  await clearAccounts();
  await clearCategories();
  await clearRecurringRules();
  await clearWarranties();
  await clearSettings();
}
