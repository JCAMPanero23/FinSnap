import { ScheduledTransaction, TransactionType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import {
  getAllScheduledTransactions,
  saveScheduledTransaction,
  deleteScheduledTransaction,
  getScheduledTransactionsBySeries,
} from './indexedDBService';

/**
 * Create a single scheduled transaction
 */
export async function createScheduledTransaction(
  data: Omit<ScheduledTransaction, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<ScheduledTransaction> {
  const now = new Date().toISOString();
  const scheduledTx: ScheduledTransaction = {
    ...data,
    id: uuidv4(),
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  };

  await saveScheduledTransaction(scheduledTx);
  return scheduledTx;
}

/**
 * Update an existing scheduled transaction
 */
export async function updateScheduledTransaction(
  id: string,
  updates: Partial<ScheduledTransaction>
): Promise<void> {
  const all = await getAllScheduledTransactions();
  const existing = all.find(st => st.id === id);
  if (!existing) throw new Error('Scheduled transaction not found');

  const updated: ScheduledTransaction = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await saveScheduledTransaction(updated);
}

/**
 * Mark scheduled transaction as paid
 */
export async function markAsPaid(
  id: string,
  matchedTransactionId: string,
  clearedDate: string
): Promise<void> {
  await updateScheduledTransaction(id, {
    status: 'PAID',
    matchedTransactionId,
    clearedDate,
  });
}

/**
 * Mark scheduled transaction as skipped
 */
export async function markAsSkipped(id: string, notes?: string): Promise<void> {
  await updateScheduledTransaction(id, {
    status: 'SKIPPED',
    notes,
  });
}

/**
 * Update overdue status for all pending scheduled transactions
 */
export async function updateOverdueStatus(): Promise<void> {
  const all = await getAllScheduledTransactions();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  for (const st of all) {
    if (st.status === 'PENDING' && st.dueDate < today) {
      await updateScheduledTransaction(st.id, { status: 'OVERDUE' });
    }
  }
}

/**
 * Get scheduled transactions by status
 */
export async function getByStatus(
  status: ScheduledTransaction['status']
): Promise<ScheduledTransaction[]> {
  const all = await getAllScheduledTransactions();
  return all.filter(st => st.status === status);
}

/**
 * Get upcoming scheduled transactions (next N days)
 */
export async function getUpcoming(days: number = 30): Promise<ScheduledTransaction[]> {
  const all = await getAllScheduledTransactions();
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + days);

  const todayStr = today.toISOString().split('T')[0];
  const futureStr = futureDate.toISOString().split('T')[0];

  return all
    .filter(st => st.status === 'PENDING' && st.dueDate >= todayStr && st.dueDate <= futureStr)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * Delete all scheduled transactions in a series
 */
export async function deleteSeries(seriesId: string): Promise<void> {
  const seriesItems = await getScheduledTransactionsBySeries(seriesId);
  for (const item of seriesItems) {
    await deleteScheduledTransaction(item.id);
  }
}
