/**
 * Daily Auto-Backup Service
 * Handles automatic daily backups at midnight
 */

import { getSetting, saveSetting } from './indexedDBService';
import { exportToCSV, exportReceiptsZip, uploadDailyBackup } from './backupService';

// Type for the scheduler timeout ID
let schedulerTimeout: NodeJS.Timeout | null = null;
let isBackupInProgress = false; // Mutex lock to prevent concurrent backups

/**
 * Calculates milliseconds until next midnight (local time)
 */
function getMillisecondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0); // Next midnight
  return midnight.getTime() - now.getTime();
}

/**
 * Performs the daily auto-backup
 */
async function performDailyBackup(userId: string): Promise<void> {
  // Mutex lock: prevent concurrent backups
  if (isBackupInProgress) {
    console.log('Daily backup already in progress, skipping...');
    return;
  }

  try {
    isBackupInProgress = true;

    console.log('Starting daily auto-backup...');

    // Export data
    const csv = await exportToCSV();
    const receiptsBlob = await exportReceiptsZip();

    // Upload to daily backup path (overwrites previous)
    await uploadDailyBackup(userId, csv, receiptsBlob);

    // Save timestamp of last backup
    const now = new Date().toISOString();
    await saveSetting('lastDailyBackup', now);

    console.log(`Daily auto-backup completed successfully at ${now}`);
  } catch (error) {
    console.error('Daily auto-backup failed:', error);
    // Don't throw - just log and try again tomorrow
  } finally {
    isBackupInProgress = false;
  }
}

/**
 * Schedules the next daily backup at midnight
 */
function scheduleNextBackup(userId: string): void {
  // Clear existing timeout if any
  if (schedulerTimeout) {
    clearTimeout(schedulerTimeout);
  }

  const msUntilMidnight = getMillisecondsUntilMidnight();

  console.log(`Daily backup scheduled for midnight (in ${Math.floor(msUntilMidnight / 1000 / 60)} minutes)`);

  schedulerTimeout = setTimeout(async () => {
    // Perform backup
    await performDailyBackup(userId);

    // Schedule next backup for tomorrow midnight
    scheduleNextBackup(userId);
  }, msUntilMidnight);
}

/**
 * Initializes the daily auto-backup scheduler
 * Call this once when the app starts
 */
export async function initializeDailyBackup(userId: string): Promise<void> {
  const enabled = await getSetting('dailyAutoBackupEnabled');

  if (!enabled) {
    console.log('Daily auto-backup is disabled');
    return;
  }

  console.log('Initializing daily auto-backup scheduler...');

  // Schedule first backup at midnight
  scheduleNextBackup(userId);
}

/**
 * Stops the daily auto-backup scheduler
 */
export function stopDailyBackup(): void {
  if (schedulerTimeout) {
    clearTimeout(schedulerTimeout);
    schedulerTimeout = null;
    console.log('Daily auto-backup scheduler stopped');
  }
}

/**
 * Manually triggers a daily backup (for testing or immediate backup)
 */
export async function triggerDailyBackupNow(userId: string): Promise<void> {
  const enabled = await getSetting('dailyAutoBackupEnabled');

  if (!enabled) {
    throw new Error('Daily auto-backup is disabled. Enable it in Settings first.');
  }

  await performDailyBackup(userId);
}

/**
 * Gets the status of daily auto-backup
 */
export async function getDailyBackupStatus(): Promise<{
  enabled: boolean;
  lastBackup: string | null;
  nextBackup: string;
}> {
  const enabled = await getSetting('dailyAutoBackupEnabled');
  const lastBackup = await getSetting('lastDailyBackup');

  // Calculate next midnight
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);

  return {
    enabled: !!enabled,
    lastBackup: lastBackup || null,
    nextBackup: midnight.toLocaleString(),
  };
}
