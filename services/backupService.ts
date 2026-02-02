import Papa from 'papaparse';
import JSZip from 'jszip';
import { supabase } from '../lib/supabase';
import {
  getAllTransactions,
  getAllAccounts,
  getAllCategories,
  getAllRecurringRules,
  getAllWarranties,
  getAllScheduledTransactions,
  getSetting,
  saveTransaction,
  saveAccount,
  saveCategory,
  saveRecurringRule,
  saveWarranty,
  saveScheduledTransaction,
  saveSetting,
  clearAllData,
} from './indexedDBService';
import { Transaction, Account, Category, RecurringRule, WarrantyItem, ScheduledTransaction } from '../types';

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

  // Export scheduled transactions
  const scheduledTransactions = await getAllScheduledTransactions();
  for (const scheduled of scheduledTransactions) {
    rows.push({
      type: 'scheduled_transaction',
      id: scheduled.id,
      data_json: JSON.stringify(scheduled),
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

  // Export cheque images
  const scheduledTransactions = await getAllScheduledTransactions();
  for (const scheduled of scheduledTransactions) {
    if (scheduled.chequeImage) {
      const base64Data = scheduled.chequeImage.split(',')[1] || scheduled.chequeImage;
      const mimeMatch = scheduled.chequeImage.match(/data:([^;]+);/);
      const ext = mimeMatch ? mimeMatch[1].split('/')[1] : 'jpg';

      receiptsFolder.file(`cheque_${scheduled.id}.${ext}`, base64Data, { base64: true });
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  return blob;
}

const MAX_BACKUPS_PER_USER = 5;

export async function uploadBackup(userId: string, csv: string, receiptsBlob: Blob): Promise<void> {
  // Check existing backups and enforce limit
  const existingBackups = await listBackups(userId);

  if (existingBackups.length >= MAX_BACKUPS_PER_USER) {
    // Delete the oldest backup (first in the sorted list)
    const oldestBackup = existingBackups[existingBackups.length - 1]; // listBackups sorts desc, so last is oldest
    console.log(`Deleting oldest backup: ${oldestBackup.path}`);
    await deleteBackup(oldestBackup.path);
  }

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

export interface BackupInfo {
  path: string;
  timestamp: number;
  date: string;
  size?: number;
}

export async function listBackups(userId: string): Promise<BackupInfo[]> {
  const { data: files, error } = await supabase.storage
    .from('backups')
    .list(`backups/${userId}`, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (error) {
    throw new Error(`Failed to list backups: ${error.message}`);
  }

  const backups: BackupInfo[] = files
    .filter((f) => f.name && !f.name.includes('.'))
    .map((f) => {
      const timestamp = parseInt(f.name);
      return {
        path: `backups/${userId}/${f.name}`,
        timestamp,
        date: new Date(timestamp).toLocaleString(),
        size: f.metadata?.size,
      };
    });

  return backups;
}

export async function downloadBackup(backupPath: string): Promise<{ csv: string; receiptsBlob: Blob }> {
  // Download CSV
  const { data: csvData, error: csvError } = await supabase.storage
    .from('backups')
    .download(`${backupPath}/data.csv`);

  if (csvError || !csvData) {
    throw new Error(`Failed to download CSV: ${csvError?.message}`);
  }

  const csv = await csvData.text();

  // Download receipts ZIP
  const { data: zipData, error: zipError } = await supabase.storage
    .from('backups')
    .download(`${backupPath}/receipts.zip`);

  if (zipError || !zipData) {
    throw new Error(`Failed to download receipts: ${zipError?.message}`);
  }

  return { csv, receiptsBlob: zipData };
}

export async function deleteBackup(backupPath: string): Promise<void> {
  // Delete both files in the backup folder
  const { error: csvError } = await supabase.storage
    .from('backups')
    .remove([`${backupPath}/data.csv`]);

  if (csvError) {
    console.error(`Failed to delete CSV: ${csvError.message}`);
  }

  const { error: zipError } = await supabase.storage
    .from('backups')
    .remove([`${backupPath}/receipts.zip`]);

  if (zipError) {
    console.error(`Failed to delete receipts: ${zipError.message}`);
  }

  console.log(`Deleted backup: ${backupPath}`);
}

export async function restoreFromBackup(csv: string, receiptsBlob: Blob): Promise<void> {
  console.log('Starting restore from backup...');

  // Parse CSV
  const parsed = Papa.parse<BackupRow>(csv, { header: true });
  if (parsed.errors.length > 0) {
    throw new Error(`CSV parsing failed: ${parsed.errors[0].message}`);
  }

  // Extract receipts from ZIP
  const zip = await JSZip.loadAsync(receiptsBlob);
  const receiptFiles: { [key: string]: string } = {};

  const receiptsFolder = zip.folder('receipts');
  if (receiptsFolder) {
    const files = Object.keys(zip.files).filter((name) => name.startsWith('receipts/'));
    for (const filename of files) {
      const file = zip.files[filename];
      if (!file.dir) {
        const base64 = await file.async('base64');
        const ext = filename.split('.').pop();
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${base64}`;

        const key = filename.replace('receipts/', '').replace(/\.(jpg|png|gif|webp)$/, '');
        receiptFiles[key] = dataUrl;
      }
    }
  }

  // Clear existing data
  await clearAllData();

  // Restore data
  for (const row of parsed.data) {
    try {
      const data = JSON.parse(row.data_json);

      switch (row.type) {
        case 'transaction': {
          const tx = data as Transaction;
          // Restore receipt if exists
          const receiptKey = `transaction_${tx.id}`;
          if (receiptFiles[receiptKey]) {
            tx.receiptImage = receiptFiles[receiptKey];
          }
          await saveTransaction(tx);
          break;
        }
        case 'account':
          await saveAccount(data as Account);
          break;
        case 'category':
          await saveCategory(data as Category);
          break;
        case 'recurring_rule':
          await saveRecurringRule(data as RecurringRule);
          break;
        case 'warranty': {
          const warranty = data as WarrantyItem;
          // Restore receipt if exists
          const receiptKey = `warranty_${warranty.id}`;
          if (receiptFiles[receiptKey]) {
            warranty.receiptImage = receiptFiles[receiptKey];
          }
          await saveWarranty(warranty);
          break;
        }
        case 'scheduled_transaction': {
          const scheduled = data as ScheduledTransaction;
          // Restore cheque image if exists
          const chequeKey = `cheque_${scheduled.id}`;
          if (receiptFiles[chequeKey]) {
            scheduled.chequeImage = receiptFiles[chequeKey];
          }
          await saveScheduledTransaction(scheduled);
          break;
        }
        case 'setting':
          await saveSetting(row.id, data);
          break;
      }
    } catch (err) {
      console.error(`Failed to restore ${row.type} ${row.id}:`, err);
    }
  }

  console.log('Restore completed successfully');
}

export async function shouldAutoBackup(): Promise<boolean> {
  const enabled = await getSetting('autoBackupMonthly');
  if (!enabled) return false;

  const lastBackup = await getSetting('lastAutoBackup');
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;

  // Check if we already backed up this month
  if (lastBackup === currentMonth) return false;

  // Check if it's the last day of the month
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isLastDayOfMonth = tomorrow.getMonth() !== now.getMonth();

  return isLastDayOfMonth;
}

export async function markAutoBackupComplete(): Promise<void> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
  await saveSetting('lastAutoBackup', currentMonth);
}

/**
 * Uploads a daily auto-backup to Supabase Storage
 * Overwrites the previous daily backup (single backup per user)
 */
export async function uploadDailyBackup(userId: string, csv: string, receiptsBlob: Blob): Promise<void> {
  const folderPath = `backups/${userId}/daily`;

  // Delete existing daily backup files first (to ensure clean overwrite)
  try {
    await supabase.storage
      .from('backups')
      .remove([`${folderPath}/data.csv`, `${folderPath}/receipts.zip`]);
  } catch (error) {
    // Ignore errors if files don't exist
    console.log('No existing daily backup to delete (this is normal for first backup)');
  }

  // Upload CSV
  const csvFile = new Blob([csv], { type: 'text/csv' });
  const { error: csvError } = await supabase.storage
    .from('backups')
    .upload(`${folderPath}/data.csv`, csvFile, {
      upsert: true, // Overwrite if exists
    });

  if (csvError) {
    throw new Error(`Failed to upload daily backup CSV: ${csvError.message}`);
  }

  // Upload receipts ZIP
  const { error: zipError } = await supabase.storage
    .from('backups')
    .upload(`${folderPath}/receipts.zip`, receiptsBlob, {
      upsert: true, // Overwrite if exists
    });

  if (zipError) {
    throw new Error(`Failed to upload daily backup receipts: ${zipError.message}`);
  }

  console.log(`Daily backup uploaded to ${folderPath}`);
}

/**
 * Downloads the daily auto-backup from Supabase Storage
 */
export async function downloadDailyBackup(userId: string): Promise<{ csv: string; receiptsBlob: Blob }> {
  const folderPath = `backups/${userId}/daily`;

  // Download CSV
  const { data: csvData, error: csvError } = await supabase.storage
    .from('backups')
    .download(`${folderPath}/data.csv`);

  if (csvError || !csvData) {
    throw new Error(`Failed to download daily backup CSV: ${csvError?.message || 'No data'}`);
  }

  const csv = await csvData.text();

  // Download receipts ZIP
  const { data: zipData, error: zipError } = await supabase.storage
    .from('backups')
    .download(`${folderPath}/receipts.zip`);

  if (zipError || !zipData) {
    throw new Error(`Failed to download daily backup receipts: ${zipError?.message || 'No data'}`);
  }

  return { csv, receiptsBlob: zipData };
}

/**
 * Checks if a daily backup exists for the user
 */
export async function dailyBackupExists(userId: string): Promise<boolean> {
  const folderPath = `backups/${userId}/daily`;

  const { data, error } = await supabase.storage
    .from('backups')
    .list(`backups/${userId}`, {
      limit: 100,
    });

  if (error) {
    console.error('Error checking for daily backup:', error);
    return false;
  }

  // Check if 'daily' folder exists
  return data?.some((file) => file.name === 'daily') || false;
}
