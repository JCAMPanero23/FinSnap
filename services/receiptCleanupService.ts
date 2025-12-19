import { getAllTransactions, saveTransaction, getAllWarranties } from './indexedDBService';

const RECEIPT_RETENTION_DAYS = 14;

export async function cleanupOldReceipts(): Promise<number> {
  let deletedCount = 0;
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - RECEIPT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Clean transaction receipts
  const transactions = await getAllTransactions();
  for (const tx of transactions) {
    if (!tx.receiptImage) continue;
    if (tx.keepReceipt === true) continue; // User wants to keep it

    const txDate = new Date(tx.date);
    if (txDate < cutoffDate) {
      // Delete receipt image
      const updated = { ...tx, receiptImage: undefined };
      await saveTransaction(updated);
      deletedCount++;
    }
  }

  // Warranties always keep their receipts (never clean)

  console.log(`Cleaned up ${deletedCount} old receipt images`);
  return deletedCount;
}
