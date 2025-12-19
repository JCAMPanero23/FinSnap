# Local-First Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform FinSnap from Supabase-first to local-first architecture with IndexedDB storage, biometric lock, and optional CSV backup to cloud.

**Architecture:** Replace direct Supabase queries with IndexedDB as primary storage. Add biometric unlock layer on startup. Implement manual backup/restore via CSV+ZIP export to Supabase Storage. Migrate existing Supabase data on first launch.

**Tech Stack:** IndexedDB (via `idb`), Capacitor Biometric Auth, JSZip, PapaParse, React 19, TypeScript, Supabase Storage

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install required packages**

```bash
npm install idb @capacitor/biometric-auth jszip papaparse
npm install --save-dev @types/papaparse
```

Expected: Dependencies added to package.json

**Step 2: Verify installation**

```bash
npm list idb @capacitor/biometric-auth jszip papaparse
```

Expected: All 4 packages listed with versions

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add dependencies for local-first architecture

- idb: IndexedDB wrapper
- @capacitor/biometric-auth: Native biometric unlock
- jszip: CSV backup compression
- papaparse: CSV parsing/generation

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create IndexedDB Service

**Files:**
- Create: `services/indexedDBService.ts`

**Step 1: Create IndexedDB service with schema**

Create `services/indexedDBService.ts`:

```typescript
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
```

**Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add services/indexedDBService.ts
git commit -m "feat: add IndexedDB service layer

Complete CRUD operations for all data types:
- Transactions with indexed queries
- Accounts, categories, recurring rules, warranties
- Settings as key-value store
- Bulk clear operations

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create Biometric Service

**Files:**
- Create: `services/biometricService.ts`

**Step 1: Create biometric auth wrapper**

Create `services/biometricService.ts`:

```typescript
import { BiometricAuth } from '@capacitor/biometric-auth';
import { getSetting, saveSetting } from './indexedDBService';

const BIOMETRIC_ENABLED_KEY = 'biometricEnabled';

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const result = await BiometricAuth.checkAvailability();
    return result.isAvailable;
  } catch (error) {
    console.log('Biometric not available:', error);
    return false;
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  const enabled = await getSetting(BIOMETRIC_ENABLED_KEY);
  return enabled === true;
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await saveSetting(BIOMETRIC_ENABLED_KEY, enabled);
}

export async function authenticate(): Promise<{ success: boolean; error?: string }> {
  try {
    await BiometricAuth.authenticate({
      reason: 'Unlock FinSnap',
      cancelTitle: 'Cancel',
      allowDeviceCredential: true,
      iosFallbackTitle: 'Use PIN',
      androidTitle: 'Biometric Authentication',
      androidSubtitle: 'Unlock to access your data',
      androidConfirmationRequired: false,
    });
    return { success: true };
  } catch (error: any) {
    console.error('Biometric authentication failed:', error);
    return { success: false, error: error.message || 'Authentication failed' };
  }
}
```

**Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add services/biometricService.ts
git commit -m "feat: add biometric authentication service

Capacitor wrapper for fingerprint/face unlock:
- Check device capability
- Enable/disable via settings
- Authenticate with fallback to PIN

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Create Receipt Cleanup Service

**Files:**
- Create: `services/receiptCleanupService.ts`

**Step 1: Create receipt cleanup logic**

Create `services/receiptCleanupService.ts`:

```typescript
import { getAllTransactions, saveTransaction, getAllWarranties } from './indexedDBService';

const RECEIPT_RETENTION_DAYS = 14;

export async function cleanupOldReceipts(): Promise<number> {
  let deletedCount = 0;
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - RECEIPT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Clean transaction receipts
  const transactions = await getAllTransactions();
  for (const tx of transactions) {
    if (!tx.receiptImage) continue;
    if (tx.keepReceipt === true) continue; // User wants to keep it

    const txDate = new Date(tx.date);
    if (txDate < cutoffDate) {
      // Delete receipt image
      const updated = { ...tx, receiptImage: undefined };
      await saveTransaction(updated);
      deletedCount++;
    }
  }

  // Warranties always keep their receipts (never clean)

  console.log(`Cleaned up ${deletedCount} old receipt images`);
  return deletedCount;
}
```

**Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add services/receiptCleanupService.ts
git commit -m "feat: add receipt cleanup service

Auto-delete receipt images older than 14 days:
- Respects keepReceipt flag
- Preserves warranty receipts
- Returns count of cleaned receipts

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Create Migration Service

**Files:**
- Create: `services/migrationService.ts`

**Step 1: Create Supabase → IndexedDB migration**

Create `services/migrationService.ts`:

```typescript
import { supabase } from '../lib/supabase';
import {
  saveTransaction,
  saveAccount,
  saveCategory,
  saveRecurringRule,
  saveWarranty,
  saveSetting,
  getSetting,
} from './indexedDBService';
import { Transaction, Account, Category, RecurringRule, WarrantyItem } from '../types';

const MIGRATION_COMPLETED_KEY = 'migrationCompleted';

export async function needsMigration(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;

  const completed = await getSetting(MIGRATION_COMPLETED_KEY);
  if (completed === true) return false;

  // Check if IndexedDB is empty (needs migration)
  const { getAllTransactions } = await import('./indexedDBService');
  const txns = await getAllTransactions();
  return txns.length === 0;
}

export async function migrateFromSupabase(userId: string): Promise<void> {
  console.log('Starting migration from Supabase to IndexedDB...');

  try {
    // Fetch user settings
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('base_currency, gradient_start_color, gradient_end_color, gradient_angle')
      .eq('id', userId)
      .single();

    if (userSettings) {
      await saveSetting('baseCurrency', userSettings.base_currency || 'USD');
      await saveSetting('gradientStartColor', userSettings.gradient_start_color || '#d0dddf');
      await saveSetting('gradientEndColor', userSettings.gradient_end_color || '#dcfefb');
      await saveSetting('gradientAngle', userSettings.gradient_angle || 135);
    }

    // Fetch and save categories
    const { data: categories } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at');

    if (categories) {
      for (const cat of categories) {
        const category: Category = {
          id: cat.id,
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
          isDefault: cat.is_default,
          monthlyBudget: cat.monthly_budget,
        };
        await saveCategory(category);
      }
      console.log(`Migrated ${categories.length} categories`);
    }

    // Fetch and save accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at');

    if (accounts) {
      for (const acc of accounts) {
        const account: Account = {
          id: acc.id,
          name: acc.name,
          type: acc.type,
          last4Digits: acc.last4_digits,
          color: acc.color,
          currency: acc.currency,
          balance: acc.balance,
          autoUpdateBalance: acc.auto_update_balance,
          totalCreditLimit: acc.total_credit_limit,
          monthlySpendingLimit: acc.monthly_spending_limit,
          paymentDueDay: acc.payment_due_day,
        };
        await saveAccount(account);
      }
      console.log(`Migrated ${accounts.length} accounts`);
    }

    // Fetch and save recurring rules
    const { data: rules } = await supabase
      .from('recurring_rules')
      .select('*')
      .eq('user_id', userId);

    if (rules) {
      for (const rule of rules) {
        const recurringRule: RecurringRule = {
          id: rule.id,
          merchantKeyword: rule.merchant_keyword,
          category: rule.category,
          type: rule.type,
          frequency: rule.frequency,
          dueDay: rule.due_day,
          avgAmount: rule.avg_amount,
          lastPaidDate: rule.last_paid_date,
        };
        await saveRecurringRule(recurringRule);
      }
      console.log(`Migrated ${rules.length} recurring rules`);
    }

    // Fetch and save transactions
    const { data: txns } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (txns) {
      for (const tx of txns) {
        const transaction: Transaction = {
          id: tx.id,
          groupId: tx.group_id,
          amount: tx.amount,
          currency: tx.currency,
          originalAmount: tx.original_amount,
          originalCurrency: tx.original_currency,
          exchangeRate: tx.exchange_rate,
          merchant: tx.merchant,
          date: tx.date,
          time: tx.time,
          category: tx.category,
          type: tx.type,
          account: tx.account,
          accountId: tx.account_id,
          rawText: tx.raw_text,
          tags: tx.tags,
          parsedMeta: tx.parsed_meta,
          splitParent: tx.split_parent,
          isTransfer: tx.is_transfer,
        };
        await saveTransaction(transaction);
      }
      console.log(`Migrated ${txns.length} transactions`);
    }

    // Mark migration as completed
    await saveSetting(MIGRATION_COMPLETED_KEY, true);
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw new Error('Failed to migrate data from Supabase');
  }
}

export async function resetMigration(): Promise<void> {
  await saveSetting(MIGRATION_COMPLETED_KEY, false);
}
```

**Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add services/migrationService.ts
git commit -m "feat: add Supabase to IndexedDB migration

One-time migration on first launch:
- Migrates user settings, categories, accounts, rules, transactions
- Marks migration complete to prevent re-running
- Handles errors gracefully

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Update types.ts for Receipt Support

**Files:**
- Modify: `types.ts:89-122`

**Step 1: Add receipt fields to Transaction**

In `types.ts`, update the `Transaction` interface (around line 89):

```typescript
export interface Transaction {
  id: string;
  groupId?: string;
  amount: number;
  currency: string;

  originalAmount?: number;
  originalCurrency?: string;
  exchangeRate?: number;

  merchant: string;
  date: string; // ISO String YYYY-MM-DD
  time?: string; // HH:mm
  category: string;
  type: TransactionType;
  account?: string;
  accountId?: string;
  rawText?: string;
  tags?: string[];

  // Receipt Management
  receiptImage?: string; // Base64 image
  keepReceipt?: boolean; // Prevent auto-deletion

  parsedMeta?: {
    availableBalance?: number;
    availableCredit?: number;
  };

  splitParent?: {
    merchant: string;
    totalAmount: number;
  };

  isTransfer?: boolean;
}
```

**Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add types.ts
git commit -m "feat: add receipt fields to Transaction type

New fields:
- receiptImage: Base64 image data
- keepReceipt: Flag to prevent auto-cleanup

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Create BiometricLock Component

**Files:**
- Create: `components/BiometricLock.tsx`

**Step 1: Create biometric unlock screen**

Create `components/BiometricLock.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { Fingerprint, AlertCircle } from 'lucide-react';
import { authenticate, isBiometricAvailable } from '../services/biometricService';

interface BiometricLockProps {
  onUnlock: () => void;
}

const BiometricLock: React.FC<BiometricLockProps> = ({ onUnlock }) => {
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    checkAndAuthenticate();
  }, []);

  const checkAndAuthenticate = async () => {
    const available = await isBiometricAvailable();
    if (!available) {
      // No biometric available, unlock anyway
      onUnlock();
      return;
    }

    performAuth();
  };

  const performAuth = async () => {
    setIsAuthenticating(true);
    setError(null);

    const result = await authenticate();

    if (result.success) {
      onUnlock();
    } else {
      setError(result.error || 'Authentication failed');
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-6">
          <div className="w-24 h-24 mx-auto bg-teal-100 rounded-full flex items-center justify-center mb-4">
            <Fingerprint className="w-12 h-12 text-teal-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">FinSnap Locked</h1>
          <p className="text-gray-600">
            {isAuthenticating ? 'Authenticating...' : 'Use biometric to unlock'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <p className="text-sm font-medium text-red-800">Authentication Failed</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        )}

        <button
          onClick={performAuth}
          disabled={isAuthenticating}
          className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg font-medium
                   hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAuthenticating ? 'Authenticating...' : 'Retry'}
        </button>

        <p className="text-xs text-gray-500 mt-6">
          Biometric authentication protects access to your financial data
        </p>
      </div>
    </div>
  );
};

export default BiometricLock;
```

**Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add components/BiometricLock.tsx
git commit -m "feat: add BiometricLock component

Biometric unlock screen with:
- Fingerprint icon and branding
- Auto-authenticate on mount
- Retry on failure
- Error display

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Create Backup Service (Part 1 - CSV Export)

**Files:**
- Create: `services/backupService.ts`

**Step 1: Create CSV export functionality**

Create `services/backupService.ts`:

```typescript
import Papa from 'papaparse';
import JSZip from 'jszip';
import { supabase } from '../lib/supabase';
import {
  getAllTransactions,
  getAllAccounts,
  getAllCategories,
  getAllRecurringRules,
  getAllWarranties,
  getSetting,
} from './indexedDBService';

interface BackupRow {
  type: string;
  id: string;
  data_json: string;
}

export async function exportToCSV(): Promise<string> {
  const rows: BackupRow[] = [];

  // Export transactions
  const transactions = await getAllTransactions();
  for (const tx of transactions) {
    rows.push({
      type: 'transaction',
      id: tx.id,
      data_json: JSON.stringify(tx),
    });
  }

  // Export accounts
  const accounts = await getAllAccounts();
  for (const acc of accounts) {
    rows.push({
      type: 'account',
      id: acc.id,
      data_json: JSON.stringify(acc),
    });
  }

  // Export categories
  const categories = await getAllCategories();
  for (const cat of categories) {
    rows.push({
      type: 'category',
      id: cat.id,
      data_json: JSON.stringify(cat),
    });
  }

  // Export recurring rules
  const rules = await getAllRecurringRules();
  for (const rule of rules) {
    rows.push({
      type: 'recurring_rule',
      id: rule.id,
      data_json: JSON.stringify(rule),
    });
  }

  // Export warranties
  const warranties = await getAllWarranties();
  for (const warranty of warranties) {
    rows.push({
      type: 'warranty',
      id: warranty.id,
      data_json: JSON.stringify(warranty),
    });
  }

  // Export settings
  const settingsKeys = ['baseCurrency', 'gradientStartColor', 'gradientEndColor', 'gradientAngle', 'biometricEnabled', 'autoBackupMonthly'];
  for (const key of settingsKeys) {
    const value = await getSetting(key);
    if (value !== undefined) {
      rows.push({
        type: 'setting',
        id: key,
        data_json: JSON.stringify(value),
      });
    }
  }

  const csv = Papa.unparse(rows);
  return csv;
}

export async function exportReceiptsZip(): Promise<Blob> {
  const zip = new JSZip();
  const receiptsFolder = zip.folder('receipts');

  if (!receiptsFolder) {
    throw new Error('Failed to create receipts folder in ZIP');
  }

  // Export transaction receipts
  const transactions = await getAllTransactions();
  for (const tx of transactions) {
    if (tx.receiptImage) {
      // Convert base64 to binary
      const base64Data = tx.receiptImage.split(',')[1] || tx.receiptImage;
      const mimeMatch = tx.receiptImage.match(/data:([^;]+);/);
      const ext = mimeMatch ? mimeMatch[1].split('/')[1] : 'jpg';

      receiptsFolder.file(`transaction_${tx.id}.${ext}`, base64Data, { base64: true });
    }
  }

  // Export warranty receipts
  const warranties = await getAllWarranties();
  for (const warranty of warranties) {
    if (warranty.receiptImage) {
      const base64Data = warranty.receiptImage.split(',')[1] || warranty.receiptImage;
      const mimeMatch = warranty.receiptImage.match(/data:([^;]+);/);
      const ext = mimeMatch ? mimeMatch[1].split('/')[1] : 'jpg';

      receiptsFolder.file(`warranty_${warranty.id}.${ext}`, base64Data, { base64: true });
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  return blob;
}

export async function uploadBackup(userId: string, csv: string, receiptsBlob: Blob): Promise<void> {
  const timestamp = Date.now();
  const folderPath = `backups/${userId}/${timestamp}`;

  // Upload CSV
  const csvFile = new Blob([csv], { type: 'text/csv' });
  const { error: csvError } = await supabase.storage
    .from('backups')
    .upload(`${folderPath}/data.csv`, csvFile);

  if (csvError) {
    throw new Error(`Failed to upload CSV: ${csvError.message}`);
  }

  // Upload receipts ZIP
  const { error: zipError } = await supabase.storage
    .from('backups')
    .upload(`${folderPath}/receipts.zip`, receiptsBlob);

  if (zipError) {
    throw new Error(`Failed to upload receipts: ${zipError.message}`);
  }

  console.log(`Backup uploaded to ${folderPath}`);
}
```

**Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add services/backupService.ts
git commit -m "feat: add backup service (export & upload)

CSV export with all data types
ZIP export with receipt images
Upload to Supabase Storage

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Create Backup Service (Part 2 - Restore)

**Files:**
- Modify: `services/backupService.ts`

**Step 1: Add restore functionality**

Append to `services/backupService.ts`:

```typescript
import {
  saveTransaction,
  saveAccount,
  saveCategory,
  saveRecurringRule,
  saveWarranty,
  saveSetting,
  clearAllData,
} from './indexedDBService';
import { Transaction, Account, Category, RecurringRule, WarrantyItem } from '../types';

export interface BackupInfo {
  path: string;
  timestamp: number;
  date: string;
  size?: number;
}

export async function listBackups(userId: string): Promise<BackupInfo[]> {
  const { data: files, error } = await supabase.storage
    .from('backups')
    .list(`backups/${userId}`, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (error) {
    throw new Error(`Failed to list backups: ${error.message}`);
  }

  const backups: BackupInfo[] = files
    .filter((f) => f.name && !f.name.includes('.'))
    .map((f) => {
      const timestamp = parseInt(f.name);
      return {
        path: `backups/${userId}/${f.name}`,
        timestamp,
        date: new Date(timestamp).toLocaleString(),
        size: f.metadata?.size,
      };
    });

  return backups;
}

export async function downloadBackup(backupPath: string): Promise<{ csv: string; receiptsBlob: Blob }> {
  // Download CSV
  const { data: csvData, error: csvError } = await supabase.storage
    .from('backups')
    .download(`${backupPath}/data.csv`);

  if (csvError || !csvData) {
    throw new Error(`Failed to download CSV: ${csvError?.message}`);
  }

  const csv = await csvData.text();

  // Download receipts ZIP
  const { data: zipData, error: zipError } = await supabase.storage
    .from('backups')
    .download(`${backupPath}/receipts.zip`);

  if (zipError || !zipData) {
    throw new Error(`Failed to download receipts: ${zipError?.message}`);
  }

  return { csv, receiptsBlob: zipData };
}

export async function restoreFromBackup(csv: string, receiptsBlob: Blob): Promise<void> {
  console.log('Starting restore from backup...');

  // Parse CSV
  const parsed = Papa.parse<BackupRow>(csv, { header: true });
  if (parsed.errors.length > 0) {
    throw new Error(`CSV parsing failed: ${parsed.errors[0].message}`);
  }

  // Extract receipts from ZIP
  const zip = await JSZip.loadAsync(receiptsBlob);
  const receiptFiles: { [key: string]: string } = {};

  const receiptsFolder = zip.folder('receipts');
  if (receiptsFolder) {
    const files = Object.keys(zip.files).filter((name) => name.startsWith('receipts/'));
    for (const filename of files) {
      const file = zip.files[filename];
      if (!file.dir) {
        const base64 = await file.async('base64');
        const ext = filename.split('.').pop();
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${base64}`;

        const key = filename.replace('receipts/', '').replace(/\.(jpg|png|gif|webp)$/, '');
        receiptFiles[key] = dataUrl;
      }
    }
  }

  // Clear existing data
  await clearAllData();

  // Restore data
  for (const row of parsed.data) {
    try {
      const data = JSON.parse(row.data_json);

      switch (row.type) {
        case 'transaction': {
          const tx = data as Transaction;
          // Restore receipt if exists
          const receiptKey = `transaction_${tx.id}`;
          if (receiptFiles[receiptKey]) {
            tx.receiptImage = receiptFiles[receiptKey];
          }
          await saveTransaction(tx);
          break;
        }
        case 'account':
          await saveAccount(data as Account);
          break;
        case 'category':
          await saveCategory(data as Category);
          break;
        case 'recurring_rule':
          await saveRecurringRule(data as RecurringRule);
          break;
        case 'warranty': {
          const warranty = data as WarrantyItem;
          // Restore receipt if exists
          const receiptKey = `warranty_${warranty.id}`;
          if (receiptFiles[receiptKey]) {
            warranty.receiptImage = receiptFiles[receiptKey];
          }
          await saveWarranty(warranty);
          break;
        }
        case 'setting':
          await saveSetting(row.id, data);
          break;
      }
    } catch (err) {
      console.error(`Failed to restore ${row.type} ${row.id}:`, err);
    }
  }

  console.log('Restore completed successfully');
}
```

**Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add services/backupService.ts
git commit -m "feat: add restore functionality to backup service

List available backups
Download CSV and receipts ZIP
Parse and restore all data to IndexedDB
Clear existing data before restore

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Add Auto-Backup Check

**Files:**
- Modify: `services/backupService.ts`

**Step 1: Add auto-backup monthly check**

Append to `services/backupService.ts`:

```typescript
export async function shouldAutoBackup(): Promise<boolean> {
  const enabled = await getSetting('autoBackupMonthly');
  if (!enabled) return false;

  const lastBackup = await getSetting('lastAutoBackup');
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;

  // Check if we already backed up this month
  if (lastBackup === currentMonth) return false;

  // Check if it's the last day of the month
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isLastDayOfMonth = tomorrow.getMonth() !== now.getMonth();

  return isLastDayOfMonth;
}

export async function markAutoBackupComplete(): Promise<void> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
  await saveSetting('lastAutoBackup', currentMonth);
}
```

**Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add services/backupService.ts
git commit -m "feat: add auto-backup monthly check

Check if today is last day of month
Track last backup month to avoid duplicates
Mark backup complete after successful upload

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Create Backup/Restore Modal Component

**Files:**
- Create: `components/BackupRestoreModal.tsx`

**Step 1: Create backup/restore UI**

Create `components/BackupRestoreModal.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { Upload, Download, X, AlertTriangle, CheckCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  exportToCSV,
  exportReceiptsZip,
  uploadBackup,
  listBackups,
  downloadBackup,
  restoreFromBackup,
  BackupInfo,
} from '../services/backupService';

interface BackupRestoreModalProps {
  onClose: () => void;
  onRestoreComplete: () => void;
}

const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({ onClose, onRestoreComplete }) => {
  const [mode, setMode] = useState<'menu' | 'backup' | 'restore'>('menu');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);

  const session = supabase.auth.getSession();

  useEffect(() => {
    if (mode === 'restore') {
      loadBackups();
    }
  }, [mode]);

  const loadBackups = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setError('Please login to access backups');
        return;
      }

      const backupList = await listBackups(session.user.id);
      setBackups(backupList);
    } catch (err: any) {
      setError(err.message || 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setError('Please login to backup');
        return;
      }

      const csv = await exportToCSV();
      const receiptsBlob = await exportReceiptsZip();
      await uploadBackup(session.user.id, csv, receiptsBlob);

      setSuccess('Backup completed successfully!');
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Backup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;

    const confirmed = window.confirm(
      'This will REPLACE all local data with the selected backup. Current data will be lost. Continue?'
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { csv, receiptsBlob } = await downloadBackup(selectedBackup.path);
      await restoreFromBackup(csv, receiptsBlob);

      setSuccess('Restore completed! Reloading app...');
      setTimeout(() => {
        onRestoreComplete();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Restore failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">
            {mode === 'menu' && 'Backup & Restore'}
            {mode === 'backup' && 'Backup to Cloud'}
            {mode === 'restore' && 'Restore from Cloud'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {mode === 'menu' && (
            <div className="space-y-3">
              <button
                onClick={() => setMode('backup')}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition flex items-center gap-3"
              >
                <Upload className="w-6 h-6 text-teal-600" />
                <div className="text-left">
                  <div className="font-medium text-gray-800">Backup to Cloud</div>
                  <div className="text-sm text-gray-600">Export data as CSV to Supabase</div>
                </div>
              </button>

              <button
                onClick={() => setMode('restore')}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition flex items-center gap-3"
              >
                <Download className="w-6 h-6 text-blue-600" />
                <div className="text-left">
                  <div className="font-medium text-gray-800">Restore from Cloud</div>
                  <div className="text-sm text-gray-600">Download and restore a backup</div>
                </div>
              </button>
            </div>
          )}

          {mode === 'backup' && (
            <div className="space-y-4">
              <p className="text-gray-700">
                This will export all your data (transactions, accounts, categories, receipts) to Supabase Storage.
              </p>
              <button
                onClick={handleBackup}
                disabled={loading}
                className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Backing up...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Start Backup
                  </>
                )}
              </button>
            </div>
          )}

          {mode === 'restore' && (
            <div className="space-y-4">
              {loading && backups.length === 0 ? (
                <div className="text-center py-8">
                  <Loader className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                  <p className="text-gray-600 mt-2">Loading backups...</p>
                </div>
              ) : backups.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No backups found</p>
              ) : (
                <>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {backups.map((backup) => (
                      <button
                        key={backup.timestamp}
                        onClick={() => setSelectedBackup(backup)}
                        className={`w-full p-3 border-2 rounded-lg text-left transition ${
                          selectedBackup?.timestamp === backup.timestamp
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-gray-800">{backup.date}</div>
                        {backup.size && (
                          <div className="text-sm text-gray-600">
                            {(backup.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleRestore}
                    disabled={!selectedBackup || loading}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Restoring...
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        Restore Selected
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BackupRestoreModal;
```

**Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add components/BackupRestoreModal.tsx
git commit -m "feat: add Backup/Restore modal component

Full UI for backup and restore:
- Menu with backup/restore options
- Backup progress indicator
- List available backups with dates
- Restore with confirmation dialog
- Success/error messages

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Update App.tsx for Local-First Architecture

**Files:**
- Modify: `App.tsx`

**Step 1: Add IndexedDB imports and remove Supabase queries**

At the top of `App.tsx`, add imports:

```typescript
import {
  getAllTransactions,
  getAllAccounts,
  getAllCategories,
  getAllRecurringRules,
  getAllWarranties,
  getSetting,
  saveSetting,
  saveTransaction,
  deleteTransaction as deleteTransactionDB,
  saveAccount,
  deleteAccount as deleteAccountDB,
  saveCategory,
  deleteCategory as deleteCategoryDB,
  saveRecurringRule,
  deleteRecurringRule as deleteRecurringRuleDB,
  saveWarranty,
  deleteWarranty as deleteWarrantyDB,
  clearTransactions,
  clearAllData,
} from './services/indexedDBService';
import { isBiometricEnabled, setBiometricEnabled } from './services/biometricService';
import BiometricLock from './components/BiometricLock';
import BackupRestoreModal from './components/BackupRestoreModal';
import { needsMigration, migrateFromSupabase } from './services/migrationService';
import { cleanupOldReceipts } from './services/receiptCleanupService';
import { shouldAutoBackup, exportToCSV, exportReceiptsZip, uploadBackup, markAutoBackupComplete } from './services/backupService';
```

**Step 2: Add state for biometric lock and modals**

In the `App` component, after existing state declarations:

```typescript
const [biometricLocked, setBiometricLocked] = useState(true);
const [showBackupRestoreModal, setShowBackupRestoreModal] = useState(false);
const [migrating, setMigrating] = useState(false);
```

**Step 3: Replace loadUserData function**

Replace the existing `loadUserData` function (around line 157) with:

```typescript
const loadUserData = async () => {
  try {
    // Check if migration needed
    if (session?.user) {
      const needsMig = await needsMigration(session.user.id);
      if (needsMig) {
        setMigrating(true);
        await migrateFromSupabase(session.user.id);
        setMigrating(false);
      }
    }

    // Load from IndexedDB
    const [
      txns,
      accounts,
      categories,
      rules,
      warranties,
      baseCurrency,
      gradientStartColor,
      gradientEndColor,
      gradientAngle,
    ] = await Promise.all([
      getAllTransactions(),
      getAllAccounts(),
      getAllCategories(),
      getAllRecurringRules(),
      getAllWarranties(),
      getSetting('baseCurrency'),
      getSetting('gradientStartColor'),
      getSetting('gradientEndColor'),
      getSetting('gradientAngle'),
    ]);

    setTransactions(txns || []);
    setSettings({
      baseCurrency: baseCurrency || 'USD',
      categories: categories || [],
      accounts: accounts || [],
      recurringRules: rules || [],
      savingsGoals: [], // Not migrated yet
      warranties: warranties || [],
      gradientStartColor: gradientStartColor || '#d0dddf',
      gradientEndColor: gradientEndColor || '#dcfefb',
      gradientAngle: gradientAngle || 135,
    });

    // Run cleanup on startup
    await cleanupOldReceipts();

    // Check auto-backup
    if (session?.user) {
      const shouldBackup = await shouldAutoBackup();
      if (shouldBackup) {
        try {
          const csv = await exportToCSV();
          const receiptsBlob = await exportReceiptsZip();
          await uploadBackup(session.user.id, csv, receiptsBlob);
          await markAutoBackupComplete();
          console.log('Auto-backup completed');
        } catch (err) {
          console.error('Auto-backup failed:', err);
        }
      }
    }
  } catch (error) {
    console.error('Error loading user data:', error);
  }
};
```

**Step 4: Update handleAddTransactions to use IndexedDB**

Replace the existing `handleAddTransactions` function with:

```typescript
const handleAddTransactions = async (newTransactions: Omit<Transaction, 'id'>[]) => {
  const txnsWithIds = newTransactions.map(tx => ({
    ...tx,
    id: uuidv4(),
  }));

  // Save to IndexedDB
  for (const tx of txnsWithIds) {
    await saveTransaction(tx);

    // Update account balances
    if (tx.accountId) {
      const account = settings.accounts.find(a => a.id === tx.accountId);
      if (account) {
        let newBalance = account.balance;

        if (tx.parsedMeta?.availableBalance !== undefined) {
          newBalance = tx.parsedMeta.availableBalance;
        } else if (tx.parsedMeta?.availableCredit !== undefined && account.totalCreditLimit) {
          newBalance = -(account.totalCreditLimit - tx.parsedMeta.availableCredit);
        } else {
          if (tx.type === TransactionType.EXPENSE) {
            newBalance -= tx.amount;
          } else if (tx.type === TransactionType.INCOME) {
            newBalance += tx.amount;
          }
        }

        const updatedAccount = { ...account, balance: newBalance };
        await saveAccount(updatedAccount);
      }
    }
  }

  // Reload data
  await loadUserData();
};
```

**Step 5: Update handleUpdateSettings to use IndexedDB**

Replace `handleUpdateSettings` with:

```typescript
const handleUpdateSettings = async (newSettings: AppSettings) => {
  // Save settings
  await saveSetting('baseCurrency', newSettings.baseCurrency);
  await saveSetting('gradientStartColor', newSettings.gradientStartColor);
  await saveSetting('gradientEndColor', newSettings.gradientEndColor);
  await saveSetting('gradientAngle', newSettings.gradientAngle);

  // Save categories
  for (const cat of newSettings.categories) {
    await saveCategory(cat);
  }

  // Save accounts
  for (const acc of newSettings.accounts) {
    await saveAccount(acc);
  }

  // Save rules
  for (const rule of newSettings.recurringRules) {
    await saveRecurringRule(rule);
  }

  // Save warranties
  for (const warranty of newSettings.warranties) {
    await saveWarranty(warranty);
  }

  // Reload
  await loadUserData();
};
```

**Step 6: Update delete/edit transaction handlers**

Update `handleDeleteTransaction`:

```typescript
const handleDeleteTransaction = async (id: string) => {
  await deleteTransactionDB(id);
  await loadUserData();
};
```

Update `handleUpdateTransaction`:

```typescript
const handleUpdateTransaction = async (updated: Transaction) => {
  await saveTransaction(updated);
  await loadUserData();
};
```

**Step 7: Add biometric lock wrapper**

In the return statement, wrap the main app content:

```typescript
if (loading || migrating) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-xl font-semibold text-gray-700">
          {migrating ? 'Migrating data to local storage...' : 'Loading...'}
        </div>
      </div>
    </div>
  );
}

if (!session && !isResetPasswordPage) {
  return <Auth />;
}

if (isResetPasswordPage) {
  return <ResetPassword />;
}

// Biometric lock check
if (biometricLocked) {
  return (
    <BiometricLock
      onUnlock={async () => {
        const enabled = await isBiometricEnabled();
        if (!enabled) {
          setBiometricLocked(false);
        } else {
          setBiometricLocked(false);
        }
      }}
    />
  );
}

// Rest of the app...
return (
  <div ...>
    {showBackupRestoreModal && (
      <BackupRestoreModal
        onClose={() => setShowBackupRestoreModal(false)}
        onRestoreComplete={async () => {
          setShowBackupRestoreModal(false);
          await loadUserData();
        }}
      />
    )}
    {/* ... existing JSX ... */}
  </div>
);
```

**Step 8: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build succeeds

**Step 9: Commit**

```bash
git add App.tsx
git commit -m "feat: convert App.tsx to use IndexedDB

Replace Supabase queries with IndexedDB:
- Load all data from local storage
- Save transactions/settings to IndexedDB
- Add biometric lock wrapper
- Add migration check on startup
- Add auto-backup check
- Add receipt cleanup on startup

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 13: Update SettingsView for Biometric and Backup

**Files:**
- Modify: `components/SettingsView.tsx`

**Step 1: Add imports**

At the top of `SettingsView.tsx`:

```typescript
import { isBiometricEnabled, setBiometricEnabled, isBiometricAvailable } from '../services/biometricService';
import { getSetting, saveSetting } from '../services/indexedDBService';
import { Fingerprint, Cloud } from 'lucide-react';
```

**Step 2: Add state for biometric and backup settings**

In the component:

```typescript
const [biometricEnabled, setBiometricEnabledState] = useState(false);
const [biometricAvailable, setBiometricAvailable] = useState(false);
const [autoBackupMonthly, setAutoBackupMonthly] = useState(false);
const [showBackupModal, setShowBackupModal] = useState(false);

useEffect(() => {
  loadSecuritySettings();
}, []);

const loadSecuritySettings = async () => {
  const enabled = await isBiometricEnabled();
  const available = await isBiometricAvailable();
  const autoBackup = await getSetting('autoBackupMonthly');

  setBiometricEnabledState(enabled);
  setBiometricAvailable(available);
  setAutoBackupMonthly(autoBackup === true);
};

const toggleBiometric = async () => {
  const newValue = !biometricEnabled;
  await setBiometricEnabled(newValue);
  setBiometricEnabledState(newValue);
};

const toggleAutoBackup = async () => {
  const newValue = !autoBackupMonthly;
  await saveSetting('autoBackupMonthly', newValue);
  setAutoBackupMonthly(newValue);
};
```

**Step 3: Add Security tab to the tabs array**

Add a new tab after the existing tabs:

```typescript
const tabs = [
  'General',
  'Categories',
  'Accounts',
  'Rules',
  'Security', // NEW
  'Backup & Restore', // NEW
  'Developer',
];
```

**Step 4: Add Security tab content**

In the tab content rendering section, add:

```tsx
{activeTab === 'Security' && (
  <div className="space-y-6">
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Fingerprint className="w-5 h-5" />
        Biometric Authentication
      </h3>

      {!biometricAvailable ? (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            Biometric authentication is not available on this device.
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <div className="font-medium text-gray-800">Enable Biometric Lock</div>
            <div className="text-sm text-gray-600 mt-1">
              Require fingerprint/face unlock on app startup
            </div>
          </div>
          <button
            onClick={toggleBiometric}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              biometricEnabled ? 'bg-teal-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                biometricEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      )}
    </div>
  </div>
)}

{activeTab === 'Backup & Restore' && (
  <div className="space-y-6">
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Cloud className="w-5 h-5" />
        Cloud Backup
      </h3>

      <div className="space-y-4">
        <button
          onClick={() => setShowBackupModal(true)}
          className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition"
        >
          Manage Backups
        </button>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <div className="font-medium text-gray-800">Auto-backup Monthly</div>
            <div className="text-sm text-gray-600 mt-1">
              Automatically backup on the last day of each month
            </div>
          </div>
          <button
            onClick={toggleAutoBackup}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              autoBackupMonthly ? 'bg-teal-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                autoBackupMonthly ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

**Step 5: Import and render BackupRestoreModal**

At the bottom of the component's return statement:

```tsx
{showBackupModal && (
  <BackupRestoreModal
    onClose={() => setShowBackupModal(false)}
    onRestoreComplete={() => {
      setShowBackupModal(false);
      window.location.reload();
    }}
  />
)}
```

**Step 6: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build succeeds

**Step 7: Commit**

```bash
git add components/SettingsView.tsx
git commit -m "feat: add Security and Backup tabs to Settings

New tabs:
- Security: Biometric lock toggle
- Backup & Restore: Manage backups and auto-backup toggle

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 14: Update AddTransaction for Receipt Upload

**Files:**
- Modify: `components/AddTransaction.tsx`

**Step 1: Add receipt upload state**

In the component, add state:

```typescript
const [receiptImage, setReceiptImage] = useState<string | null>(null);
const [keepReceipt, setKeepReceipt] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);
```

**Step 2: Add receipt upload handler**

Add handler function:

```typescript
const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  }
};
```

**Step 3: Include receipt in parsed transactions**

In the `handleParse` function, after AI parsing, add receipt to transactions:

```typescript
const parsedTxns = await parseTransactions(text, settings, imageBase64, imageMimeType);

// Add receipt to each transaction if uploaded
const txnsWithReceipt = parsedTxns.map(tx => ({
  ...tx,
  receiptImage: receiptImage || undefined,
  keepReceipt: keepReceipt || undefined,
}));

onAddTransactions(txnsWithReceipt);
```

**Step 4: Add receipt upload UI**

In the JSX, add a receipt upload section before the Parse button:

```tsx
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <label className="text-sm font-medium text-gray-700">Receipt Image (Optional)</label>
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
    >
      {receiptImage ? 'Change' : 'Upload'}
    </button>
  </div>

  <input
    ref={fileInputRef}
    type="file"
    accept="image/*"
    onChange={handleReceiptUpload}
    className="hidden"
  />

  {receiptImage && (
    <div className="relative">
      <img
        src={receiptImage}
        alt="Receipt"
        className="w-full h-32 object-cover rounded-lg"
      />
      <button
        type="button"
        onClick={() => setReceiptImage(null)}
        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
      >
        <X className="w-4 h-4" />
      </button>

      <label className="flex items-center gap-2 mt-2 text-sm">
        <input
          type="checkbox"
          checked={keepReceipt}
          onChange={(e) => setKeepReceipt(e.target.checked)}
          className="rounded"
        />
        <span className="text-gray-700">Keep receipt (prevent auto-deletion)</span>
      </label>
    </div>
  )}
</div>
```

**Step 5: Clear receipt after successful parse**

In the success handler:

```typescript
setReceiptImage(null);
setKeepReceipt(false);
```

**Step 6: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build succeeds

**Step 7: Commit**

```bash
git add components/AddTransaction.tsx
git commit -m "feat: add receipt upload to AddTransaction

Features:
- Upload receipt image (optional)
- Preview receipt before submission
- Keep receipt checkbox to prevent auto-deletion
- Attach receipt to all parsed transactions

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 15: Update EditTransactionModal for Receipts

**Files:**
- Modify: `components/EditTransactionModal.tsx`

**Step 1: Add receipt state and handler**

In the component:

```typescript
const [receiptImage, setReceiptImage] = useState<string | undefined>(transaction?.receiptImage);
const [keepReceipt, setKeepReceipt] = useState<boolean>(transaction?.keepReceipt || false);
const fileInputRef = useRef<HTMLInputElement>(null);

const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  }
};
```

**Step 2: Include receipt in save handler**

Update the save function to include receipt fields:

```typescript
const updatedTransaction: Transaction = {
  ...transaction,
  amount: parseFloat(formData.amount),
  merchant: formData.merchant,
  date: formData.date,
  category: formData.category,
  type: formData.type as TransactionType,
  receiptImage,
  keepReceipt,
};

onSave(updatedTransaction);
```

**Step 3: Add receipt UI to the modal**

Add after the category input:

```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">Receipt</label>

  {receiptImage ? (
    <div className="relative">
      <img
        src={receiptImage}
        alt="Receipt"
        className="w-full h-48 object-cover rounded-lg"
      />
      <button
        type="button"
        onClick={() => setReceiptImage(undefined)}
        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-teal-500 transition text-gray-600"
    >
      Upload Receipt
    </button>
  )}

  <input
    ref={fileInputRef}
    type="file"
    accept="image/*"
    onChange={handleReceiptUpload}
    className="hidden"
  />

  <label className="flex items-center gap-2 mt-3 text-sm">
    <input
      type="checkbox"
      checked={keepReceipt}
      onChange={(e) => setKeepReceipt(e.target.checked)}
      className="rounded"
    />
    <span className="text-gray-700">Keep receipt permanently</span>
  </label>
</div>
```

**Step 4: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build succeeds

**Step 5: Commit**

```bash
git add components/EditTransactionModal.tsx
git commit -m "feat: add receipt editing to EditTransactionModal

Features:
- View existing receipt
- Upload/replace receipt
- Delete receipt
- Toggle keep receipt flag

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 16: Create Supabase Storage Bucket

**Files:**
- None (Supabase dashboard configuration)

**Step 1: Create storage bucket**

Go to Supabase Dashboard → Storage → Create Bucket:
- Name: `backups`
- Public: No (private)
- File size limit: 50 MB
- Allowed MIME types: `text/csv`, `application/zip`

**Step 2: Set up RLS policies**

Create policies for the `backups` bucket:

Policy 1 - Allow authenticated users to upload:
```sql
CREATE POLICY "Users can upload own backups"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'backups' AND
  (storage.foldername(name))[1] = 'backups' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
```

Policy 2 - Allow authenticated users to read own backups:
```sql
CREATE POLICY "Users can read own backups"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'backups' AND
  (storage.foldername(name))[1] = 'backups' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
```

Policy 3 - Allow authenticated users to delete own backups:
```sql
CREATE POLICY "Users can delete own backups"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'backups' AND
  (storage.foldername(name))[1] = 'backups' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
```

**Step 3: Verify bucket exists**

Test upload via Supabase Dashboard or using the app after deployment.

**Step 4: Document**

Create a note in `docs/supabase-setup.md`:

```markdown
# Supabase Storage Setup

## Backups Bucket

Created a private storage bucket for user backups:
- Bucket name: `backups`
- Path structure: `backups/{userId}/{timestamp}/`
- RLS policies ensure users can only access their own backups
- Max file size: 50 MB

## Policies

1. INSERT: Users can upload to `backups/{their_uid}/`
2. SELECT: Users can read from `backups/{their_uid}/`
3. DELETE: Users can delete from `backups/{their_uid}/`
```

**Step 5: Commit documentation**

```bash
git add docs/supabase-setup.md
git commit -m "docs: add Supabase Storage bucket setup guide

Documents backups bucket configuration and RLS policies

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 17: Testing and Verification

**Files:**
- None (manual testing)

**Step 1: Test biometric lock**

1. Enable biometric in Settings → Security
2. Close and reopen app
3. Verify biometric prompt appears
4. Test successful unlock
5. Test failed unlock and retry

**Step 2: Test data persistence**

1. Add a transaction
2. Close and reopen app
3. Verify transaction persists in IndexedDB
4. Check browser DevTools → Application → IndexedDB → finsnap_db

**Step 3: Test receipt upload**

1. Go to Add Transaction
2. Upload a receipt image
3. Check "Keep receipt" checkbox
4. Parse and save transaction
5. Edit transaction and verify receipt is visible
6. Wait 14 days (or manually adjust receipt date) and verify cleanup doesn't delete flagged receipts

**Step 4: Test backup**

1. Create some test data (transactions, accounts)
2. Go to Settings → Backup & Restore → Manage Backups
3. Create a backup
4. Verify success message
5. Check Supabase Storage dashboard for uploaded files

**Step 5: Test restore**

1. Create a backup
2. Add some new transactions locally
3. Go to Settings → Backup & Restore → Manage Backups
4. Select the backup
5. Click Restore
6. Confirm warning dialog
7. Verify data restored correctly (old transactions visible, new ones gone)

**Step 6: Test migration**

1. Clear IndexedDB (DevTools → Application → IndexedDB → Delete)
2. Ensure you have data in Supabase (from before migration)
3. Reload app
4. Verify migration screen appears
5. Wait for migration to complete
6. Verify all data loaded from Supabase to IndexedDB

**Step 7: Test offline mode**

1. Disconnect internet
2. Open app (should work with biometric unlock)
3. Add a transaction
4. Edit a transaction
5. Verify all operations work without network
6. Reconnect and verify backup still works

**Step 8: Test auto-backup**

1. Enable "Auto-backup monthly" in Settings
2. Manually change system date to last day of month
3. Open app
4. Check console logs for "Auto-backup completed"
5. Verify backup appears in Storage

**Step 9: Build for Android**

```bash
npm run build
npx cap sync android
npx cap open android
```

Build APK in Android Studio and test on device.

**Step 10: Document test results**

Create `docs/testing-results.md`:

```markdown
# Local-First Architecture Testing Results

## Test Date: [YYYY-MM-DD]

### Biometric Lock
- [ ] Prompt appears on startup
- [ ] Successful unlock works
- [ ] Failed unlock shows retry
- [ ] Can disable in Settings

### Data Persistence
- [ ] Transactions persist across restarts
- [ ] Settings persist
- [ ] Accounts persist
- [ ] IndexedDB properly initialized

### Receipt Management
- [ ] Upload receipt works
- [ ] Receipt displays in transaction
- [ ] Keep receipt checkbox works
- [ ] Auto-cleanup deletes old receipts
- [ ] Flagged receipts preserved

### Backup/Restore
- [ ] CSV export includes all data
- [ ] ZIP includes all receipts
- [ ] Upload to Supabase succeeds
- [ ] List backups works
- [ ] Download and restore works
- [ ] Warning dialog before restore

### Migration
- [ ] Detects need for migration
- [ ] Migrates all data from Supabase
- [ ] Marks migration complete
- [ ] Doesn't re-migrate

### Offline Mode
- [ ] App works without internet
- [ ] All CRUD operations work
- [ ] Biometric unlock works offline
- [ ] Backup requires login

### Auto-Backup
- [ ] Monthly check triggers correctly
- [ ] Backup uploads automatically
- [ ] Doesn't duplicate same month

### Android Build
- [ ] APK builds successfully
- [ ] Biometric works on device
- [ ] IndexedDB persists on device
- [ ] Backup/restore works on device

## Issues Found

(List any bugs or issues discovered)

## Notes

(Any additional observations)
```

**Step 11: Commit test documentation**

```bash
git add docs/testing-results.md
git commit -m "docs: add testing checklist for local-first architecture

Comprehensive testing checklist covering:
- Biometric lock
- Data persistence
- Receipt management
- Backup/restore
- Migration
- Offline mode
- Auto-backup
- Android deployment

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Completion

After all tasks are complete:

1. Run final build: `npm run build`
2. Test on web: `npm run dev`
3. Test on Android: `npx cap sync android && npx cap open android`
4. Create final commit summarizing all changes
5. Merge feature branch to main
6. Update CLAUDE.md with new architecture details

**Success Criteria:**
- [ ] App works fully offline
- [ ] Biometric lock protects app access
- [ ] Data persists in IndexedDB
- [ ] Backup/restore works reliably
- [ ] Migration from Supabase successful
- [ ] Receipt management functional
- [ ] Auto-backup triggers monthly
- [ ] No Supabase queries during normal usage

**Congratulations! FinSnap is now local-first with optional cloud backup.**
