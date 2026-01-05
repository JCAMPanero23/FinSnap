import { ScheduledTransaction } from '../types';

export interface ChequeValidationIssue {
  type: 'ERROR' | 'WARNING';
  chequeId: string;
  chequeNumber?: string;
  message: string;
}

export interface ChequeValidationResult {
  isValid: boolean;
  issues: ChequeValidationIssue[];
  hasNumberingIssues: boolean;
  hasDateIssues: boolean;
}

/**
 * Validate a series of cheques for proper numbering and date progression
 */
export function validateChequeSeries(cheques: ScheduledTransaction[]): ChequeValidationResult {
  const issues: ChequeValidationIssue[] = [];

  if (cheques.length === 0) {
    return { isValid: true, issues: [], hasNumberingIssues: false, hasDateIssues: false };
  }

  // Sort by due date for validation
  const sortedCheques = [...cheques].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Validate cheque numbering
  const chequesWithNumbers = sortedCheques.filter(ch => ch.chequeNumber);
  if (chequesWithNumbers.length > 0) {
    validateChequeNumbering(chequesWithNumbers, issues);
  }

  // Validate date progression
  validateDateProgression(sortedCheques, issues);

  // Validate for duplicate cheque numbers
  validateDuplicateNumbers(sortedCheques, issues);

  const hasNumberingIssues = issues.some(i => i.message.includes('number') || i.message.includes('Number'));
  const hasDateIssues = issues.some(i => i.message.includes('date') || i.message.includes('Date'));
  const isValid = issues.filter(i => i.type === 'ERROR').length === 0;

  return {
    isValid,
    issues,
    hasNumberingIssues,
    hasDateIssues,
  };
}

/**
 * Check if cheque numbers are sequential or at least increasing
 */
function validateChequeNumbering(
  cheques: ScheduledTransaction[],
  issues: ChequeValidationIssue[]
): void {
  for (let i = 0; i < cheques.length - 1; i++) {
    const current = cheques[i];
    const next = cheques[i + 1];

    if (!current.chequeNumber || !next.chequeNumber) continue;

    const currentNum = parseInt(current.chequeNumber);
    const nextNum = parseInt(next.chequeNumber);

    if (isNaN(currentNum) || isNaN(nextNum)) continue;

    // Check if numbers are decreasing
    if (nextNum < currentNum) {
      issues.push({
        type: 'ERROR',
        chequeId: next.id,
        chequeNumber: next.chequeNumber,
        message: `Cheque #${next.chequeNumber} has a lower number than previous cheque #${current.chequeNumber}`,
      });
    }
    // Check if numbers are sequential
    else if (nextNum !== currentNum + 1) {
      const gap = nextNum - currentNum;
      if (gap > 3) {
        issues.push({
          type: 'WARNING',
          chequeId: next.id,
          chequeNumber: next.chequeNumber,
          message: `Large gap in cheque numbering: #${current.chequeNumber} to #${next.chequeNumber} (${gap - 1} numbers skipped)`,
        });
      }
    }
  }
}

/**
 * Check for proper date progression
 */
function validateDateProgression(
  cheques: ScheduledTransaction[],
  issues: ChequeValidationIssue[]
): void {
  // Calculate expected interval based on first few cheques
  if (cheques.length < 2) return;

  const intervals: number[] = [];
  for (let i = 0; i < Math.min(3, cheques.length - 1); i++) {
    const current = new Date(cheques[i].dueDate);
    const next = new Date(cheques[i + 1].dueDate);
    const daysDiff = Math.round((next.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
    intervals.push(daysDiff);
  }

  // Calculate average interval
  const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const tolerance = Math.max(3, avgInterval * 0.2); // 20% tolerance or 3 days minimum

  // Check each date interval
  for (let i = 0; i < cheques.length - 1; i++) {
    const current = new Date(cheques[i].dueDate);
    const next = new Date(cheques[i + 1].dueDate);
    const daysDiff = Math.round((next.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));

    // Check for backward dates
    if (daysDiff < 0) {
      issues.push({
        type: 'ERROR',
        chequeId: next.id,
        chequeNumber: next.chequeNumber,
        message: `Cheque date ${next.dueDate} is before previous cheque date ${current.dueDate}`,
      });
    }
    // Check for same dates
    else if (daysDiff === 0) {
      issues.push({
        type: 'WARNING',
        chequeId: next.id,
        chequeNumber: next.chequeNumber,
        message: `Two cheques have the same date: ${current.dueDate}`,
      });
    }
    // Check for unusual intervals (only if we have enough data to establish a pattern)
    else if (intervals.length >= 2 && Math.abs(daysDiff - avgInterval) > tolerance) {
      issues.push({
        type: 'WARNING',
        chequeId: next.id,
        chequeNumber: next.chequeNumber,
        message: `Unusual date interval: ${daysDiff} days (expected ~${Math.round(avgInterval)} days)`,
      });
    }
  }
}

/**
 * Check for duplicate cheque numbers
 */
function validateDuplicateNumbers(
  cheques: ScheduledTransaction[],
  issues: ChequeValidationIssue[]
): void {
  const numberCounts = new Map<string, ScheduledTransaction[]>();

  cheques.forEach(ch => {
    if (ch.chequeNumber) {
      if (!numberCounts.has(ch.chequeNumber)) {
        numberCounts.set(ch.chequeNumber, []);
      }
      numberCounts.get(ch.chequeNumber)!.push(ch);
    }
  });

  numberCounts.forEach((duplicates, number) => {
    if (duplicates.length > 1) {
      duplicates.forEach(ch => {
        issues.push({
          type: 'ERROR',
          chequeId: ch.id,
          chequeNumber: number,
          message: `Duplicate cheque number: #${number} appears ${duplicates.length} times`,
        });
      });
    }
  });
}

/**
 * Suggest next cheque number based on existing series
 */
export function suggestNextChequeNumber(cheques: ScheduledTransaction[]): string | undefined {
  const chequesWithNumbers = cheques
    .filter(ch => ch.chequeNumber)
    .map(ch => parseInt(ch.chequeNumber!))
    .filter(num => !isNaN(num))
    .sort((a, b) => a - b);

  if (chequesWithNumbers.length === 0) return undefined;

  const lastNumber = chequesWithNumbers[chequesWithNumbers.length - 1];
  return String(lastNumber + 1);
}

/**
 * Suggest next due date based on existing series pattern
 */
export function suggestNextDueDate(cheques: ScheduledTransaction[]): string | undefined {
  if (cheques.length === 0) return undefined;

  // Sort by due date
  const sortedCheques = [...cheques].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Get last cheque date
  const lastDate = new Date(sortedCheques[sortedCheques.length - 1].dueDate);

  // Calculate interval from last few cheques
  if (sortedCheques.length >= 2) {
    const intervals: number[] = [];
    for (let i = Math.max(0, sortedCheques.length - 4); i < sortedCheques.length - 1; i++) {
      const current = new Date(sortedCheques[i].dueDate);
      const next = new Date(sortedCheques[i + 1].dueDate);
      const daysDiff = Math.round((next.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
      intervals.push(daysDiff);
    }

    // Use average interval
    const avgInterval = Math.round(intervals.reduce((sum, val) => sum + val, 0) / intervals.length);

    // Add interval to last date
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + avgInterval);

    return nextDate.toISOString().split('T')[0];
  }

  // If only one cheque, suggest 30 days later (monthly default)
  const nextDate = new Date(lastDate);
  nextDate.setMonth(nextDate.getMonth() + 1);
  return nextDate.toISOString().split('T')[0];
}
