import { Transaction, ScheduledTransaction, TransactionType, RecurrencePattern } from '../types';

/**
 * Transaction to Scheduled Service
 * Converts existing transactions into scheduled/recurring bills
 */

export interface RecurringBillFormData {
  recurrencePattern: RecurrencePattern; // ONCE, MONTHLY, WEEKLY, CUSTOM
  recurrenceInterval: number; // e.g., 2 for "every 2 months"
  firstDueDate: string; // ISO date YYYY-MM-DD
  recurrenceEndDate?: string; // Optional end date
  notes?: string;
}

/**
 * Converts a Transaction into a ScheduledTransaction
 *
 * @param transaction - The transaction to convert
 * @param recurringData - Recurrence configuration
 * @returns ScheduledTransaction (without id, status, timestamps)
 */
export function convertTransactionToScheduled(
  transaction: Transaction,
  recurringData: RecurringBillFormData
): Omit<ScheduledTransaction, 'id' | 'status' | 'createdAt' | 'updatedAt'> {
  // Convert EXPENSE transactions to OBLIGATION type for recurring bills
  const type = transaction.type === TransactionType.EXPENSE
    ? TransactionType.OBLIGATION
    : transaction.type;

  return {
    amount: transaction.amount,
    currency: transaction.currency,
    merchant: transaction.merchant,
    category: transaction.category,
    type,
    accountId: transaction.accountId,
    dueDate: recurringData.firstDueDate,
    recurrencePattern: recurringData.recurrencePattern,
    recurrenceInterval: recurringData.recurrenceInterval,
    recurrenceEndDate: recurringData.recurrenceEndDate,
    notes: recurringData.notes ||
           `Created from transaction on ${transaction.date}${transaction.merchant ? ` - ${transaction.merchant}` : ''}`
  };
}

/**
 * Generates smart defaults for recurring bill form based on transaction
 */
export function getDefaultRecurringData(transaction: Transaction): RecurringBillFormData {
  // Calculate first due date: 1 month from transaction date
  const txDate = new Date(transaction.date);
  const firstDueDate = new Date(txDate);
  firstDueDate.setMonth(firstDueDate.getMonth() + 1);

  return {
    recurrencePattern: 'MONTHLY',
    recurrenceInterval: 1,
    firstDueDate: firstDueDate.toISOString().split('T')[0],
    recurrenceEndDate: undefined,
    notes: ''
  };
}

/**
 * Validates recurring bill form data
 */
export function validateRecurringBillData(data: RecurringBillFormData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate first due date
  if (!data.firstDueDate) {
    errors.push('First due date is required');
  } else {
    const dueDate = new Date(data.firstDueDate);
    if (isNaN(dueDate.getTime())) {
      errors.push('Invalid first due date');
    }
  }

  // Validate recurrence interval
  if (data.recurrenceInterval < 1 || data.recurrenceInterval > 365) {
    errors.push('Recurrence interval must be between 1 and 365');
  }

  // Validate end date (if provided)
  if (data.recurrenceEndDate) {
    const endDate = new Date(data.recurrenceEndDate);
    const dueDate = new Date(data.firstDueDate);

    if (isNaN(endDate.getTime())) {
      errors.push('Invalid end date');
    } else if (endDate <= dueDate) {
      errors.push('End date must be after first due date');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Checks if a transaction can be converted to a recurring bill
 */
export function canConvertToRecurring(transaction: Transaction): { canConvert: boolean; reason?: string } {
  // TRANSFER transactions shouldn't become recurring bills
  if (transaction.type === TransactionType.TRANSFER) {
    return {
      canConvert: false,
      reason: 'Transfer transactions cannot be converted to recurring bills'
    };
  }

  // Must have an account
  if (!transaction.accountId) {
    return {
      canConvert: false,
      reason: 'Transaction must be associated with an account'
    };
  }

  return { canConvert: true };
}

/**
 * Preview: Calculate next N due dates based on recurrence pattern
 */
export function previewDueDates(
  startDate: string,
  pattern: RecurrencePattern,
  interval: number,
  count: number = 5
): string[] {
  const dates: string[] = [];
  let currentDate = new Date(startDate);

  for (let i = 0; i < count; i++) {
    dates.push(currentDate.toISOString().split('T')[0]);

    // Calculate next date based on pattern
    if (pattern === 'MONTHLY') {
      currentDate.setMonth(currentDate.getMonth() + interval);
    } else if (pattern === 'WEEKLY') {
      currentDate.setDate(currentDate.getDate() + (7 * interval));
    } else if (pattern === 'CUSTOM') {
      currentDate.setDate(currentDate.getDate() + interval);
    } else if (pattern === 'ONCE') {
      break; // ONCE means no recurrence
    }
  }

  return dates;
}
