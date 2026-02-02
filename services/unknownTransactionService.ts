import { Account, Category, Transaction, TransactionType } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Unknown Transaction Service
 * Handles creation of Unknown transactions for balance adjustments and AI balance discrepancies
 */

// System Unknown Category - Non-deletable
export const UNKNOWN_CATEGORY: Category = {
  id: 'unknown-category-system',
  name: 'Unknown',
  color: '#6B7280', // Gray-500
  icon: 'HelpCircle',
  isDefault: true,
  order: 9999 // Sort to end
};

/**
 * Ensures Unknown category exists in the categories list
 * If not found, adds it
 */
export function ensureUnknownCategory(categories: Category[]): Category[] {
  const existing = categories.find(c => c.id === UNKNOWN_CATEGORY.id);
  if (existing) {
    return categories;
  }

  return [...categories, UNKNOWN_CATEGORY];
}

/**
 * Creates an Unknown transaction for manual balance adjustments
 * @param accountId - Account being adjusted
 * @param oldBalance - Current balance before adjustment
 * @param newBalance - New balance after adjustment
 * @param account - Account object for currency and name
 * @returns Transaction object (without id)
 */
export function createUnknownTransaction(
  accountId: string,
  oldBalance: number,
  newBalance: number,
  account: Account
): Omit<Transaction, 'id'> {
  const difference = newBalance - oldBalance;
  const type = difference > 0 ? TransactionType.INCOME : TransactionType.EXPENSE;

  return {
    amount: Math.abs(difference),
    currency: account.currency,
    merchant: 'Manual Balance Adjustment',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    category: UNKNOWN_CATEGORY.name,
    type,
    accountId,
    account: account.name,
    parsedMeta: {
      availableBalance: newBalance // Snapshot the new balance
    },
    rawText: `Balance adjusted from ${account.currency} ${oldBalance.toFixed(2)} to ${account.currency} ${newBalance.toFixed(2)}`
  };
}

/**
 * Balance Difference Detection (Feature 3)
 */

export interface BalanceDifference {
  accountId: string;
  currentBalance: number;
  parsedBalance: number;
  difference: number;
  shouldCreate: boolean;
  isLatestTransaction: boolean;
}

/**
 * Checks if a transaction is the latest for its account (chronologically)
 */
export function isLatestTransactionForAccount(
  transaction: Transaction,
  allTransactions: Transaction[],
  accountId: string
): boolean {
  // Filter transactions for this account
  const accountTransactions = allTransactions.filter(tx => tx.accountId === accountId);

  if (accountTransactions.length === 0) {
    return true; // First transaction
  }

  // Compare dates and times
  const txDateTime = new Date(`${transaction.date}T${transaction.time || '00:00'}:00`);

  for (const otherTx of accountTransactions) {
    if (otherTx.id === transaction.id) continue; // Skip self

    const otherDateTime = new Date(`${otherTx.date}T${otherTx.time || '00:00'}:00`);

    if (otherDateTime > txDateTime) {
      return false; // Found a more recent transaction
    }
  }

  return true; // This is the latest
}

/**
 * Calculates expected balance after applying a transaction
 */
function calculateBalanceAfterTransaction(
  currentBalance: number,
  transaction: Transaction
): number {
  let expected = currentBalance;

  if (transaction.type === TransactionType.EXPENSE) {
    expected -= transaction.amount;
  } else if (transaction.type === TransactionType.INCOME) {
    expected += transaction.amount;
  }
  // TRANSFER transactions affect two accounts, handled separately

  return expected;
}

/**
 * Detects balance difference between parsed balance and calculated balance
 * Only triggers if transaction is the latest for the account
 *
 * @param parsedTransaction - Transaction with parsedMeta.availableBalance
 * @param currentAccountBalance - Current balance before transaction
 * @param allTransactions - All transactions for latest check
 * @returns BalanceDifference object or null if no action needed
 */
export function detectBalanceDifference(
  parsedTransaction: Transaction,
  currentAccountBalance: number,
  allTransactions: Transaction[]
): BalanceDifference | null {
  // Extract parsed balance from meta
  const parsedBalance = parsedTransaction.parsedMeta?.availableBalance;

  if (!parsedBalance || !parsedTransaction.accountId) {
    return null; // No parsed balance to compare
  }

  // Check if this is the latest transaction for the account
  const isLatest = isLatestTransactionForAccount(
    parsedTransaction,
    allTransactions,
    parsedTransaction.accountId
  );

  if (!isLatest) {
    return null; // Don't create Unknown for historical transactions
  }

  // Calculate expected balance after applying this transaction
  const expectedBalance = calculateBalanceAfterTransaction(
    currentAccountBalance,
    parsedTransaction
  );

  const difference = parsedBalance - expectedBalance;

  // Only create if difference > $0.01 (avoid floating point issues)
  if (Math.abs(difference) < 0.01) {
    return null;
  }

  return {
    accountId: parsedTransaction.accountId,
    currentBalance: expectedBalance,
    parsedBalance,
    difference,
    shouldCreate: true,
    isLatestTransaction: true
  };
}

/**
 * Creates an Unknown transaction for balance discrepancies detected by AI
 *
 * @param diff - BalanceDifference object
 * @param account - Account object
 * @param originalTransaction - The transaction that triggered the detection
 * @returns Unknown transaction object (without id)
 */
export function createBalanceDifferenceTransaction(
  diff: BalanceDifference,
  account: Account,
  originalTransaction: Transaction
): Omit<Transaction, 'id'> {
  const type = diff.difference > 0 ? TransactionType.INCOME : TransactionType.EXPENSE;

  return {
    amount: Math.abs(diff.difference),
    currency: account.currency,
    merchant: 'Balance Discrepancy Detected',
    date: originalTransaction.date, // Same date as original
    time: originalTransaction.time || new Date().toTimeString().slice(0, 5),
    category: UNKNOWN_CATEGORY.name,
    type,
    accountId: diff.accountId,
    account: account.name,
    parsedMeta: {
      availableBalance: diff.parsedBalance // Use the parsed balance
    },
    rawText: `Auto-created due to ${account.currency} ${Math.abs(diff.difference).toFixed(2)} difference between parsed balance (${diff.parsedBalance.toFixed(2)}) and calculated balance (${diff.currentBalance.toFixed(2)})`
  };
}

/**
 * Helper to check if a transaction is an Unknown transaction
 */
export function isUnknownTransaction(transaction: Transaction): boolean {
  return transaction.category === UNKNOWN_CATEGORY.name ||
         transaction.merchant === 'Manual Balance Adjustment' ||
         transaction.merchant === 'Balance Discrepancy Detected';
}

/**
 * Filters out Unknown transactions from a list (useful for analytics)
 */
export function filterUnknownTransactions(transactions: Transaction[], exclude: boolean = false): Transaction[] {
  if (exclude) {
    return transactions.filter(tx => !isUnknownTransaction(tx));
  }
  return transactions.filter(tx => isUnknownTransaction(tx));
}
