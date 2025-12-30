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
  // Handle zero-amount scheduled transactions
  const amountPercent = st.amount !== 0
    ? (amountDiff / st.amount) * 100
    : (amountDiff === 0 ? 0 : 100);

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
  // Defensive programming for null/undefined merchants
  const txMerchant = (tx.merchant || '').toLowerCase();
  const stMerchant = (st.merchant || '').toLowerCase();

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
  // Reject if length difference is too large (fuzzy match won't be meaningful)
  const lengthDiff = Math.abs(str1.length - str2.length);
  if (lengthDiff > 5) return false; // No way to match with only 3 edits

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
