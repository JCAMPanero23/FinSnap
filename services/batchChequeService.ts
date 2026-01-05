import { ScheduledTransaction, TransactionType } from '../types';
import { createScheduledTransaction, deleteScheduledTransaction } from './scheduledTransactionsService';
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
  // Validate inputs
  if (params.numberOfCheques <= 0) {
    throw new Error('numberOfCheques must be positive');
  }
  if (params.intervalValue <= 0) {
    throw new Error('intervalValue must be positive');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.firstChequeDate)) {
    throw new Error('firstChequeDate must be in YYYY-MM-DD format');
  }
  if (params.chequeImages && params.chequeImages.length !== params.numberOfCheques) {
    throw new Error(`chequeImages array length (${params.chequeImages.length}) must match numberOfCheques (${params.numberOfCheques})`);
  }

  const seriesId = uuidv4();
  const createdCheques: ScheduledTransaction[] = [];

  try {
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
  } catch (error) {
    // Rollback: delete any created cheques
    for (const cheque of createdCheques) {
      await deleteScheduledTransaction(cheque.id).catch(() => {});
    }
    throw new Error(`Failed to create batch cheques: ${error instanceof Error ? error.message : String(error)}`);
  }
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
  // Force UTC interpretation to avoid timezone bugs
  const [year, month, day] = firstDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

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

/**
 * Add a single cheque to an existing series
 */
export async function addChequeToSeries(
  seriesId: string,
  existingCheque: ScheduledTransaction,
  newChequeData: {
    dueDate: string;
    amount: number;
    chequeNumber?: string;
    chequeImage?: string;
  }
): Promise<ScheduledTransaction> {
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newChequeData.dueDate)) {
    throw new Error('dueDate must be in YYYY-MM-DD format');
  }

  // Create a new cheque based on the existing series template
  const newCheque = await createScheduledTransaction({
    merchant: existingCheque.merchant,
    amount: newChequeData.amount,
    currency: existingCheque.currency,
    category: existingCheque.category,
    type: existingCheque.type,
    accountId: existingCheque.accountId,
    dueDate: newChequeData.dueDate,
    recurrencePattern: 'ONCE',
    isCheque: true,
    chequeNumber: newChequeData.chequeNumber,
    chequeImage: newChequeData.chequeImage,
    seriesId,
    notes: existingCheque.notes ? `${existingCheque.notes} (added manually)` : 'Added to series',
  });

  return newCheque;
}
