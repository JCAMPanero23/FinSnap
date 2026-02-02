import { Transaction, ScheduledTransaction, TransactionType } from '../types';

/**
 * Cheque Pairing Service
 * Handles manual pairing of scheduled cheques with existing transactions
 */

export interface ChequePairingCandidate {
  transaction: Transaction;
  relevanceScore: number;
  reasons: string[];
}

export interface ChequePairingFilters {
  accountId: string;
  dueDate: string;
  amount: number;
  dayRange: number; // Default 30
}

/**
 * Finds transactions that could be paired with a scheduled cheque
 * Filters by: unpaired, same account, within date range
 */
export function findPairingCandidates(
  scheduledCheque: ScheduledTransaction,
  allTransactions: Transaction[],
  allScheduledTransactions: ScheduledTransaction[]
): ChequePairingCandidate[] {
  const chequeDate = new Date(scheduledCheque.dueDate);
  const minDate = new Date(chequeDate);
  minDate.setDate(minDate.getDate() - 30);
  const maxDate = new Date(chequeDate);
  maxDate.setDate(maxDate.getDate() + 30);

  const candidates = allTransactions.filter(tx => {
    // Must be unpaired (not referenced by any scheduled transaction)
    const isUnpaired = !isTransactionPaired(tx.id, allScheduledTransactions);

    // Must be same account
    const sameAccount = tx.accountId === scheduledCheque.accountId;

    // Must be within ±30 days
    const txDate = new Date(tx.date);
    const withinRange = txDate >= minDate && txDate <= maxDate;

    // Must be EXPENSE or OBLIGATION type
    const correctType = tx.type === TransactionType.EXPENSE ||
                       tx.type === TransactionType.OBLIGATION;

    return isUnpaired && sameAccount && withinRange && correctType;
  });

  // Score candidates by relevance
  return candidates.map(tx => {
    const scoreResult = scorePairingCandidate(tx, scheduledCheque);
    return {
      transaction: tx,
      relevanceScore: scoreResult.score,
      reasons: scoreResult.reasons
    };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Checks if a transaction is already paired to any scheduled transaction
 */
export function isTransactionPaired(
  transactionId: string,
  allScheduledTransactions: ScheduledTransaction[]
): boolean {
  return allScheduledTransactions.some(
    st => st.matchedTransactionId === transactionId
  );
}

/**
 * Scores a transaction's relevance to a scheduled cheque
 * Higher score = better match
 */
function scorePairingCandidate(
  tx: Transaction,
  cheque: ScheduledTransaction
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Amount matching (most important)
  const amountDiff = Math.abs(tx.amount - cheque.amount);
  const amountDiffPercent = amountDiff / cheque.amount;

  if (amountDiff < 0.01) {
    score += 100;
    reasons.push('Exact amount match');
  } else if (amountDiffPercent < 0.05) {
    score += 50;
    reasons.push(`Close amount (±${(amountDiffPercent * 100).toFixed(1)}%)`);
  } else if (amountDiffPercent < 0.10) {
    score += 25;
    reasons.push(`Similar amount (±${(amountDiffPercent * 100).toFixed(1)}%)`);
  }

  // Merchant matching
  const txMerchantLower = tx.merchant?.toLowerCase() || '';
  const chequeMerchantLower = cheque.merchant.toLowerCase();

  if (txMerchantLower === chequeMerchantLower) {
    score += 75;
    reasons.push('Exact merchant match');
  } else if (
    txMerchantLower.includes(chequeMerchantLower) ||
    chequeMerchantLower.includes(txMerchantLower)
  ) {
    score += 50;
    reasons.push('Merchant keyword match');
  }

  // Date proximity (within 30 days)
  const daysDiff = Math.abs(
    (new Date(tx.date).getTime() - new Date(cheque.dueDate).getTime()) /
    (1000 * 60 * 60 * 24)
  );

  if (daysDiff < 7) {
    score += 25;
    reasons.push(`${Math.floor(daysDiff)} day${daysDiff !== 1 ? 's' : ''} difference`);
  } else if (daysDiff < 14) {
    score += 15;
    reasons.push(`${Math.floor(daysDiff)} days difference`);
  } else if (daysDiff < 30) {
    score += 5;
    reasons.push(`${Math.floor(daysDiff)} days difference`);
  }

  // Cheque number in merchant/rawText
  if (cheque.chequeNumber) {
    const containsChequeNo =
      tx.merchant?.includes(cheque.chequeNumber) ||
      tx.rawText?.includes(cheque.chequeNumber);

    if (containsChequeNo) {
      score += 75;
      reasons.push('Cheque number found in transaction');
    }
  }

  // Category matching
  if (tx.category === cheque.category) {
    score += 10;
    reasons.push('Category match');
  }

  // If no reasons, add a default one
  if (reasons.length === 0) {
    reasons.push('Low confidence match');
  }

  return { score, reasons };
}

/**
 * Gets a confidence level based on score
 */
export function getConfidenceLevel(score: number): 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' {
  if (score >= 150) return 'HIGH';
  if (score >= 75) return 'MEDIUM';
  if (score >= 25) return 'LOW';
  return 'NONE';
}

/**
 * Validates that a transaction can be paired with a cheque
 */
export function canPairTransaction(
  transaction: Transaction,
  scheduledCheque: ScheduledTransaction,
  allScheduledTransactions: ScheduledTransaction[]
): { canPair: boolean; reason?: string } {
  // Check if transaction is already paired
  if (isTransactionPaired(transaction.id, allScheduledTransactions)) {
    return {
      canPair: false,
      reason: 'Transaction is already paired to another scheduled item'
    };
  }

  // Check if accounts match
  if (transaction.accountId !== scheduledCheque.accountId) {
    return {
      canPair: false,
      reason: 'Account mismatch'
    };
  }

  // Check transaction type
  if (
    transaction.type !== TransactionType.EXPENSE &&
    transaction.type !== TransactionType.OBLIGATION
  ) {
    return {
      canPair: false,
      reason: 'Transaction must be EXPENSE or OBLIGATION type'
    };
  }

  return { canPair: true };
}

/**
 * Gets summary statistics for pairing candidates
 */
export function getPairingSummary(candidates: ChequePairingCandidate[]): {
  total: number;
  high: number;
  medium: number;
  low: number;
  none: number;
} {
  return {
    total: candidates.length,
    high: candidates.filter(c => getConfidenceLevel(c.relevanceScore) === 'HIGH').length,
    medium: candidates.filter(c => getConfidenceLevel(c.relevanceScore) === 'MEDIUM').length,
    low: candidates.filter(c => getConfidenceLevel(c.relevanceScore) === 'LOW').length,
    none: candidates.filter(c => getConfidenceLevel(c.relevanceScore) === 'NONE').length
  };
}
