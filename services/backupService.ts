import Papa from 'papaparse';
import JSZip from 'jszip';
import { supabase } from '../lib/supabase';
import {
  getAllTransactions,
  getAllAccounts,
  getAllCategories,
  getAllRecurringRules,
  getAllWarranties,
  getSetting,
} from './indexedDBService';

interface BackupRow {
  type: string;
  id: string;
  data_json: string;
}

export async function exportToCSV(): Promise<string> {
  const rows: BackupRow[] = [];

  // Export transactions
  const transactions = await getAllTransactions();
  for (const tx of transactions) {
    rows.push({
      type: 'transaction',
      id: tx.id,
      data_json: JSON.stringify(tx),
    });
  }

  // Export accounts
  const accounts = await getAllAccounts();
  for (const acc of accounts) {
    rows.push({
      type: 'account',
      id: acc.id,
      data_json: JSON.stringify(acc),
    });
  }

  // Export categories
  const categories = await getAllCategories();
  for (const cat of categories) {
    rows.push({
      type: 'category',
      id: cat.id,
      data_json: JSON.stringify(cat),
    });
  }

  // Export recurring rules
  const rules = await getAllRecurringRules();
  for (const rule of rules) {
    rows.push({
      type: 'recurring_rule',
      id: rule.id,
      data_json: JSON.stringify(rule),
    });
  }

  // Export warranties
  const warranties = await getAllWarranties();
  for (const warranty of warranties) {
    rows.push({
      type: 'warranty',
      id: warranty.id,
      data_json: JSON.stringify(warranty),
    });
  }

  // Export settings
  const settingsKeys = ['baseCurrency', 'gradientStartColor', 'gradientEndColor', 'gradientAngle', 'biometricEnabled', 'autoBackupMonthly'];
  for (const key of settingsKeys) {
    const value = await getSetting(key);
    if (value !== undefined) {
      rows.push({
        type: 'setting',
        id: key,
        data_json: JSON.stringify(value),
      });
    }
  }

  const csv = Papa.unparse(rows);
  return csv;
}

export async function exportReceiptsZip(): Promise<Blob> {
  const zip = new JSZip();
  const receiptsFolder = zip.folder('receipts');

  if (!receiptsFolder) {
    throw new Error('Failed to create receipts folder in ZIP');
  }

  // Export transaction receipts
  const transactions = await getAllTransactions();
  for (const tx of transactions) {
    if (tx.receiptImage) {
      // Convert base64 to binary
      const base64Data = tx.receiptImage.split(',')[1] || tx.receiptImage;
      const mimeMatch = tx.receiptImage.match(/data:([^;]+);/);
      const ext = mimeMatch ? mimeMatch[1].split('/')[1] : 'jpg';

      receiptsFolder.file(`transaction_${tx.id}.${ext}`, base64Data, { base64: true });
    }
  }

  // Export warranty receipts
  const warranties = await getAllWarranties();
  for (const warranty of warranties) {
    if (warranty.receiptImage) {
      const base64Data = warranty.receiptImage.split(',')[1] || warranty.receiptImage;
      const mimeMatch = warranty.receiptImage.match(/data:([^;]+);/);
      const ext = mimeMatch ? mimeMatch[1].split('/')[1] : 'jpg';

      receiptsFolder.file(`warranty_${warranty.id}.${ext}`, base64Data, { base64: true });
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  return blob;
}

export async function uploadBackup(userId: string, csv: string, receiptsBlob: Blob): Promise<void> {
  const timestamp = Date.now();
  const folderPath = `backups/${userId}/${timestamp}`;

  // Upload CSV
  const csvFile = new Blob([csv], { type: 'text/csv' });
  const { error: csvError } = await supabase.storage
    .from('backups')
    .upload(`${folderPath}/data.csv`, csvFile);

  if (csvError) {
    throw new Error(`Failed to upload CSV: ${csvError.message}`);
  }

  // Upload receipts ZIP
  const { error: zipError } = await supabase.storage
    .from('backups')
    .upload(`${folderPath}/receipts.zip`, receiptsBlob);

  if (zipError) {
    throw new Error(`Failed to upload receipts: ${zipError.message}`);
  }

  console.log(`Backup uploaded to ${folderPath}`);
}
