import { Transaction, ScheduledTransaction } from "../types";

export interface ChequeMatchResult {
  matchedScheduledTransaction?: ScheduledTransaction;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  matchReason?: string;
  mismatchWarning?: string;
}

/**
 * Match a parsed transaction with cheque info against scheduled transactions
 * Uses two-factor matching: Cheque Number (primary) + Amount (secondary verification)
 */
export const matchChequeTransaction = (
  parsedTransaction: Omit<Transaction, 'id'>,
  scheduledTransactions: ScheduledTransaction[]
): ChequeMatchResult => {
  // Only process if it's a cheque transaction
  if (!parsedTransaction.isCheque || !parsedTransaction.chequeNumber) {
    return { confidence: 'NONE' };
  }

  const chequeNumber = parsedTransaction.chequeNumber.trim();
  const amount = parsedTransaction.amount;

  // Find all scheduled cheques with matching cheque number
  const matchingCheques = scheduledTransactions.filter(st =>
    st.isCheque &&
    st.chequeNumber &&
    st.chequeNumber.trim() === chequeNumber &&
    st.status === 'PENDING' // Only match pending cheques
  );

  if (matchingCheques.length === 0) {
    return {
      confidence: 'NONE',
      mismatchWarning: `No pending scheduled cheque found with number ${chequeNumber}`
    };
  }

  // Check for exact match (cheque number + amount)
  const exactMatch = matchingCheques.find(st =>
    Math.abs(st.amount - amount) < 0.01 // Allow for minor floating point differences
  );

  if (exactMatch) {
    return {
      matchedScheduledTransaction: exactMatch,
      confidence: 'HIGH',
      matchReason: `Cheque #${chequeNumber} matches with exact amount ${amount.toFixed(2)}`
    };
  }

  // If only one cheque with that number exists but amount differs
  if (matchingCheques.length === 1) {
    const scheduledAmount = matchingCheques[0].amount;
    const difference = Math.abs(scheduledAmount - amount);
    const percentDiff = (difference / scheduledAmount) * 100;

    // Allow up to 5% difference (could be exchange rate variations or fees)
    if (percentDiff <= 5) {
      return {
        matchedScheduledTransaction: matchingCheques[0],
        confidence: 'MEDIUM',
        matchReason: `Cheque #${chequeNumber} matches but amount differs slightly (expected: ${scheduledAmount.toFixed(2)}, actual: ${amount.toFixed(2)}, diff: ${difference.toFixed(2)})`,
      };
    }

    return {
      matchedScheduledTransaction: matchingCheques[0],
      confidence: 'LOW',
      matchReason: `Cheque #${chequeNumber} found but amount mismatch is significant`,
      mismatchWarning: `Expected amount: ${scheduledAmount.toFixed(2)}, but bank statement shows: ${amount.toFixed(2)} (difference: ${difference.toFixed(2)})`
    };
  }

  // Multiple cheques with same number (rare, but possible)
  // Try to find best match by amount
  const closestMatch = matchingCheques.reduce((closest, current) => {
    const currentDiff = Math.abs(current.amount - amount);
    const closestDiff = Math.abs(closest.amount - amount);
    return currentDiff < closestDiff ? current : closest;
  });

  const difference = Math.abs(closestMatch.amount - amount);
  if (difference < 0.01) {
    return {
      matchedScheduledTransaction: closestMatch,
      confidence: 'HIGH',
      matchReason: `Multiple cheques with #${chequeNumber} found - matched by exact amount ${amount.toFixed(2)}`,
    };
  }

  return {
    matchedScheduledTransaction: closestMatch,
    confidence: 'MEDIUM',
    matchReason: `Multiple cheques with #${chequeNumber} found - matched by closest amount`,
    mismatchWarning: `Multiple pending cheques with #${chequeNumber}. Matched closest amount (expected: ${closestMatch.amount.toFixed(2)}, actual: ${amount.toFixed(2)})`
  };
};

/**
 * Batch match multiple parsed transactions with cheque info
 */
export const batchMatchCheques = (
  parsedTransactions: Omit<Transaction, 'id'>[],
  scheduledTransactions: ScheduledTransaction[]
): Map<number, ChequeMatchResult> => {
  const matchResults = new Map<number, ChequeMatchResult>();

  parsedTransactions.forEach((tx, index) => {
    if (tx.isCheque && tx.chequeNumber) {
      const result = matchChequeTransaction(tx, scheduledTransactions);
      matchResults.set(index, result);
    }
  });

  return matchResults;
};

/**
 * Get summary statistics for cheque matching results
 */
export const getChequeMatchSummary = (matchResults: Map<number, ChequeMatchResult>) => {
  let highConfidence = 0;
  let mediumConfidence = 0;
  let lowConfidence = 0;
  let noMatch = 0;
  const warnings: string[] = [];

  matchResults.forEach(result => {
    switch (result.confidence) {
      case 'HIGH':
        highConfidence++;
        break;
      case 'MEDIUM':
        mediumConfidence++;
        if (result.mismatchWarning) warnings.push(result.mismatchWarning);
        break;
      case 'LOW':
        lowConfidence++;
        if (result.mismatchWarning) warnings.push(result.mismatchWarning);
        break;
      case 'NONE':
        noMatch++;
        if (result.mismatchWarning) warnings.push(result.mismatchWarning);
        break;
    }
  });

  return {
    total: matchResults.size,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    noMatch,
    warnings,
    hasIssues: lowConfidence > 0 || noMatch > 0
  };
};
