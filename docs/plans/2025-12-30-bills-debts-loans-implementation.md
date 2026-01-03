# Bills, Debts & Loans Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement scheduled transactions, loan/BNPL accounts, balance reconciliation, postdated cheque tracking, and Bills & Debts view.

**Architecture:** Extend IndexedDB with scheduled_transactions store, create matching/reconciliation services, build new BillsDebtsView component with sub-components, integrate into existing navigation and dashboard.

**Tech Stack:** React 19, TypeScript, IndexedDB (idb), Tailwind CSS, existing component patterns

---

## Phase 1: Foundation - Types & Database Schema

### Task 1: Update TypeScript Types

**Files:**
- Modify: `types.ts:17-35` (Account interface)
- Modify: `types.ts:128` (View type)
- Create types at end of file

**Step 1: Add ScheduledTransaction interface**

Add after line 140 in `types.ts`:

```typescript
export interface ScheduledTransaction {
  id: string;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  type: TransactionType;
  accountId?: string;

  // Scheduling
  dueDate: string; // ISO date YYYY-MM-DD
  recurrencePattern?: 'ONCE' | 'MONTHLY' | 'WEEKLY' | 'CUSTOM';
  recurrenceInterval?: number; // e.g., 2 for "every 2 months"
  recurrenceEndDate?: string;

  // Status
  status: 'PENDING' | 'PAID' | 'SKIPPED' | 'OVERDUE';
  matchedTransactionId?: string;
  clearedDate?: string; // Actual date paid (for cheques)

  // Cheque specific
  isCheque?: boolean;
  chequeNumber?: string;
  chequeImage?: string; // Base64
  seriesId?: string; // Links batch-created cheques

  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}
```

**Step 2: Update AccountType**

Replace line 17:
```typescript
export type AccountType = 'Bank' | 'Credit Card' | 'Cash' | 'Wallet' | 'Loan/BNPL' | 'Other';
```

**Step 3: Add loan fields to Account interface**

Add after line 35 (after paymentDueDay):
```typescript
  // Loan/BNPL specific
  loanPrincipal?: number; // Original loan amount
  loanInstallments?: number; // Total number of installments
  loanStartDate?: string; // ISO date when loan started
```

**Step 4: Update View type**

Replace line 128:
```typescript
export type View = 'dashboard' | 'accounts' | 'categories' | 'add' | 'history' | 'settings' | 'calendar' | 'planning' | 'warranties' | 'bills';
```

**Step 5: Add to AppSettings**

Modify AppSettings interface (around line 76-88) to add:
```typescript
export interface AppSettings {
  baseCurrency: string;
  categories: Category[];
  accounts: Account[];
  recurringRules: RecurringRule[];
  savingsGoals: SavingsGoal[];
  warranties: WarrantyItem[];
  scheduledTransactions: ScheduledTransaction[]; // ADD THIS LINE

  // Gradient Background Settings
  gradientStartColor?: string;
  gradientEndColor?: string;
  gradientAngle?: number;
}
```

**Step 6: Commit**

```bash
git add types.ts
git commit -m "feat: add ScheduledTransaction type and Loan/BNPL account support

- Add ScheduledTransaction interface with scheduling, status, and cheque fields
- Update AccountType to include Loan/BNPL
- Add loan fields to Account interface (principal, installments, startDate)
- Add 'bills' to View type
- Add scheduledTransactions to AppSettings

🤖 Generated with Claude Code"
```

---

### Task 2: Extend IndexedDB Schema

**Files:**
- Modify: `services/indexedDBService.ts`

**Step 1: Update DBSchema interface**

Modify the `FinSnapDB` interface (lines 4-30) to add:

```typescript
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
  // ADD THIS:
  scheduled_transactions: {
    key: string;
    value: ScheduledTransaction;
    indexes: { 'dueDate': string; 'status': string; 'seriesId': string; 'accountId': string };
  };
}
```

**Step 2: Add ScheduledTransaction import**

Update imports at top (line 2):
```typescript
import { Transaction, Account, Category, RecurringRule, WarrantyItem, ScheduledTransaction } from '../types';
```

**Step 3: Increment DB_VERSION**

Change line 33:
```typescript
const DB_VERSION = 2; // Increment from 1 to 2
```

**Step 4: Add scheduled_transactions store in upgrade**

Add after warranties store creation (around line 69):

```typescript
      // Scheduled transactions store
      if (!db.objectStoreNames.contains('scheduled_transactions')) {
        const schedStore = db.createObjectStore('scheduled_transactions', { keyPath: 'id' });
        schedStore.createIndex('dueDate', 'dueDate');
        schedStore.createIndex('status', 'status');
        schedStore.createIndex('seriesId', 'seriesId');
        schedStore.createIndex('accountId', 'accountId');
      }
```

**Step 5: Add CRUD functions for scheduled transactions**

Add at end of file (before any exports):

```typescript
// Scheduled Transactions
export async function getAllScheduledTransactions(): Promise<ScheduledTransaction[]> {
  const db = await initDB();
  return db.getAll('scheduled_transactions');
}

export async function getScheduledTransaction(id: string): Promise<ScheduledTransaction | undefined> {
  const db = await initDB();
  return db.get('scheduled_transactions', id);
}

export async function saveScheduledTransaction(scheduledTransaction: ScheduledTransaction): Promise<void> {
  const db = await initDB();
  await db.put('scheduled_transactions', scheduledTransaction);
}

export async function deleteScheduledTransaction(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('scheduled_transactions', id);
}

export async function getScheduledTransactionsByStatus(status: string): Promise<ScheduledTransaction[]> {
  const db = await initDB();
  const index = db.transaction('scheduled_transactions').store.index('status');
  return index.getAll(status);
}

export async function getScheduledTransactionsBySeries(seriesId: string): Promise<ScheduledTransaction[]> {
  const db = await initDB();
  const index = db.transaction('scheduled_transactions').store.index('seriesId');
  return index.getAll(seriesId);
}

export async function clearScheduledTransactions(): Promise<void> {
  const db = await initDB();
  await db.clear('scheduled_transactions');
}
```

**Step 6: Update clearAllData function**

Find `clearAllData` function and add:
```typescript
export async function clearAllData(): Promise<void> {
  const db = await initDB();
  await db.clear('transactions');
  await db.clear('accounts');
  await db.clear('categories');
  await db.clear('recurring_rules');
  await db.clear('warranties');
  await db.clear('scheduled_transactions'); // ADD THIS
  await db.clear('settings');
}
```

**Step 7: Commit**

```bash
git add services/indexedDBService.ts
git commit -m "feat: add scheduled_transactions store to IndexedDB

- Add scheduled_transactions object store with indexes
- Increment DB version to 2
- Add CRUD functions for scheduled transactions
- Add query functions (by status, by series)
- Update clearAllData to include scheduled transactions

🤖 Generated with Claude Code"
```

---

## Phase 2: Core Services

### Task 3: Create Scheduled Transactions Service

**Files:**
- Create: `services/scheduledTransactionsService.ts`

**Step 1: Create service file with basic operations**

```typescript
import { ScheduledTransaction, TransactionType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import {
  getAllScheduledTransactions,
  saveScheduledTransaction,
  deleteScheduledTransaction,
  getScheduledTransactionsBySeries,
} from './indexedDBService';

/**
 * Create a single scheduled transaction
 */
export async function createScheduledTransaction(
  data: Omit<ScheduledTransaction, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<ScheduledTransaction> {
  const now = new Date().toISOString();
  const scheduledTx: ScheduledTransaction = {
    ...data,
    id: uuidv4(),
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  };

  await saveScheduledTransaction(scheduledTx);
  return scheduledTx;
}

/**
 * Update an existing scheduled transaction
 */
export async function updateScheduledTransaction(
  id: string,
  updates: Partial<ScheduledTransaction>
): Promise<void> {
  const all = await getAllScheduledTransactions();
  const existing = all.find(st => st.id === id);
  if (!existing) throw new Error('Scheduled transaction not found');

  const updated: ScheduledTransaction = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await saveScheduledTransaction(updated);
}

/**
 * Mark scheduled transaction as paid
 */
export async function markAsPaid(
  id: string,
  matchedTransactionId: string,
  clearedDate: string
): Promise<void> {
  await updateScheduledTransaction(id, {
    status: 'PAID',
    matchedTransactionId,
    clearedDate,
  });
}

/**
 * Mark scheduled transaction as skipped
 */
export async function markAsSkipped(id: string, notes?: string): Promise<void> {
  await updateScheduledTransaction(id, {
    status: 'SKIPPED',
    notes,
  });
}

/**
 * Update overdue status for all pending scheduled transactions
 */
export async function updateOverdueStatus(): Promise<void> {
  const all = await getAllScheduledTransactions();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  for (const st of all) {
    if (st.status === 'PENDING' && st.dueDate < today) {
      await updateScheduledTransaction(st.id, { status: 'OVERDUE' });
    }
  }
}

/**
 * Get scheduled transactions by status
 */
export async function getByStatus(
  status: ScheduledTransaction['status']
): Promise<ScheduledTransaction[]> {
  const all = await getAllScheduledTransactions();
  return all.filter(st => st.status === status);
}

/**
 * Get upcoming scheduled transactions (next N days)
 */
export async function getUpcoming(days: number = 30): Promise<ScheduledTransaction[]> {
  const all = await getAllScheduledTransactions();
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + days);

  const todayStr = today.toISOString().split('T')[0];
  const futureStr = futureDate.toISOString().split('T')[0];

  return all
    .filter(st => st.status === 'PENDING' && st.dueDate >= todayStr && st.dueDate <= futureStr)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * Delete all scheduled transactions in a series
 */
export async function deleteSeries(seriesId: string): Promise<void> {
  const seriesItems = await getScheduledTransactionsBySeries(seriesId);
  for (const item of seriesItems) {
    await deleteScheduledTransaction(item.id);
  }
}
```

**Step 2: Commit**

```bash
git add services/scheduledTransactionsService.ts
git commit -m "feat: add scheduled transactions service

- Add CRUD operations for scheduled transactions
- Add status update functions (markAsPaid, markAsSkipped)
- Add updateOverdueStatus to auto-flag overdue items
- Add query functions (getByStatus, getUpcoming)
- Add deleteSeries for batch deletion

🤖 Generated with Claude Code"
```

---

### Task 4: Create Batch Cheque Service

**Files:**
- Create: `services/batchChequeService.ts`

**Step 1: Create batch cheque creator**

```typescript
import { ScheduledTransaction, TransactionType } from '../types';
import { createScheduledTransaction } from './scheduledTransactionsService';
import { v4 as uuidv4 } from 'uuid';

export interface BatchChequeParams {
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  accountId: string;
  firstChequeDate: string; // ISO date YYYY-MM-DD
  frequency: 'MONTHLY' | 'WEEKLY' | 'CUSTOM';
  intervalValue: number; // e.g., 2 for "every 2 months"
  numberOfCheques: number;
  startingChequeNumber?: number;
  chequeImages?: string[]; // Array of base64 images
}

/**
 * Create a batch of cheques with the same amount and frequency
 */
export async function createBatchCheques(
  params: BatchChequeParams
): Promise<ScheduledTransaction[]> {
  const seriesId = uuidv4();
  const createdCheques: ScheduledTransaction[] = [];

  for (let i = 0; i < params.numberOfCheques; i++) {
    // Calculate due date based on frequency
    const dueDate = calculateDueDate(
      params.firstChequeDate,
      i,
      params.frequency,
      params.intervalValue
    );

    // Generate cheque number
    const chequeNumber = params.startingChequeNumber
      ? String(params.startingChequeNumber + i)
      : undefined;

    // Get cheque image if provided
    const chequeImage = params.chequeImages?.[i];

    const cheque = await createScheduledTransaction({
      merchant: params.merchant,
      amount: params.amount,
      currency: params.currency,
      category: params.category,
      type: TransactionType.EXPENSE,
      accountId: params.accountId,
      dueDate,
      recurrencePattern: 'ONCE', // Each cheque is a one-time payment
      isCheque: true,
      chequeNumber,
      chequeImage,
      seriesId,
      notes: `Cheque #${i + 1} of ${params.numberOfCheques}`,
    });

    createdCheques.push(cheque);
  }

  return createdCheques;
}

/**
 * Calculate due date for a cheque in the series
 */
function calculateDueDate(
  firstDate: string,
  index: number,
  frequency: 'MONTHLY' | 'WEEKLY' | 'CUSTOM',
  intervalValue: number
): string {
  const date = new Date(firstDate);

  if (frequency === 'MONTHLY') {
    date.setMonth(date.getMonth() + index * intervalValue);
  } else if (frequency === 'WEEKLY') {
    date.setDate(date.getDate() + index * intervalValue * 7);
  } else {
    // CUSTOM - treat intervalValue as days
    date.setDate(date.getDate() + index * intervalValue);
  }

  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Preview cheque dates before creating
 */
export function previewChequeDates(
  firstDate: string,
  frequency: 'MONTHLY' | 'WEEKLY' | 'CUSTOM',
  intervalValue: number,
  numberOfCheques: number
): string[] {
  const dates: string[] = [];
  for (let i = 0; i < numberOfCheques; i++) {
    dates.push(calculateDueDate(firstDate, i, frequency, intervalValue));
  }
  return dates;
}
```

**Step 2: Commit**

```bash
git add services/batchChequeService.ts
git commit -m "feat: add batch cheque creator service

- Add createBatchCheques for creating cheque series
- Add date calculation logic for monthly/weekly/custom intervals
- Add previewChequeDates for UI preview before creation
- Support cheque numbers and images per cheque

🤖 Generated with Claude Code"
```

---

### Task 5: Create Smart Matching Service

**Files:**
- Create: `services/matchingService.ts`

**Step 1: Create matching algorithm**

```typescript
import { Transaction, ScheduledTransaction } from '../types';
import { getAllScheduledTransactions } from './indexedDBService';

export interface MatchCandidate {
  scheduledTransaction: ScheduledTransaction;
  score: number;
  reasons: string[];
}

/**
 * Find potential matches for a transaction
 */
export async function findMatches(transaction: Transaction): Promise<MatchCandidate[]> {
  const all = await getAllScheduledTransactions();

  // Filter to pending transactions within ±30 days
  const txDate = new Date(transaction.date);
  const minDate = new Date(txDate);
  minDate.setDate(minDate.getDate() - 30);
  const maxDate = new Date(txDate);
  maxDate.setDate(maxDate.getDate() + 30);

  const minDateStr = minDate.toISOString().split('T')[0];
  const maxDateStr = maxDate.toISOString().split('T')[0];

  const candidates = all.filter(
    st =>
      st.status === 'PENDING' &&
      st.type === transaction.type &&
      st.dueDate >= minDateStr &&
      st.dueDate <= maxDateStr
  );

  // Score each candidate
  const scoredCandidates = candidates.map(st => {
    const { score, reasons } = scoreMatch(transaction, st);
    return { scheduledTransaction: st, score, reasons };
  });

  // Return only candidates with score >= 150
  return scoredCandidates
    .filter(c => c.score >= 150)
    .sort((a, b) => b.score - a.score);
}

/**
 * Score a match between transaction and scheduled transaction
 */
function scoreMatch(
  tx: Transaction,
  st: ScheduledTransaction
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Amount matching
  const amountDiff = Math.abs(tx.amount - st.amount);
  const amountPercent = (amountDiff / st.amount) * 100;

  if (amountDiff === 0) {
    score += 100;
    reasons.push('Exact amount match');
  } else if (amountPercent <= 5) {
    score += 50;
    reasons.push('Close amount (±5%)');
  } else if (amountPercent <= 10) {
    score += 25;
    reasons.push('Similar amount (±10%)');
  }

  // Merchant matching
  const txMerchant = tx.merchant.toLowerCase();
  const stMerchant = st.merchant.toLowerCase();

  if (txMerchant === stMerchant) {
    score += 100;
    reasons.push('Exact merchant match');
  } else if (txMerchant.includes(stMerchant) || stMerchant.includes(txMerchant)) {
    score += 50;
    reasons.push('Keyword merchant match');
  } else if (fuzzyMatch(txMerchant, stMerchant)) {
    score += 25;
    reasons.push('Fuzzy merchant match');
  }

  // Date proximity
  const txDate = new Date(tx.date);
  const stDate = new Date(st.dueDate);
  const daysDiff = Math.abs((txDate.getTime() - stDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) {
    score += 50;
    reasons.push('Same day');
  } else if (daysDiff <= 7) {
    score += 25;
    reasons.push(`${Math.floor(daysDiff)} days difference`);
  } else if (daysDiff <= 30) {
    score += 10;
    reasons.push(`${Math.floor(daysDiff)} days difference`);
  }

  // Account matching
  if (tx.accountId && st.accountId && tx.accountId === st.accountId) {
    score += 50;
    reasons.push('Same account');
  }

  return { score, reasons };
}

/**
 * Simple fuzzy matching (Levenshtein distance < 3)
 */
function fuzzyMatch(str1: string, str2: string): boolean {
  const distance = levenshteinDistance(str1, str2);
  return distance <= 3;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Get best match (highest score) if any
 */
export async function getBestMatch(transaction: Transaction): Promise<MatchCandidate | null> {
  const matches = await findMatches(transaction);
  return matches.length > 0 ? matches[0] : null;
}
```

**Step 2: Commit**

```bash
git add services/matchingService.ts
git commit -m "feat: add smart matching service for scheduled transactions

- Add findMatches to find potential scheduled transaction matches
- Implement scoring algorithm (amount, merchant, date, account)
- Add fuzzy matching with Levenshtein distance
- Filter candidates to score >= 150
- Add getBestMatch for auto-suggestion

🤖 Generated with Claude Code"
```

---

### Task 6: Create Balance Reconciliation Service

**Files:**
- Create: `services/reconciliationService.ts`

**Step 1: Create reconciliation logic**

```typescript
import { Transaction, Account } from '../types';

export interface ReconciliationResult {
  currentBalance: number;
  expectedBalance: number;
  difference: number;
  lastSnapshot: Transaction | null;
  needsReconciliation: boolean;
  severity: 'none' | 'minor' | 'major' | 'critical';
}

/**
 * Check if account needs reconciliation
 */
export function checkReconciliation(
  account: Account,
  transactions: Transaction[]
): ReconciliationResult {
  // Find latest transaction with snapshot for this account
  const accountTransactions = transactions
    .filter(t => t.accountId === account.id && t.parsedMeta)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const lastSnapshot = accountTransactions.find(
    t => t.parsedMeta?.availableBalance !== undefined || t.parsedMeta?.availableCredit !== undefined
  ) || null;

  if (!lastSnapshot || !lastSnapshot.parsedMeta) {
    // No snapshot available, can't reconcile
    return {
      currentBalance: account.balance,
      expectedBalance: account.balance,
      difference: 0,
      lastSnapshot: null,
      needsReconciliation: false,
      severity: 'none',
    };
  }

  // Calculate expected balance from snapshot
  const expectedBalance = calculateExpectedBalance(account, lastSnapshot, transactions);
  const difference = Math.abs(account.balance - expectedBalance);

  // Determine if reconciliation needed
  const threshold = Math.max(100, account.balance * 0.05); // 100 or 5%, whichever is larger
  const needsReconciliation = difference > threshold;

  // Determine severity
  let severity: ReconciliationResult['severity'] = 'none';
  if (needsReconciliation) {
    const percentDiff = (difference / Math.abs(account.balance)) * 100;
    if (difference > 500 || percentDiff > 10) {
      severity = 'critical';
    } else if (difference > 200 || percentDiff > 5) {
      severity = 'major';
    } else {
      severity = 'minor';
    }
  }

  return {
    currentBalance: account.balance,
    expectedBalance,
    difference,
    lastSnapshot,
    needsReconciliation,
    severity,
  };
}

/**
 * Calculate expected balance from snapshot
 */
function calculateExpectedBalance(
  account: Account,
  snapshot: Transaction,
  allTransactions: Transaction[]
): number {
  // Get snapshot balance (preferring availableBalance over availableCredit)
  let snapshotBalance = 0;
  if (snapshot.parsedMeta?.availableBalance !== undefined) {
    snapshotBalance = snapshot.parsedMeta.availableBalance;
  } else if (snapshot.parsedMeta?.availableCredit !== undefined && account.totalCreditLimit) {
    // For credit cards: debt = limit - available credit
    snapshotBalance = -(account.totalCreditLimit - snapshot.parsedMeta.availableCredit);
  }

  // Get all transactions after snapshot
  const snapshotDate = new Date(snapshot.date);
  const transactionsAfter = allTransactions
    .filter(t => t.accountId === account.id && new Date(t.date) > snapshotDate)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate delta
  let delta = 0;
  for (const tx of transactionsAfter) {
    if (tx.type === 'INCOME') {
      delta += tx.amount;
    } else {
      delta -= tx.amount;
    }
  }

  return snapshotBalance + delta;
}

/**
 * Check all accounts for reconciliation issues
 */
export function checkAllAccounts(
  accounts: Account[],
  transactions: Transaction[]
): Map<string, ReconciliationResult> {
  const results = new Map<string, ReconciliationResult>();

  for (const account of accounts) {
    const result = checkReconciliation(account, transactions);
    if (result.needsReconciliation) {
      results.set(account.id, result);
    }
  }

  return results;
}
```

**Step 2: Commit**

```bash
git add services/reconciliationService.ts
git commit -m "feat: add balance reconciliation service

- Add checkReconciliation to detect balance discrepancies
- Calculate expected balance from latest snapshot
- Determine severity levels (minor/major/critical)
- Add checkAllAccounts for batch reconciliation check
- Use threshold of 5% or 100 AED minimum

🤖 Generated with Claude Code"
```

---

## Phase 3: UI Components - Bills & Debts View

### Task 7: Create BillsDebtsView Component

**Files:**
- Create: `components/BillsDebtsView.tsx`

**Step 1: Create main view skeleton**

```typescript
import React, { useState, useEffect } from 'react';
import { ScheduledTransaction, Account } from '../types';
import { PlusCircle, Calendar } from 'lucide-react';
import { getAllScheduledTransactions } from '../services/indexedDBService';
import { updateOverdueStatus, getByStatus, getUpcoming } from '../services/scheduledTransactionsService';

interface BillsDebtsViewProps {
  accounts: Account[];
  onCreateScheduled: () => void;
  onCreateBatchCheques: () => void;
  onMarkPaid: (scheduledTx: ScheduledTransaction) => void;
  onSkip: (scheduledTx: ScheduledTransaction) => void;
  onViewScheduled: (scheduledTx: ScheduledTransaction) => void;
}

const BillsDebtsView: React.FC<BillsDebtsViewProps> = ({
  accounts,
  onCreateScheduled,
  onCreateBatchCheques,
  onMarkPaid,
  onSkip,
  onViewScheduled,
}) => {
  const [scheduledTransactions, setScheduledTransactions] = useState<ScheduledTransaction[]>([]);
  const [overdueItems, setOverdueItems] = useState<ScheduledTransaction[]>([]);
  const [upcomingItems, setUpcomingItems] = useState<ScheduledTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScheduledTransactions();
  }, []);

  const loadScheduledTransactions = async () => {
    setLoading(true);
    try {
      // Update overdue status first
      await updateOverdueStatus();

      // Load all scheduled transactions
      const all = await getAllScheduledTransactions();
      setScheduledTransactions(all);

      // Get overdue
      const overdue = await getByStatus('OVERDUE');
      setOverdueItems(overdue);

      // Get upcoming (next 30 days)
      const upcoming = await getUpcoming(30);
      setUpcomingItems(upcoming);
    } catch (error) {
      console.error('Error loading scheduled transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group cheques by series
  const chequeSeries = scheduledTransactions
    .filter(st => st.isCheque && st.seriesId)
    .reduce((acc, st) => {
      const key = st.seriesId!;
      if (!acc[key]) acc[key] = [];
      acc[key].push(st);
      return acc;
    }, {} as Record<string, ScheduledTransaction[]>);

  // Get loan accounts
  const loanAccounts = accounts.filter(a => a.type === 'Loan/BNPL');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header Actions */}
      <div className="flex gap-2">
        <button
          onClick={onCreateScheduled}
          className="flex-1 bg-brand-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-600 transition-colors flex items-center justify-center gap-2"
        >
          <PlusCircle size={20} />
          New Scheduled
        </button>
        <button
          onClick={onCreateBatchCheques}
          className="flex-1 bg-purple-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
        >
          <Calendar size={20} />
          Batch Cheques
        </button>
      </div>

      {/* Overdue Section */}
      {overdueItems.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-red-600 mb-3">🚨 Overdue ({overdueItems.length})</h2>
          <div className="space-y-2">
            {overdueItems.map(item => (
              <div
                key={item.id}
                className="bg-red-50 border border-red-200 rounded-lg p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-gray-900">{item.merchant}</div>
                    <div className="text-sm text-red-600">
                      Due: {new Date(item.dueDate).toLocaleDateString()}
                    </div>
                    <div className="text-lg font-bold text-gray-900 mt-1">
                      {item.amount} {item.currency}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onMarkPaid(item)}
                      className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                    >
                      Mark Paid
                    </button>
                    <button
                      onClick={() => onSkip(item)}
                      className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Section */}
      {upcomingItems.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">📅 Upcoming (Next 30 Days)</h2>
          <div className="space-y-2">
            {upcomingItems.slice(0, 10).map(item => (
              <div
                key={item.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onViewScheduled(item)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-gray-900">{item.merchant}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(item.dueDate).toLocaleDateString()}
                      {item.isCheque && item.chequeNumber && (
                        <span className="ml-2 text-purple-600">Cheque #{item.chequeNumber}</span>
                      )}
                    </div>
                    <div className="text-lg font-bold text-gray-900 mt-1">
                      {item.amount} {item.currency}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cheque Series Section */}
      {Object.keys(chequeSeries).length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">📋 Cheque Series</h2>
          <div className="space-y-2">
            {Object.entries(chequeSeries).map(([seriesId, cheques]) => {
              const paid = cheques.filter(c => c.status === 'PAID').length;
              const total = cheques.length;
              const nextCheque = cheques
                .filter(c => c.status === 'PENDING')
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

              return (
                <div key={seriesId} className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="font-semibold text-gray-900">{cheques[0].merchant}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {paid}/{total} cashed
                  </div>
                  {nextCheque && (
                    <div className="text-sm text-purple-700 mt-1">
                      Next: {new Date(nextCheque.dueDate).toLocaleDateString()} - #{nextCheque.chequeNumber}
                    </div>
                  )}
                  <div className="w-full bg-purple-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{ width: `${(paid / total) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loan Accounts Section */}
      {loanAccounts.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">💰 Loan Accounts</h2>
          <div className="space-y-2">
            {loanAccounts.map(account => {
              const principal = account.loanPrincipal || 0;
              const paid = principal + account.balance; // balance is negative
              const remaining = -account.balance;
              const progress = (paid / principal) * 100;

              // Find next payment
              const nextPayment = upcomingItems.find(
                st => st.accountId === account.id
              );

              return (
                <div key={account.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="font-semibold text-gray-900">{account.name}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Borrowed: {principal} {account.currency}
                  </div>
                  <div className="text-sm text-gray-600">
                    Paid: {paid.toFixed(2)} {account.currency} ({account.loanInstallments ? `${Math.floor((paid / principal) * account.loanInstallments)}/${account.loanInstallments}` : `${progress.toFixed(0)}%`} installments)
                  </div>
                  <div className="text-sm font-semibold text-blue-700">
                    Remaining: {remaining.toFixed(2)} {account.currency}
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {nextPayment && (
                    <div className="text-sm text-blue-700 mt-2">
                      Next: {new Date(nextPayment.dueDate).toLocaleDateString()} - {nextPayment.amount} {nextPayment.currency}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {overdueItems.length === 0 && upcomingItems.length === 0 && loanAccounts.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Calendar size={48} className="mx-auto mb-4 opacity-50" />
          <p>No scheduled bills or loans yet</p>
          <p className="text-sm mt-2">Create your first scheduled transaction or loan account</p>
        </div>
      )}
    </div>
  );
};

export default BillsDebtsView;
```

**Step 2: Commit**

```bash
git add components/BillsDebtsView.tsx
git commit -m "feat: create Bills & Debts view component

- Add main BillsDebtsView component with sections
- Display overdue items with Mark Paid/Skip actions
- Show upcoming transactions (next 30 days)
- Group and display cheque series with progress
- Show loan accounts with payment progress
- Add empty state and loading state

🤖 Generated with Claude Code"
```

---

### Task 8: Create Supporting Modals

**Files:**
- Create: `components/ScheduledTransactionForm.tsx`
- Create: `components/BatchChequeCreator.tsx`
- Create: `components/MatchingConfirmationModal.tsx`

**Step 1: Create ScheduledTransactionForm**

```typescript
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ScheduledTransaction, TransactionType, Account, Category } from '../types';

interface ScheduledTransactionFormProps {
  onClose: () => void;
  onSave: (data: Partial<ScheduledTransaction>) => Promise<void>;
  accounts: Account[];
  categories: Category[];
  initialData?: ScheduledTransaction;
}

const ScheduledTransactionForm: React.FC<ScheduledTransactionFormProps> = ({
  onClose,
  onSave,
  accounts,
  categories,
  initialData,
}) => {
  const [merchant, setMerchant] = useState(initialData?.merchant || '');
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
  const [category, setCategory] = useState(initialData?.category || categories[0]?.name || '');
  const [type, setType] = useState<TransactionType>(initialData?.type || TransactionType.EXPENSE);
  const [accountId, setAccountId] = useState(initialData?.accountId || accounts[0]?.id || '');
  const [dueDate, setDueDate] = useState(initialData?.dueDate || '');
  const [recurrencePattern, setRecurrencePattern] = useState<'ONCE' | 'MONTHLY' | 'WEEKLY'>(
    initialData?.recurrencePattern || 'ONCE'
  );
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant || !amount || !dueDate || !accountId) return;

    setSaving(true);
    try {
      await onSave({
        merchant,
        amount: parseFloat(amount),
        currency: accounts.find(a => a.id === accountId)?.currency || 'USD',
        category,
        type,
        accountId,
        dueDate,
        recurrencePattern,
        notes,
      });
      onClose();
    } catch (error) {
      console.error('Error saving scheduled transaction:', error);
      alert('Failed to save scheduled transaction');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">
            {initialData ? 'Edit' : 'Create'} Scheduled Transaction
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Merchant/Description *
            </label>
            <input
              type="text"
              value={merchant}
              onChange={e => setMerchant(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="e.g., Electricity Bill"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as TransactionType)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value={TransactionType.EXPENSE}>Expense</option>
              <option value={TransactionType.INCOME}>Income</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account *</label>
            <select
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recurrence</label>
            <select
              value={recurrencePattern}
              onChange={e => setRecurrencePattern(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="ONCE">One-time</option>
              <option value="MONTHLY">Monthly</option>
              <option value="WEEKLY">Weekly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              rows={3}
              placeholder="Optional notes"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Saving...' : initialData ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduledTransactionForm;
```

**Step 2: Commit**

```bash
git add components/ScheduledTransactionForm.tsx
git commit -m "feat: add scheduled transaction form component

- Create form for adding/editing scheduled transactions
- Support merchant, amount, type, category, account, due date
- Add recurrence pattern selection (once/monthly/weekly)
- Include notes field for additional context

🤖 Generated with Claude Code"
```

---

### Task 9: Create BatchChequeCreator Component

**Files:**
- Create: `components/BatchChequeCreator.tsx`

**Step 1: Create batch cheque creator modal**

```typescript
import React, { useState } from 'react';
import { X, Camera, Upload } from 'lucide-react';
import { Account, Category } from '../types';
import { previewChequeDates } from '../services/batchChequeService';
import LiveScanner from './LiveScanner';

interface BatchChequeCreatorProps {
  onClose: () => void;
  onSave: (data: {
    merchant: string;
    amount: number;
    currency: string;
    category: string;
    accountId: string;
    firstChequeDate: string;
    frequency: 'MONTHLY' | 'WEEKLY' | 'CUSTOM';
    intervalValue: number;
    numberOfCheques: number;
    startingChequeNumber?: number;
    chequeImages?: string[];
  }) => Promise<void>;
  accounts: Account[];
  categories: Category[];
}

const BatchChequeCreator: React.FC<BatchChequeCreatorProps> = ({
  onClose,
  onSave,
  accounts,
  categories,
}) => {
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0]?.name || '');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [firstChequeDate, setFirstChequeDate] = useState('');
  const [frequency, setFrequency] = useState<'MONTHLY' | 'WEEKLY' | 'CUSTOM'>('MONTHLY');
  const [intervalValue, setIntervalValue] = useState(1);
  const [numberOfCheques, setNumberOfCheques] = useState(6);
  const [startingChequeNumber, setStartingChequeNumber] = useState('');
  const [chequeImages, setChequeImages] = useState<string[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [scanningIndex, setScanningIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  // Preview dates
  const previewDates = firstChequeDate
    ? previewChequeDates(firstChequeDate, frequency, intervalValue, numberOfCheques)
    : [];

  const handleScanCheque = (imageData: string) => {
    const newImages = [...chequeImages];
    newImages[scanningIndex] = imageData;
    setChequeImages(newImages);
    setShowScanner(false);

    // Auto-advance to next cheque if not done
    if (scanningIndex < numberOfCheques - 1) {
      setScanningIndex(scanningIndex + 1);
      setShowScanner(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant || !amount || !firstChequeDate || !accountId) return;

    setSaving(true);
    try {
      await onSave({
        merchant,
        amount: parseFloat(amount),
        currency: accounts.find(a => a.id === accountId)?.currency || 'USD',
        category,
        accountId,
        firstChequeDate,
        frequency,
        intervalValue,
        numberOfCheques,
        startingChequeNumber: startingChequeNumber ? parseInt(startingChequeNumber) : undefined,
        chequeImages: chequeImages.filter(img => img), // Only include scanned images
      });
      onClose();
    } catch (error) {
      console.error('Error creating batch cheques:', error);
      alert('Failed to create batch cheques');
    } finally {
      setSaving(false);
    }
  };

  if (showScanner) {
    return (
      <LiveScanner
        onCapture={handleScanCheque}
        onClose={() => setShowScanner(false)}
        title={`Scan Cheque #${scanningIndex + 1} of ${numberOfCheques}`}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Create Cheque Series</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Merchant *</label>
            <input
              type="text"
              value={merchant}
              onChange={e => setMerchant(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="e.g., Rent - Landlord Name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account *</label>
            <select
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Cheque Date *
            </label>
            <input
              type="date"
              value={firstChequeDate}
              onChange={e => setFirstChequeDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="MONTHLY"
                  checked={frequency === 'MONTHLY'}
                  onChange={e => setFrequency(e.target.value as any)}
                />
                <span>Monthly</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="WEEKLY"
                  checked={frequency === 'WEEKLY'}
                  onChange={e => setFrequency(e.target.value as any)}
                />
                <span>Weekly</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="CUSTOM"
                  checked={frequency === 'CUSTOM'}
                  onChange={e => setFrequency(e.target.value as any)}
                />
                <span>Every</span>
                <input
                  type="number"
                  min="1"
                  value={intervalValue}
                  onChange={e => setIntervalValue(parseInt(e.target.value) || 1)}
                  className="w-16 border border-gray-300 rounded px-2 py-1"
                />
                <span>{frequency === 'MONTHLY' ? 'months' : frequency === 'WEEKLY' ? 'weeks' : 'days'}</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Cheques *
            </label>
            <input
              type="number"
              min="1"
              max="24"
              value={numberOfCheques}
              onChange={e => setNumberOfCheques(parseInt(e.target.value) || 1)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            />
          </div>

          {/* Preview */}
          {previewDates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preview:</label>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
                {previewDates.map((date, idx) => (
                  <div key={idx} className="text-sm text-gray-700">
                    ✓ {new Date(date).toLocaleDateString()} - {amount || '0.00'} {accounts.find(a => a.id === accountId)?.currency || 'USD'}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cheque Numbers (optional)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Starting from:</span>
              <input
                type="number"
                value={startingChequeNumber}
                onChange={e => setStartingChequeNumber(e.target.value)}
                className="w-32 border border-gray-300 rounded-lg px-3 py-2"
                placeholder="10001"
              />
            </div>
          </div>

          {/* Cheque Images */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cheque Images (optional)
            </label>
            <button
              type="button"
              onClick={() => {
                setScanningIndex(0);
                setShowScanner(true);
              }}
              className="w-full bg-purple-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-600 flex items-center justify-center gap-2"
            >
              <Camera size={20} />
              Scan Cheques ({chequeImages.filter(img => img).length}/{numberOfCheques})
            </button>
            {chequeImages.filter(img => img).length > 0 && (
              <div className="mt-2 text-sm text-green-600">
                ✓ {chequeImages.filter(img => img).length} cheque(s) scanned
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Creating...' : `Create ${numberOfCheques} Cheques`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BatchChequeCreator;
```

**Step 2: Commit**

```bash
git add components/BatchChequeCreator.tsx
git commit -m "feat: add batch cheque creator component

- Create modal for batch cheque creation
- Support frequency selection (monthly/weekly/custom)
- Show preview of cheque dates before creation
- Integrate LiveScanner for cheque image capture
- Support sequential scanning of multiple cheques
- Include cheque numbering with auto-increment

🤖 Generated with Claude Code"
```

---

### Task 10: Create Matching Confirmation Modal

**Files:**
- Create: `components/MatchingConfirmationModal.tsx`

**Step 1: Create matching modal**

```typescript
import React from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { Transaction, ScheduledTransaction } from '../types';

interface MatchingConfirmationModalProps {
  transaction: Transaction;
  scheduledTransaction: ScheduledTransaction;
  score: number;
  reasons: string[];
  onConfirm: () => void;
  onReject: () => void;
}

const MatchingConfirmationModal: React.FC<MatchingConfirmationModalProps> = ({
  transaction,
  scheduledTransaction,
  score,
  reasons,
  onConfirm,
  onReject,
}) => {
  // Calculate delay
  const txDate = new Date(transaction.date);
  const dueDate = new Date(scheduledTransaction.dueDate);
  const daysDiff = Math.floor((txDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

  let delayText = '';
  if (daysDiff === 0) {
    delayText = 'On time';
  } else if (daysDiff > 0) {
    delayText = `${daysDiff} day${daysDiff > 1 ? 's' : ''} late`;
  } else {
    delayText = `${Math.abs(daysDiff)} day${Math.abs(daysDiff) > 1 ? 's' : ''} early`;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-4 flex items-center gap-3 rounded-t-lg">
          <AlertCircle size={24} className="text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Possible Match Found</h2>
        </div>

        <div className="p-6 space-y-4">
          {/* Match Score */}
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-sm text-gray-600 mb-1">Match Confidence</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${Math.min((score / 300) * 100, 100)}%` }}
                />
              </div>
              <div className="text-sm font-semibold text-blue-700">
                {Math.min(Math.floor((score / 300) * 100), 100)}%
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {reasons.join(' • ')}
            </div>
          </div>

          {/* Scheduled Transaction */}
          <div>
            <div className="text-sm font-medium text-gray-600 mb-2">Scheduled:</div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="font-semibold text-gray-900">{scheduledTransaction.merchant}</div>
              <div className="text-lg font-bold text-gray-900 mt-1">
                {scheduledTransaction.amount} {scheduledTransaction.currency}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Due: {dueDate.toLocaleDateString()}
              </div>
              {scheduledTransaction.isCheque && scheduledTransaction.chequeNumber && (
                <div className="text-sm text-purple-600 mt-1">
                  Cheque #{scheduledTransaction.chequeNumber}
                </div>
              )}
            </div>
          </div>

          {/* Actual Transaction */}
          <div>
            <div className="text-sm font-medium text-gray-600 mb-2">Actual Transaction:</div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="font-semibold text-gray-900">{transaction.merchant}</div>
              <div className="text-lg font-bold text-gray-900 mt-1">
                {transaction.amount} {transaction.currency}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Paid: {txDate.toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Delay Information */}
          <div className={`p-3 rounded-lg ${daysDiff === 0 ? 'bg-green-50' : daysDiff > 0 ? 'bg-orange-50' : 'bg-blue-50'}`}>
            <div className="text-sm font-medium text-gray-700">
              {daysDiff === 0 ? '✓' : daysDiff > 0 ? '⚠️' : '📅'} {delayText}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onReject}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <X size={18} />
              Different Transaction
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 flex items-center justify-center gap-2"
            >
              <Check size={18} />
              Yes, Match This
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchingConfirmationModal;
```

**Step 2: Commit**

```bash
git add components/MatchingConfirmationModal.tsx
git commit -m "feat: add matching confirmation modal

- Create modal to confirm scheduled transaction matches
- Display scheduled vs actual transaction details
- Show match confidence score with visual bar
- Calculate and display delay (early/late/on-time)
- Provide clear confirm/reject actions

🤖 Generated with Claude Code"
```

---

### Task 11: Create Reconciliation Warning Component

**Files:**
- Create: `components/ReconciliationWarning.tsx`

**Step 1: Create reconciliation warning banner**

```typescript
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Account, Transaction } from '../types';
import { ReconciliationResult } from '../services/reconciliationService';

interface ReconciliationWarningProps {
  account: Account;
  result: ReconciliationResult;
  onAcceptCalculated: () => void;
  onManualAdjust: () => void;
  onReviewTransactions: () => void;
  onDismiss: () => void;
}

const ReconciliationWarning: React.FC<ReconciliationWarningProps> = ({
  account,
  result,
  onAcceptCalculated,
  onManualAdjust,
  onReviewTransactions,
  onDismiss,
}) => {
  const { currentBalance, expectedBalance, difference, lastSnapshot, severity } = result;

  // Severity colors
  const severityColors = {
    minor: 'bg-yellow-50 border-yellow-300 text-yellow-800',
    major: 'bg-orange-50 border-orange-300 text-orange-800',
    critical: 'bg-red-50 border-red-300 text-red-800',
    none: 'bg-gray-50 border-gray-300 text-gray-800',
  };

  const severityIcons = {
    minor: '⚠️',
    major: '⚠️',
    critical: '🚨',
    none: 'ℹ️',
  };

  return (
    <div className={`border-2 rounded-lg p-4 ${severityColors[severity]}`}>
      <div className="flex items-start gap-3">
        <div className="text-2xl">{severityIcons[severity]}</div>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <h3 className="font-bold text-lg">Balance Mismatch Detected</h3>
            {severity === 'minor' && (
              <button onClick={onDismiss} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            )}
          </div>

          <div className="mt-2 space-y-2">
            <div>
              <div className="font-semibold">Account: {account.name}</div>
              {account.last4Digits && (
                <div className="text-sm">({account.last4Digits})</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium">Current Balance:</div>
                <div className="text-lg font-bold">
                  {currentBalance.toFixed(2)} {account.currency}
                </div>
              </div>
              <div>
                <div className="font-medium">Expected Balance:</div>
                <div className="text-lg font-bold">
                  {expectedBalance.toFixed(2)} {account.currency}
                </div>
              </div>
            </div>

            <div className="bg-white bg-opacity-50 rounded p-2">
              <div className="font-semibold">
                {severity === 'critical' ? '🚨' : '⚠️'} Difference: {difference.toFixed(2)} {account.currency}
              </div>
              {lastSnapshot && (
                <div className="text-sm mt-1">
                  Last verified: {new Date(lastSnapshot.date).toLocaleDateString()}
                </div>
              )}
            </div>

            <div className="text-sm">
              <div className="font-medium mb-1">Possible Causes:</div>
              <ul className="list-disc list-inside space-y-1">
                <li>Missing transaction since {lastSnapshot ? new Date(lastSnapshot.date).toLocaleDateString() : 'last update'}</li>
                <li>Edited or deleted transaction</li>
                <li>Bank fee not recorded</li>
                <li>Manual balance adjustment needed</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={onReviewTransactions}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Review Transactions
            </button>
            <button
              onClick={onAcceptCalculated}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
            >
              Accept Calculated ({expectedBalance.toFixed(2)})
            </button>
            <button
              onClick={onManualAdjust}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
            >
              Manually Adjust Balance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReconciliationWarning;
```

**Step 2: Commit**

```bash
git add components/ReconciliationWarning.tsx
git commit -m "feat: add reconciliation warning component

- Create prominent warning banner for balance mismatches
- Display current vs expected balance comparison
- Show severity levels (minor/major/critical) with colors
- List possible causes for discrepancy
- Provide actions: review, accept calculated, manual adjust

🤖 Generated with Claude Code"
```

---

## Phase 4: Integration

### Task 12: Update Dashboard Component

**Files:**
- Modify: `components/Dashboard.tsx`

**Step 1: Add imports for reconciliation and scheduled transactions**

Add to imports at top:
```typescript
import { ScheduledTransaction } from '../types';
import { checkAllAccounts, ReconciliationResult } from '../services/reconciliationService';
import { getByStatus, getUpcoming } from '../services/scheduledTransactionsService';
import ReconciliationWarning from './ReconciliationWarning';
```

**Step 2: Update DashboardProps interface**

Find the DashboardProps interface and add:
```typescript
interface DashboardProps {
  transactions: Transaction[];
  accounts: Account[];
  baseCurrency: string;
  dateFilter: 'month' | 'year' | 'week' | 'custom' | 'all';
  onDateFilterChange: (filter: 'month' | 'year' | 'week' | 'custom' | 'all') => void;
  customStartDate: string;
  customEndDate: string;
  onCustomStartDateChange: (date: string) => void;
  onCustomEndDateChange: (date: string) => void;
  onPreviousPeriod: () => void;
  onNextPeriod: () => void;
  currentPeriodLabel: string;
  gradientStartColor?: string;
  gradientEndColor?: string;
  gradientAngle?: number;
  // ADD THESE:
  onAcceptCalculatedBalance?: (accountId: string, newBalance: number) => void;
  onManualAdjustBalance?: (accountId: string) => void;
  onViewBills?: () => void;
}
```

**Step 3: Add state for reconciliation and scheduled transactions**

Add inside Dashboard component (after existing state):
```typescript
const [reconciliationIssues, setReconciliationIssues] = useState<Map<string, ReconciliationResult>>(new Map());
const [overdueCount, setOverdueCount] = useState(0);
const [upcomingBills, setUpcomingBills] = useState<ScheduledTransaction[]>([]);

useEffect(() => {
  checkReconciliation();
  loadScheduledData();
}, [accounts, transactions]);

const checkReconciliation = () => {
  const issues = checkAllAccounts(accounts, transactions);
  setReconciliationIssues(issues);
};

const loadScheduledData = async () => {
  try {
    const overdue = await getByStatus('OVERDUE');
    setOverdueCount(overdue.length);

    const upcoming = await getUpcoming(7); // Next 7 days
    setUpcomingBills(upcoming);
  } catch (error) {
    console.error('Error loading scheduled data:', error);
  }
};
```

**Step 4: Add reconciliation warnings section**

Add at the beginning of the return statement (before Summary Cards):
```typescript
{/* Reconciliation Warnings */}
{reconciliationIssues.size > 0 && (
  <div className="space-y-3 mb-6">
    {Array.from(reconciliationIssues.entries()).map(([accountId, result]) => {
      const account = accounts.find(a => a.id === accountId);
      if (!account) return null;

      return (
        <ReconciliationWarning
          key={accountId}
          account={account}
          result={result}
          onAcceptCalculated={() => {
            if (onAcceptCalculatedBalance) {
              onAcceptCalculatedBalance(accountId, result.expectedBalance);
              checkReconciliation();
            }
          }}
          onManualAdjust={() => {
            if (onManualAdjustBalance) {
              onManualAdjustBalance(accountId);
            }
          }}
          onReviewTransactions={() => {
            // Navigate to history filtered by this account
            // Implementation depends on navigation structure
          }}
          onDismiss={() => {
            const newIssues = new Map(reconciliationIssues);
            newIssues.delete(accountId);
            setReconciliationIssues(newIssues);
          }}
        />
      );
    })}
  </div>
)}

{/* Overdue Bills Alert */}
{overdueCount > 0 && (
  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-6">
    <div className="flex items-center gap-3">
      <div className="text-2xl">🚨</div>
      <div className="flex-1">
        <h3 className="font-bold text-red-800">Overdue Bills ({overdueCount})</h3>
        <p className="text-sm text-red-700 mt-1">
          You have {overdueCount} overdue bill{overdueCount > 1 ? 's' : ''} that need attention
        </p>
      </div>
      <button
        onClick={onViewBills}
        className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600"
      >
        View Bills
      </button>
    </div>
  </div>
)}

{/* Upcoming Bills (Next 7 Days) */}
{upcomingBills.length > 0 && (
  <div className="mb-6">
    <div className="flex justify-between items-center mb-3">
      <h2 className="text-lg font-bold text-gray-900">📅 Upcoming Bills (Next 7 Days)</h2>
      {onViewBills && (
        <button
          onClick={onViewBills}
          className="text-sm text-brand-600 hover:text-brand-700 font-medium"
        >
          View All →
        </button>
      )}
    </div>
    <div className="space-y-2">
      {upcomingBills.slice(0, 3).map(bill => (
        <div key={bill.id} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-semibold text-gray-900">{bill.merchant}</div>
              <div className="text-sm text-gray-600">
                {new Date(bill.dueDate).toLocaleDateString()}
              </div>
            </div>
            <div className="text-lg font-bold text-gray-900">
              {bill.amount} {bill.currency}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

{/* Loan Accounts Summary */}
{accounts.filter(a => a.type === 'Loan/BNPL').length > 0 && (
  <div className="mb-6">
    <h2 className="text-lg font-bold text-gray-900 mb-3">💰 Loan Accounts</h2>
    <div className="space-y-2">
      {accounts
        .filter(a => a.type === 'Loan/BNPL')
        .map(account => {
          const principal = account.loanPrincipal || 0;
          const paid = principal + account.balance;
          const progress = (paid / principal) * 100;
          const nextPayment = upcomingBills.find(b => b.accountId === account.id);

          return (
            <div key={account.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="font-semibold text-gray-900">{account.name}</div>
              <div className="text-sm text-gray-600 mt-1">
                {paid.toFixed(2)} / {principal} {account.currency} paid
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {nextPayment && (
                <div className="text-sm text-blue-700 mt-2">
                  Next: {new Date(nextPayment.dueDate).toLocaleDateString()} - {nextPayment.amount} {nextPayment.currency}
                </div>
              )}
            </div>
          );
        })}
    </div>
  </div>
)}
```

**Step 5: Commit**

```bash
git add components/Dashboard.tsx
git commit -m "feat: integrate reconciliation and bills into Dashboard

- Add reconciliation warnings at top of dashboard
- Display overdue bills alert with count
- Show upcoming bills (next 7 days) section
- Add loan accounts summary with progress bars
- Support actions for balance reconciliation
- Auto-check reconciliation on data changes

🤖 Generated with Claude Code"
```

---

### Task 13: Update App.tsx - Add State and Handlers

**Files:**
- Modify: `App.tsx`

**Step 1: Add imports**

Add to imports (around line 18):
```typescript
import BillsDebtsView from './components/BillsDebtsView';
import ScheduledTransactionForm from './components/ScheduledTransactionForm';
import BatchChequeCreator from './components/BatchChequeCreator';
import MatchingConfirmationModal from './components/MatchingConfirmationModal';
import { ScheduledTransaction } from './types';
import {
  createScheduledTransaction,
  updateScheduledTransaction,
  markAsPaid,
  markAsSkipped,
} from './services/scheduledTransactionsService';
import { createBatchCheques } from './services/batchChequeService';
import { getBestMatch } from './services/matchingService';
import {
  getAllScheduledTransactions,
  saveScheduledTransaction,
} from './services/indexedDBService';
```

**Step 2: Add state for scheduled transactions and modals**

Add after existing state declarations (around line 82):
```typescript
const [scheduledTransactions, setScheduledTransactions] = useState<ScheduledTransaction[]>([]);
const [showScheduledForm, setShowScheduledForm] = useState(false);
const [showBatchChequeCreator, setShowBatchChequeCreator] = useState(false);
const [matchingCandidate, setMatchingCandidate] = useState<{
  transaction: Transaction;
  scheduledTransaction: ScheduledTransaction;
  score: number;
  reasons: string[];
} | null>(null);
```

**Step 3: Update loadUserData to load scheduled transactions**

Find the `loadUserData` function and add after loading warranties:
```typescript
const loadUserData = async () => {
  try {
    // ... existing code ...

    const [
      txData,
      accData,
      catData,
      rulesData,
      warData,
      baseCurrencyData,
      gradientStart,
      gradientEnd,
      gradAngle,
      scheduledData, // ADD THIS
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
      getAllScheduledTransactions(), // ADD THIS
    ]);

    // ... existing code ...

    setScheduledTransactions(scheduledData || []); // ADD THIS

    // ... rest of function ...
  } catch (error) {
    console.error('Error loading user data:', error);
  }
};
```

**Step 4: Add handler for creating scheduled transaction**

Add after existing handlers:
```typescript
const handleCreateScheduledTransaction = async (data: Partial<ScheduledTransaction>) => {
  try {
    await createScheduledTransaction(data as any);
    await loadUserData();
    setShowScheduledForm(false);
  } catch (error) {
    console.error('Error creating scheduled transaction:', error);
    throw error;
  }
};

const handleCreateBatchCheques = async (data: {
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  accountId: string;
  firstChequeDate: string;
  frequency: 'MONTHLY' | 'WEEKLY' | 'CUSTOM';
  intervalValue: number;
  numberOfCheques: number;
  startingChequeNumber?: number;
  chequeImages?: string[];
}) => {
  try {
    await createBatchCheques(data);
    await loadUserData();
    setShowBatchChequeCreator(false);
  } catch (error) {
    console.error('Error creating batch cheques:', error);
    throw error;
  }
};

const handleMarkPaid = async (scheduledTx: ScheduledTransaction) => {
  // Open add transaction with pre-filled data
  // This will trigger smart matching automatically
  setCurrentView('add');
  // Note: AddTransaction component will need to support pre-filled data
};

const handleSkipScheduled = async (scheduledTx: ScheduledTransaction) => {
  try {
    const reason = prompt('Reason for skipping (optional):');
    await markAsSkipped(scheduledTx.id, reason || undefined);
    await loadUserData();
  } catch (error) {
    console.error('Error skipping scheduled transaction:', error);
  }
};

const handleAcceptCalculatedBalance = async (accountId: string, newBalance: number) => {
  try {
    const account = settings.accounts.find(a => a.id === accountId);
    if (!account) return;

    const updatedAccount = { ...account, balance: newBalance };
    await saveAccount(updatedAccount);
    await loadUserData();
  } catch (error) {
    console.error('Error accepting calculated balance:', error);
  }
};
```

**Step 5: Update handleAddTransactions to include smart matching**

Find `handleAddTransactions` and wrap the transaction saving logic:
```typescript
const handleAddTransactions = async (newTransactions: Transaction[]) => {
  try {
    // Check for matches before saving
    for (const tx of newTransactions) {
      const match = await getBestMatch(tx);
      if (match) {
        // Show matching confirmation
        setMatchingCandidate({
          transaction: tx,
          scheduledTransaction: match.scheduledTransaction,
          score: match.score,
          reasons: match.reasons,
        });
        // Wait for user confirmation before proceeding
        return; // Exit early, will continue after user confirms/rejects
      }
    }

    // No matches found, proceed with normal flow
    await saveTransactionsNormally(newTransactions);
  } catch (error) {
    console.error('Error adding transactions:', error);
  }
};

const saveTransactionsNormally = async (newTransactions: Transaction[]) => {
  // ... existing transaction saving logic ...
  // Move the current handleAddTransactions body here
};

const handleConfirmMatch = async () => {
  if (!matchingCandidate) return;

  try {
    // Save the transaction
    await saveTransaction(matchingCandidate.transaction);

    // Mark scheduled transaction as paid
    await markAsPaid(
      matchingCandidate.scheduledTransaction.id,
      matchingCandidate.transaction.id,
      matchingCandidate.transaction.date
    );

    // Update account balance
    const account = settings.accounts.find(
      a => a.id === matchingCandidate.transaction.accountId
    );
    if (account) {
      // ... balance update logic ...
    }

    setMatchingCandidate(null);
    await loadUserData();
    setCurrentView('dashboard');
  } catch (error) {
    console.error('Error confirming match:', error);
  }
};

const handleRejectMatch = async () => {
  if (!matchingCandidate) return;

  // Save transaction without matching
  await saveTransactionsNormally([matchingCandidate.transaction]);
  setMatchingCandidate(null);
};
```

**Step 6: Commit**

```bash
git add App.tsx
git commit -m "feat: add scheduled transactions state and handlers to App

- Add state for scheduled transactions and modals
- Load scheduled transactions in loadUserData
- Add handlers for creating scheduled transactions
- Add batch cheque creation handler
- Implement smart matching in handleAddTransactions
- Add match confirmation/rejection handlers
- Add balance reconciliation acceptance handler

🤖 Generated with Claude Code"
```

---

### Task 14: Update App.tsx - Add View Rendering

**Files:**
- Modify: `App.tsx`

**Step 1: Add Bills view to View type check**

The View type is already updated in types.ts to include 'bills'.

**Step 2: Add BillsDebtsView rendering**

Find the view rendering section (around line 600+) and add:
```typescript
{currentView === 'bills' && (
  <BillsDebtsView
    accounts={settings.accounts}
    onCreateScheduled={() => setShowScheduledForm(true)}
    onCreateBatchCheques={() => setShowBatchChequeCreator(true)}
    onMarkPaid={handleMarkPaid}
    onSkip={handleSkipScheduled}
    onViewScheduled={(st) => {
      // Open details modal (can be implemented later)
      console.log('View scheduled transaction:', st);
    }}
  />
)}
```

**Step 3: Add modals at the end of JSX (before closing main div)**

Add before the final closing tags:
```typescript
{/* Scheduled Transaction Form */}
{showScheduledForm && (
  <ScheduledTransactionForm
    onClose={() => setShowScheduledForm(false)}
    onSave={handleCreateScheduledTransaction}
    accounts={settings.accounts}
    categories={settings.categories}
  />
)}

{/* Batch Cheque Creator */}
{showBatchChequeCreator && (
  <BatchChequeCreator
    onClose={() => setShowBatchChequeCreator(false)}
    onSave={handleCreateBatchCheques}
    accounts={settings.accounts}
    categories={settings.categories}
  />
)}

{/* Matching Confirmation */}
{matchingCandidate && (
  <MatchingConfirmationModal
    transaction={matchingCandidate.transaction}
    scheduledTransaction={matchingCandidate.scheduledTransaction}
    score={matchingCandidate.score}
    reasons={matchingCandidate.reasons}
    onConfirm={handleConfirmMatch}
    onReject={handleRejectMatch}
  />
)}
```

**Step 4: Update Dashboard props**

Find where Dashboard is rendered and add new props:
```typescript
{currentView === 'dashboard' && (
  <Dashboard
    transactions={filteredTransactions}
    accounts={settings.accounts}
    baseCurrency={settings.baseCurrency}
    dateFilter={dateFilter}
    onDateFilterChange={setDateFilter}
    customStartDate={customStartDate}
    customEndDate={customEndDate}
    onCustomStartDateChange={setCustomStartDate}
    onCustomEndDateChange={setCustomEndDate}
    onPreviousPeriod={handlePreviousPeriod}
    onNextPeriod={handleNextPeriod}
    currentPeriodLabel={currentPeriodLabel}
    gradientStartColor={settings.gradientStartColor}
    gradientEndColor={settings.gradientEndColor}
    gradientAngle={settings.gradientAngle}
    // ADD THESE:
    onAcceptCalculatedBalance={handleAcceptCalculatedBalance}
    onManualAdjustBalance={(accountId) => {
      // Navigate to accounts view for manual adjustment
      setCurrentView('accounts');
      setSelectedAccountId(accountId);
    }}
    onViewBills={() => setCurrentView('bills')}
  />
)}
```

**Step 5: Commit**

```bash
git add App.tsx
git commit -m "feat: add Bills & Debts view rendering and modals

- Add BillsDebtsView to view routing
- Render ScheduledTransactionForm modal
- Render BatchChequeCreator modal
- Render MatchingConfirmationModal
- Update Dashboard with new props for reconciliation and bills
- Wire up navigation to Bills view

🤖 Generated with Claude Code"
```

---

### Task 15: Update Navigation

**Files:**
- Modify: `components/BottomTabs.tsx` OR `components/NavigationDrawer.tsx` (depending on which is being used)

**Step 1: Check which navigation component is active**

Read both files to determine which one is currently used in App.tsx.

**Step 2: Add Bills icon import**

Add to imports:
```typescript
import { Receipt } from 'lucide-react'; // or FileText or Calendar
```

**Step 3: Add Bills tab/item**

For BottomTabs.tsx, add:
```typescript
const tabs: Array<{ id: View; icon: any; label: string }> = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'add', icon: PlusCircle, label: 'Add' },
  { id: 'bills', icon: Receipt, label: 'Bills' }, // ADD THIS
  { id: 'history', icon: History, label: 'History' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];
```

OR for NavigationDrawer.tsx/RadialNavigation, add to menu items.

**Step 4: Add badge for overdue count**

If using BottomTabs, add badge support:
```typescript
interface BottomTabsProps {
  currentView: View;
  onViewChange: (view: View) => void;
  overdueCount?: number; // ADD THIS
}

// In the bills tab rendering:
<button ...>
  <Icon size={24} />
  {overdueCount > 0 && id === 'bills' && (
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
      {overdueCount}
    </span>
  )}
  <span className="text-xs mt-1">{label}</span>
</button>
```

**Step 5: Update App.tsx to pass overdueCount**

Find where BottomTabs is rendered and add:
```typescript
<BottomTabs
  currentView={currentView}
  onViewChange={setCurrentView}
  overdueCount={overdueCount} // ADD THIS (need to add state for overdueCount)
/>
```

Add state in App.tsx:
```typescript
const [overdueCount, setOverdueCount] = useState(0);

// In loadUserData or useEffect:
useEffect(() => {
  const loadOverdueCount = async () => {
    const overdue = await getByStatus('OVERDUE');
    setOverdueCount(overdue.length);
  };
  if (session?.user) {
    loadOverdueCount();
  }
}, [session, scheduledTransactions]);
```

**Step 6: Commit**

```bash
git add components/BottomTabs.tsx App.tsx
git commit -m "feat: add Bills & Debts to navigation

- Add Bills tab to bottom navigation
- Include Receipt icon for Bills view
- Add red badge showing overdue count
- Auto-update overdue count on data changes

🤖 Generated with Claude Code"
```

---

## Phase 5: Account Creation Enhancement

### Task 16: Update SettingsView for Loan Account Creation

**Files:**
- Modify: `components/SettingsView.tsx`

**Step 1: Find account creation form**

Locate the account creation/edit section in SettingsView.

**Step 2: Add loan-specific fields**

Add conditional fields that show when account type is 'Loan/BNPL':
```typescript
{/* Account Type Selection */}
<select
  value={newAccount.type}
  onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value as AccountType })}
  className="..."
>
  <option value="Bank">Bank</option>
  <option value="Credit Card">Credit Card</option>
  <option value="Cash">Cash</option>
  <option value="Wallet">Wallet</option>
  <option value="Loan/BNPL">Loan/BNPL</option>
  <option value="Other">Other</option>
</select>

{/* Loan-Specific Fields */}
{newAccount.type === 'Loan/BNPL' && (
  <div className="space-y-4 bg-blue-50 rounded-lg p-4 mt-4">
    <h4 className="font-semibold text-gray-900">💰 Loan Details</h4>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Principal Amount *
      </label>
      <input
        type="number"
        step="0.01"
        value={newAccount.loanPrincipal || ''}
        onChange={(e) => setNewAccount({
          ...newAccount,
          loanPrincipal: parseFloat(e.target.value) || 0,
          balance: -(parseFloat(e.target.value) || 0), // Set initial balance as negative
        })}
        className="w-full border border-gray-300 rounded-lg px-3 py-2"
        placeholder="3000.00"
        required
      />
      <p className="text-xs text-gray-500 mt-1">
        Total amount borrowed (will be set as initial debt)
      </p>
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Number of Installments *
      </label>
      <input
        type="number"
        min="1"
        value={newAccount.loanInstallments || ''}
        onChange={(e) => setNewAccount({
          ...newAccount,
          loanInstallments: parseInt(e.target.value) || 0,
        })}
        className="w-full border border-gray-300 rounded-lg px-3 py-2"
        placeholder="4"
        required
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        First Payment Date *
      </label>
      <input
        type="date"
        value={newAccount.loanStartDate || ''}
        onChange={(e) => setNewAccount({
          ...newAccount,
          loanStartDate: e.target.value,
        })}
        className="w-full border border-gray-300 rounded-lg px-3 py-2"
        required
      />
    </div>

    <div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={autoCreateInstallments}
          onChange={(e) => setAutoCreateInstallments(e.target.checked)}
        />
        <span className="text-sm font-medium text-gray-700">
          Auto-create scheduled installments
        </span>
      </label>
      <p className="text-xs text-gray-500 ml-6">
        Automatically create {newAccount.loanInstallments || 0} scheduled transactions
      </p>
    </div>
  </div>
)}
```

**Step 3: Add state for auto-create installments**

Add state:
```typescript
const [autoCreateInstallments, setAutoCreateInstallments] = useState(true);
```

**Step 4: Update account save handler**

Modify the save handler to create scheduled installments if checkbox is checked:
```typescript
const handleSaveAccount = async () => {
  try {
    await saveAccount(newAccount);

    // If loan account and auto-create is enabled
    if (newAccount.type === 'Loan/BNPL' && autoCreateInstallments && newAccount.loanInstallments) {
      const installmentAmount = (newAccount.loanPrincipal || 0) / newAccount.loanInstallments;

      // Create scheduled transactions for each installment
      for (let i = 0; i < newAccount.loanInstallments; i++) {
        const dueDate = new Date(newAccount.loanStartDate!);
        dueDate.setMonth(dueDate.getMonth() + i);

        await createScheduledTransaction({
          merchant: `${newAccount.name} - Installment #${i + 1}`,
          amount: installmentAmount,
          currency: newAccount.currency,
          category: 'Debt Payment', // Or another appropriate category
          type: TransactionType.EXPENSE,
          accountId: newAccount.id,
          dueDate: dueDate.toISOString().split('T')[0],
          recurrencePattern: 'ONCE',
        });
      }
    }

    // Reset form and reload data
    setEditingAccountId(null);
    setNewAccount({ /* default values */ });
    setAutoCreateInstallments(true);
    await loadUserData();
  } catch (error) {
    console.error('Error saving account:', error);
  }
};
```

**Step 5: Commit**

```bash
git add components/SettingsView.tsx
git commit -m "feat: add Loan/BNPL account creation with auto-installments

- Add Loan/BNPL to account type dropdown
- Add loan-specific fields (principal, installments, start date)
- Set initial balance as negative (debt) for loan accounts
- Add checkbox to auto-create scheduled installments
- Generate scheduled transactions for each installment on save
- Calculate installment amount from principal

🤖 Generated with Claude Code"
```

---

## Phase 6: Testing & Verification

### Task 17: Manual Testing Checklist

**No files to modify - this is a testing task**

**Step 1: Test scheduled transaction creation**

1. Open app and navigate to Bills & Debts view
2. Click "New Scheduled"
3. Fill in form: Merchant "Electricity Bill", Amount 450, Due Date (future), Category "Utilities"
4. Save and verify it appears in Upcoming section
5. Verify it persists after page refresh

**Step 2: Test batch cheque creation**

1. Navigate to Bills & Debts
2. Click "Batch Cheques"
3. Fill: Merchant "Rent", Amount 7000, First Date (next month), Frequency "Every 2 months", Number 6
4. Preview dates and verify they're correct
5. Optionally scan images with camera
6. Create and verify all 6 cheques appear
7. Verify they're grouped in Cheque Series section

**Step 3: Test smart matching**

1. Create a scheduled transaction for "Salary" 12000 AED, due tomorrow
2. Go to Add Transaction
3. Paste SMS text for salary payment with similar amount
4. Verify matching modal appears
5. Confirm match and verify:
   - Transaction is created
   - Scheduled transaction status changes to PAID
   - Both appear correctly in history

**Step 4: Test loan account**

1. Go to Settings → Accounts
2. Create new Loan/BNPL account: "Tamara iPhone", Principal 3000, 4 installments, start next month
3. Check "Auto-create installments"
4. Save and verify:
   - Account appears with -3000 balance
   - 4 scheduled transactions created
   - Shows in Bills view and Dashboard

**Step 5: Test balance reconciliation**

1. Find an account with recent SMS transactions (with balance snapshots)
2. Delete one transaction from history
3. Navigate to Dashboard
4. Verify reconciliation warning appears
5. Click "Accept Calculated Balance"
6. Verify warning disappears and balance is corrected

**Step 6: Test overdue status**

1. Create scheduled transaction with due date in the past
2. Refresh app or wait for auto-update
3. Verify it appears in Overdue section with red styling
4. Verify red badge appears on Bills navigation tab
5. Test "Mark Paid" and "Skip" actions

**Step 7: Test navigation and badges**

1. Verify Bills tab appears in navigation
2. Create overdue items and verify badge count
3. Navigate between views and verify Bills view loads correctly
4. Verify Dashboard shows overdue alert if items exist

**Step 8: Commit testing notes**

```bash
git add docs/plans/2025-12-30-bills-debts-loans-implementation.md
git commit -m "test: complete manual testing of Bills, Debts & Loans feature

Tested:
- ✅ Scheduled transaction creation and persistence
- ✅ Batch cheque creator with date preview
- ✅ Smart matching with confirmation modal
- ✅ Loan account creation with auto-installments
- ✅ Balance reconciliation warnings and acceptance
- ✅ Overdue status updates and navigation badges
- ✅ All UI components render correctly

🤖 Generated with Claude Code"
```

---

## Phase 7: Documentation & Cleanup

### Task 18: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add Bills & Debts section**

Add new section after WarrantiesView documentation:
```markdown
## Bills, Debts & Loans Feature

### Overview
Comprehensive scheduled transaction management, loan/BNPL tracking, balance reconciliation, and postdated cheque tracking.

### Key Components
- **BillsDebtsView.tsx**: Main view showing overdue, upcoming, cheque series, and loan accounts
- **ScheduledTransactionForm.tsx**: Create/edit single scheduled transactions
- **BatchChequeCreator.tsx**: Create series of cheques with dates and images
- **MatchingConfirmationModal.tsx**: Confirm smart matches between actual and scheduled transactions
- **ReconciliationWarning.tsx**: Prominent warning for balance discrepancies

### Services
- **scheduledTransactionsService.ts**: CRUD operations, status updates, queries
- **batchChequeService.ts**: Batch cheque creation with date calculations
- **matchingService.ts**: Smart matching algorithm with scoring
- **reconciliationService.ts**: Balance reconciliation using snapshots

### Data Flow
1. **Scheduled Creation** → User creates scheduled transaction or batch cheques → Stored in IndexedDB
2. **Smart Matching** → New transaction triggers match search → Shows confirmation if score ≥ 150
3. **Status Updates** → Matched = PAID, Skipped = SKIPPED, Past due = OVERDUE
4. **Reconciliation** → After edit/delete → Check vs snapshots → Show warning if mismatch

### Loan Account Flow
1. Create Loan/BNPL account with principal, installments, start date
2. Initial balance set to -principal (negative = debt)
3. Auto-create scheduled installments if enabled
4. As installments paid → Balance increases toward 0
5. Dashboard shows progress with visual bars

### Important Notes
- Scheduled transactions NEVER affect balance directly (only matched actual transactions do)
- For cheques: Balance changes on cleared_date, not due_date
- Reconciliation uses latest snapshot + delta to calculate expected balance
- Matching algorithm: Amount (100pts) + Merchant (100pts) + Date (50pts) + Account (50pts)
```

**Step 2: Update View type documentation**

Update the View section:
```markdown
**Supported Views**: `'dashboard' | 'accounts' | 'categories' | 'add' | 'history' | 'settings' | 'calendar' | 'planning' | 'warranties' | 'bills'`
```

**Step 3: Update AccountType documentation**

```markdown
**Supported Account Types**: `'Bank' | 'Credit Card' | 'Cash' | 'Wallet' | 'Loan/BNPL' | 'Other'`
```

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with Bills, Debts & Loans feature

- Add comprehensive Bills & Debts section
- Document key components and services
- Explain data flow and loan account flow
- Add important implementation notes
- Update View and AccountType documentation

🤖 Generated with Claude Code"
```

---

### Task 19: Create Feature Summary Document

**Files:**
- Create: `docs/BILLS_DEBTS_LOANS.md`

**Step 1: Create feature documentation**

```markdown
# Bills, Debts & Loans Feature

## Overview
Complete scheduled transaction management system with smart matching, loan tracking, and balance reconciliation.

## Features

### 1. Scheduled Transactions
- Create one-time or recurring scheduled transactions (bills, salary, etc.)
- Auto-detect overdue items
- Mark as paid or skipped with notes
- View upcoming bills (next 30 days)

### 2. Batch Cheque Creator
- Create series of postdated cheques
- Flexible frequency: monthly, weekly, custom interval
- Preview dates before creation
- Scan cheque images using camera (optional)
- Auto-numbering with custom starting number
- Group by series for easy management

### 3. Smart Matching
- Automatically find scheduled transaction matches when adding transactions
- Scoring algorithm considers:
  - Amount match (exact, ±5%, ±10%)
  - Merchant match (exact, keyword, fuzzy)
  - Date proximity (same day, ±7 days, ±30 days)
  - Account match
- Show confirmation modal with match confidence
- Preserve both due date and cleared date

### 4. Loan/BNPL Accounts
- Dedicated account type for Tamara, Tabby, and other loans
- Track principal, installments, and payment schedule
- Auto-create scheduled installments on account creation
- Visual progress bars showing debt paydown
- Dashboard integration with next payment display

### 5. Balance Reconciliation
- Use SMS balance snapshots as "truth checkpoints"
- Calculate expected balance from last snapshot + delta
- Detect discrepancies with severity levels (minor/major/critical)
- Prominent warnings on Dashboard
- Actions: Accept calculated, Manual adjust, Review transactions
- Threshold: 5% or 100 AED difference

## User Scenarios

### Scenario 1: Rent Cheques
1. Click "Batch Cheques" in Bills view
2. Enter: Merchant "Rent - Landlord", Amount 7000, Account, Category
3. Set First Date to Jan 1, Frequency "Every 2 months", Number 6
4. Optionally scan 6 cheque images
5. Creates 6 scheduled cheques (Jan, Mar, May, Jul, Sep, Nov)
6. When landlord cashes cheque (e.g., Jan 15), SMS triggers:
   - Smart match finds Jan 1 cheque
   - Shows confirmation: "14 days late"
   - User confirms → Transaction created, cheque marked PAID
   - Balance only changes on Jan 15, not Jan 1

### Scenario 2: Tamara Purchase
1. Settings → Accounts → Create New
2. Type: Loan/BNPL, Name "Tamara iPhone"
3. Principal: 3000, Installments: 4, Start Date: Feb 1
4. Check "Auto-create installments" → Save
5. Result:
   - Account created with -3000 balance
   - 4 scheduled transactions (Feb 1, Mar 1, Apr 1, May 1) @ 750 each
   - Shows in Dashboard loan section
6. When Tamara SMS arrives:
   - Smart match recognizes installment
   - Transaction created, balance → -2250
   - Progress bar updates: 25% paid

### Scenario 3: Balance Discrepancy
1. Delete old transaction accidentally
2. Dashboard shows: "⚠️ BALANCE MISMATCH DETECTED"
3. Warning displays:
   - Current: -12,450 AED
   - Expected: -11,850 AED
   - Difference: -600 AED
   - Last verified: Dec 25
4. Click "Accept Calculated (-11,850)" → Balance corrected

## Technical Implementation

### Database Schema (IndexedDB)
```typescript
scheduled_transactions: {
  id, amount, currency, merchant, category, type, accountId,
  dueDate, recurrencePattern, recurrenceInterval,
  status, matchedTransactionId, clearedDate,
  isCheque, chequeNumber, chequeImage, seriesId, notes
}
```

### Services
- `scheduledTransactionsService`: CRUD, status management
- `batchChequeService`: Date calculations, batch creation
- `matchingService`: Scoring algorithm, fuzzy matching
- `reconciliationService`: Snapshot-based balance checking

### Components
- `BillsDebtsView`: Main view with sections
- `ScheduledTransactionForm`: Create/edit single scheduled transaction
- `BatchChequeCreator`: Batch cheque wizard
- `MatchingConfirmationModal`: Match confirmation with score
- `ReconciliationWarning`: Prominent balance warning

## Usage Tips

1. **Create scheduled transactions for recurring bills** to never miss payments
2. **Use batch cheque creator for rent** to track all postdated cheques at once
3. **Scan cheque images** to have visual proof (included in backups)
4. **Smart matching reduces duplicates** - always check suggestions
5. **Balance reconciliation catches errors** - address warnings promptly
6. **Loan accounts show progress** - track debt paydown visually

## Future Enhancements
- Push notifications for upcoming/overdue bills
- Payment links integration (Tamara/Tabby APIs)
- Spending forecast based on scheduled transactions
- Auto-categorization learning from matches
- More complex recurrence patterns
```

**Step 2: Commit**

```bash
git add docs/BILLS_DEBTS_LOANS.md
git commit -m "docs: create comprehensive Bills, Debts & Loans feature guide

- Document all features and capabilities
- Provide detailed user scenarios
- Include technical implementation details
- Add usage tips and best practices
- List future enhancement ideas

🤖 Generated with Claude Code"
```

---

### Task 20: Final Review and Merge

**No files to modify - final review task**

**Step 1: Review all changes**

```bash
git log --oneline feature/bills-debts-loans
```

Verify all commits are present and properly formatted.

**Step 2: Run final tests**

1. Test all user scenarios from documentation
2. Verify no console errors
3. Test on different screen sizes (mobile)
4. Verify data persists across refreshes
5. Test IndexedDB migration (DB version 2)

**Step 3: Merge to main**

```bash
git checkout main
git merge feature/bills-debts-loans
git push origin main
```

**Step 4: Create summary commit**

```bash
git commit --allow-empty -m "feat: complete Bills, Debts & Loans feature implementation

Major Features:
✅ Scheduled transactions with smart matching
✅ Batch cheque creator with image scanning
✅ Loan/BNPL account type with auto-installments
✅ Balance reconciliation with snapshot validation
✅ Bills & Debts view with overdue alerts
✅ Dashboard integration with warnings

Components: 5 new components (BillsDebtsView, ScheduledTransactionForm,
BatchChequeCreator, MatchingConfirmationModal, ReconciliationWarning)

Services: 4 new services (scheduledTransactions, batchCheque, matching,
reconciliation)

Database: IndexedDB v2 with scheduled_transactions store

Documentation: Updated CLAUDE.md + new BILLS_DEBTS_LOANS.md guide

Tested: All user scenarios validated, mobile-responsive, data persistence confirmed

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Execution Handoff

Plan complete and saved to `docs/plans/2025-12-30-bills-debts-loans-implementation.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach would you like?**
