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
