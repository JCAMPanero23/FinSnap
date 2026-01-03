import { Account, ScheduledTransaction } from '../types';

export interface InsufficientFundsWarning {
  accountId: string;
  accountName: string;
  currentBalance: number;
  upcomingObligations: number;
  shortage: number;
  affectedCheques: ScheduledTransaction[];
  daysUntilFirst: number;
}

/**
 * Check if an account has insufficient funds for upcoming scheduled transactions
 * @param account The account to check
 * @param scheduledTransactions All scheduled transactions (will filter by account)
 * @param daysAhead Number of days to look ahead (default: 30)
 * @returns Warning object if insufficient funds, null otherwise
 */
export function checkInsufficientFunds(
  account: Account,
  scheduledTransactions: ScheduledTransaction[],
  daysAhead: number = 30
): InsufficientFundsWarning | null {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + daysAhead);

  // Filter upcoming pending transactions for this account
  const upcomingForAccount = scheduledTransactions.filter(st => {
    if (st.accountId !== account.id) return false;
    if (st.status !== 'PENDING') return false;

    const dueDate = new Date(st.dueDate);
    return dueDate >= today && dueDate <= futureDate;
  });

  if (upcomingForAccount.length === 0) {
    return null; // No upcoming obligations
  }

  // Calculate total upcoming obligations
  const totalObligations = upcomingForAccount.reduce((sum, st) => sum + st.amount, 0);

  // Check if there's a shortage
  const projectedBalance = account.balance - totalObligations;

  if (projectedBalance < 0) {
    // Sort by due date to find the first one
    const sortedByDate = [...upcomingForAccount].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const firstDue = new Date(sortedByDate[0].dueDate);
    const daysUntilFirst = Math.ceil((firstDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      accountId: account.id,
      accountName: account.name,
      currentBalance: account.balance,
      upcomingObligations: totalObligations,
      shortage: Math.abs(projectedBalance),
      affectedCheques: upcomingForAccount,
      daysUntilFirst,
    };
  }

  return null; // Sufficient funds
}

/**
 * Get all insufficient funds warnings across all accounts
 */
export function getAllInsufficientFundsWarnings(
  accounts: Account[],
  scheduledTransactions: ScheduledTransaction[],
  daysAhead: number = 30
): InsufficientFundsWarning[] {
  const warnings: InsufficientFundsWarning[] = [];

  for (const account of accounts) {
    const warning = checkInsufficientFunds(account, scheduledTransactions, daysAhead);
    if (warning) {
      warnings.push(warning);
    }
  }

  return warnings;
}
