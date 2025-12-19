# Local-First Architecture Design

**Date:** December 19, 2025
**Status:** Approved
**Author:** Claude Code (with user collaboration)

## Overview

Transform FinSnap from cloud-first (Supabase PostgreSQL) to local-first architecture using IndexedDB, with optional cloud backup via CSV export to Supabase Storage.

## Motivation

- **Cost Reduction:** Eliminate continuous Supabase database queries
- **Performance:** Faster load times with local data access
- **Privacy:** Data stays on device by default, cloud backup is optional
- **Offline-First:** App works without internet connection

## Architecture Changes

### Current State
- Supabase PostgreSQL as primary database
- Direct queries on every app load
- Real-time sync across devices
- Auth required on startup

### Future State
- IndexedDB as primary local database
- Biometric unlock on startup (no network needed)
- Optional Supabase login for backup/restore only
- CSV + ZIP backup to Supabase Storage
- No multi-device sync (each device independent)

## Data Flow

### App Startup
```
1. Biometric unlock (Capacitor plugin) [if enabled in settings]
2. Load data from IndexedDB
3. Run receipt cleanup (delete old receipts > 14 days)
4. App ready (offline-capable)
```

### Daily Usage
```
1. All CRUD operations write to IndexedDB
2. No network calls
3. Receipt cleanup runs on startup
```

### Backup (Manual or Auto)
```
1. User taps "Backup to Cloud" OR auto-backup at month end
2. Check auth → If not logged in, show Supabase login modal
3. Export: data.csv + receipts.zip
4. Upload to Supabase Storage: backups/{userId}/{timestamp}/
5. Show success notification
6. Optionally logout
```

### Restore
```
1. User taps "Restore from Cloud"
2. Check auth → Prompt Supabase login if needed
3. List available backups from Storage
4. User selects backup
5. Warning dialog (will replace local data)
6. Download CSV + ZIP
7. Clear IndexedDB
8. Parse CSV + extract images
9. Write to IndexedDB
10. Reload app state
```

## Local Storage Structure (IndexedDB)

**Database Name:** `finsnap_db`

### Object Stores

1. **transactions**
   - Key: `id` (UUID)
   - Indexes: `date`, `accountId`, `category`, `type`
   - New fields:
     - `receiptImage?: string` (base64)
     - `keepReceipt?: boolean` (flag to prevent auto-deletion)

2. **accounts**
   - Key: `id` (UUID)
   - Fields: name, balance, type, currency, etc.

3. **categories**
   - Key: `id` (UUID)
   - Fields: name, color, icon, budget

4. **recurring_rules**
   - Key: `id` (UUID)
   - Fields: merchant keyword patterns

5. **settings**
   - Key: `key` (string)
   - Value: any JSON
   - Keys: `baseCurrency`, `biometricEnabled`, `autoBackupMonthly`, `gradientStartColor`, etc.

6. **warranties**
   - Key: `id` (UUID)
   - Fields: warranty items with receipt images

## Receipt Management

### Smart Cleanup Rules
- Runs on app startup
- Query all items with `receiptImage` present
- Delete `receiptImage` if:
  - Item created > 14 days ago AND
  - `keepReceipt !== true`
- Keeps receipts for:
  - Warranty items (always kept)
  - Transactions flagged with `keepReceipt: true`

### Storage
- Receipts stored as base64 strings in IndexedDB
- Backup exports decode to binary files in ZIP

## Biometric Authentication

### Plugin
- `@capacitor/biometric-auth`

### Implementation
```typescript
On App Startup:
  1. Check setting: settings.biometricEnabled
  2. If disabled → Skip to load data from IndexedDB
  3. If enabled → Prompt biometric unlock
     - Success → Load data
     - Failure → Show error, allow retry or exit
     - Fallback → Device PIN/pattern if biometric unavailable
```

### Settings Toggle
```
Settings → Security Section
  [ ] Enable Biometric Lock

  - When enabled: Require biometric on every app startup
  - When disabled: Skip unlock (for testing/development)
  - Defaults to OFF during development phase
```

### Platform Support
- Native Android: Full biometric support
- Web/Desktop: Skip biometric (or optional PIN fallback)

### Security Notes
- Biometric protects app access only
- Data in IndexedDB is NOT encrypted at rest
- For full encryption, additional crypto layer needed (future enhancement)

## Backup & Restore System

### Backup Structure
```
storage/backups/{userId}/{timestamp}/
  ├── data.csv          (all structured data)
  └── receipts.zip      (all receipt images)
```

### CSV Format (data.csv)
```csv
type,id,data_json
transaction,uuid-1,"{\"amount\":50,\"merchant\":\"Starbucks\",...}"
account,uuid-2,"{\"name\":\"Chase\",\"balance\":1000,...}"
category,uuid-3,"{\"name\":\"Food\",\"color\":\"#FF5733\",...}"
setting,baseCurrency,"USD"
warranty,uuid-4,"{\"name\":\"Laptop\",\"purchaseDate\":\"2024-01-15\",...}"
recurring_rule,uuid-5,"{\"merchantKeyword\":\"Netflix\",...}"
```

### Receipts ZIP (receipts.zip)
```
receipts/
  ├── transaction_{uuid}.jpg   (base64 decoded to binary)
  ├── transaction_{uuid}.png
  ├── warranty_{uuid}.jpg
  └── ...
```

### Auto-Backup Monthly
- Setting toggle: "Auto-backup at month end"
- Daily check at midnight: `if (today === lastDayOfMonth && autoBackupEnabled && isLoggedIn)`
- Runs silent backup (no UI prompt)
- Shows notification: "Monthly backup completed ✓"
- Requires user to be logged in to Supabase

## Migration Plan

### One-Time Migration (Existing Users)

**Trigger:**
- First launch after update
- IndexedDB is empty AND user is authenticated

**Migration Flow:**
```
1. Detect migration needed
2. Show migration screen: "Migrating to local storage..."
3. Fetch all data from Supabase:
   - Transactions
   - Accounts
   - Categories
   - Recurring rules
   - Warranties
   - User settings
4. Write to IndexedDB
5. Set `migrationCompleted: true` flag
6. Show success message
7. App reloads with local data
```

**Safety:**
- Old Supabase tables remain untouched (backup safety)
- Migration can be retried on failure
- User can manually trigger re-migration from Settings

### Developer Migration Steps
```bash
# 1. Install new dependencies
npm install idb @capacitor/biometric-auth jszip papaparse

# 2. Deploy updated app
npm run build
npx cap sync android

# 3. Keep Supabase project active
#    - Tables remain as fallback
#    - Edge Functions still used for AI parsing
#    - Storage used for CSV backups
```

## Implementation Plan

### New Files

1. **`services/indexedDBService.ts`**
   - Initialize IndexedDB with object stores
   - CRUD operations for all data types
   - Query helpers (filter by date, category, etc.)

2. **`services/backupService.ts`**
   - `exportToCSV()` - Generate CSV from IndexedDB
   - `exportReceiptsZip()` - Create ZIP from base64 images
   - `uploadBackup()` - Upload to Supabase Storage
   - `listBackups()` - Fetch available backups from Storage
   - `downloadBackup()` - Download and restore from backup
   - `autoBackupCheck()` - Check and run monthly backup

3. **`services/biometricService.ts`**
   - `checkBiometricAvailable()` - Check device capability
   - `authenticate()` - Prompt biometric unlock
   - `isEnabled()` - Check if enabled in settings

4. **`services/receiptCleanupService.ts`**
   - `cleanupOldReceipts()` - Delete receipts older than 14 days
   - Runs on app startup

5. **`services/migrationService.ts`**
   - `needsMigration()` - Check if migration needed
   - `migrateFromSupabase()` - One-time data migration
   - `resetMigration()` - Allow re-migration

6. **`components/BiometricLock.tsx`**
   - Biometric prompt screen
   - Fingerprint animation
   - Retry and fallback options
   - Skip if disabled in settings

7. **`components/BackupRestoreModal.tsx`**
   - Backup/restore UI
   - List backups with dates and sizes
   - Progress indicators for upload/download
   - Warning dialogs

### Modified Files

1. **`App.tsx`**
   - Remove Supabase data loading (`loadUserData`)
   - Add IndexedDB service integration
   - Add BiometricLock wrapper component
   - Add migration check on first load
   - Update all CRUD operations to use IndexedDB

2. **`SettingsView.tsx`**
   - Add "Security" tab:
     - Enable Biometric Lock toggle
   - Add "Backup & Restore" section:
     - Backup to Cloud button
     - Restore from Cloud button
     - Auto-backup monthly toggle
     - Last backup timestamp display
   - Keep existing tabs (General, Categories, Accounts, Rules, Developer)

3. **`types.ts`**
   - Add to `Transaction` interface:
     ```typescript
     receiptImage?: string;      // Base64 image
     keepReceipt?: boolean;      // Prevent auto-deletion
     ```

4. **`AddTransaction.tsx`**
   - Add receipt image upload option
   - Add "Keep receipt" checkbox
   - Update to save to IndexedDB

5. **`EditTransactionModal.tsx`**
   - Add receipt image viewer/editor
   - Add "Keep receipt" toggle
   - Update to save to IndexedDB

## Dependencies to Install

```bash
npm install idb                          # IndexedDB wrapper
npm install @capacitor/biometric-auth    # Biometric authentication
npm install jszip                        # ZIP creation/extraction
npm install papaparse                    # CSV parsing
npm install @types/papaparse --save-dev  # TypeScript types
```

## Testing Checklist

- [ ] Biometric unlock works on Android
- [ ] Biometric toggle in Settings works
- [ ] App loads data from IndexedDB offline
- [ ] Transactions CRUD works with IndexedDB
- [ ] Receipt images save and display
- [ ] Receipt cleanup deletes old receipts (> 14 days)
- [ ] Receipts with `keepReceipt: true` are NOT deleted
- [ ] Warranty receipts are never deleted
- [ ] CSV export includes all data
- [ ] ZIP export includes all receipt images
- [ ] Backup uploads to Supabase Storage
- [ ] Restore downloads and imports correctly
- [ ] Warning dialog shows before restore
- [ ] Auto-backup runs at month end
- [ ] Migration from Supabase works on first launch
- [ ] App works fully offline after migration

## Future Enhancements

- End-to-end encryption for IndexedDB data
- Sync conflict resolution for multi-device support
- Incremental backups (only changed data)
- Backup to other cloud providers (Google Drive, Dropbox)
- Data export to Excel/PDF formats
- Automatic backup before major operations

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| IndexedDB quota limits (~50MB-100MB) | Monitor storage usage, warn users, implement cleanup |
| Migration failure | Keep Supabase data intact, allow retry, manual export |
| Biometric unavailable on device | Graceful fallback to skip biometric |
| Large backups fail to upload | Implement chunked upload, retry logic |
| User forgets to backup before reset | Auto-backup prompt before destructive actions |

## Success Criteria

- [ ] App starts and works fully offline
- [ ] No Supabase queries during normal usage
- [ ] Backup/restore works reliably
- [ ] Biometric unlock provides good UX
- [ ] Receipt management works as expected
- [ ] Migration from existing Supabase data succeeds
- [ ] Performance is noticeably faster than cloud-first
