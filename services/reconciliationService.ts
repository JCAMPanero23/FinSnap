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
  // Use absolute value to handle negative balances (credit cards)
  const threshold = Math.max(100, Math.abs(account.balance) * 0.05); // 100 or 5%, whichever is larger
  const needsReconciliation = difference > threshold;

  // Determine severity
  let severity: ReconciliationResult['severity'] = 'none';
  if (needsReconciliation) {
    const percentDiff = account.balance === 0
      ? 100  // Treat any difference on zero balance as 100%
      : (difference / Math.abs(account.balance)) * 100;
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

  // Get all transactions after snapshot (excluding the snapshot itself)
  const snapshotDate = new Date(snapshot.date);
  const transactionsAfter = allTransactions
    .filter(t =>
      t.accountId === account.id &&
      new Date(t.date) >= snapshotDate &&
      t.id !== snapshot.id  // Exclude the snapshot transaction itself
    )
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
  // Group transactions by account once for better performance
  const txByAccount = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (tx.accountId) {
      if (!txByAccount.has(tx.accountId)) {
        txByAccount.set(tx.accountId, []);
      }
      txByAccount.get(tx.accountId)!.push(tx);
    }
  }

  const results = new Map<string, ReconciliationResult>();
  for (const account of accounts) {
    const accountTxs = txByAccount.get(account.id) || [];
    const result = checkReconciliation(account, accountTxs);
    if (result.needsReconciliation) {
      results.set(account.id, result);
    }
  }

  return results;
}
