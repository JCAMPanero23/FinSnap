# Supabase Storage Setup

## Backups Bucket

Created a private storage bucket for user backups:
- **Bucket name:** `backups`
- **Public:** No (private)
- **Path structure:** `backups/{userId}/{timestamp}/`
- **Files:** `data.csv` + `receipts.zip`
- **Max file size:** 50 MB
- **RLS policies:** Users can only access their own backups

## RLS Policies

### 1. INSERT Policy - Upload Own Backups
```sql
Name: Users can upload own backups
Command: INSERT
Target: authenticated

WITH CHECK:
  bucket_id = 'backups' AND
  (storage.foldername(name))[1] = 'backups' AND
  (storage.foldername(name))[2] = auth.uid()::text
```

### 2. SELECT Policy - Read Own Backups
```sql
Name: Users can read own backups
Command: SELECT
Target: authenticated

USING:
  bucket_id = 'backups' AND
  (storage.foldername(name))[1] = 'backups' AND
  (storage.foldername(name))[2] = auth.uid()::text
```

### 3. DELETE Policy - Delete Own Backups
```sql
Name: Users can delete own backups
Command: DELETE
Target: authenticated

USING:
  bucket_id = 'backups' AND
  (storage.foldername(name))[1] = 'backups' AND
  (storage.foldername(name))[2] = auth.uid()::text
```

## How It Works

1. **User creates backup** in app (Settings → Backup & Restore)
2. **App exports data:**
   - `data.csv` - All transactions, accounts, categories, settings
   - `receipts.zip` - All receipt images from transactions and warranties
3. **App uploads to Supabase Storage:**
   - Creates folder: `backups/{userId}/{timestamp}/`
   - Uploads: `data.csv` and `receipts.zip`
4. **User can restore:**
   - App lists available backups from their folder
   - User selects backup to restore
   - App downloads, parses, and restores to IndexedDB

## Security

- **Isolated by user:** Each user can only access `backups/{their_uid}/`
- **No cross-user access:** RLS policies enforce user isolation
- **Private bucket:** Files not publicly accessible
- **Authenticated only:** Must be logged in to access

## Testing

To test backup functionality:

1. **Login to app**
2. **Add some test data** (transactions, accounts)
3. **Go to Settings → Backup & Restore → Manage Backups**
4. **Click "Backup to Cloud"**
5. **Verify in Supabase Dashboard:**
   - Storage → backups → {your-user-id} → {timestamp}
   - Should see `data.csv` and `receipts.zip`
6. **Test restore:**
   - Add more data locally
   - Click "Restore from Cloud"
   - Select the backup
   - Verify data reverts to backup state

## Troubleshooting

**Upload fails with "Permission denied":**
- Check RLS policies are created correctly
- Verify user is authenticated (logged in)
- Check Storage logs in Supabase Dashboard

**Backup not appearing in list:**
- Check folder structure: `backups/{userId}/{timestamp}/`
- Verify files uploaded successfully in Supabase Dashboard
- Check browser console for errors

**File size too large:**
- Default limit: 50 MB
- If exceeded, increase limit in Supabase bucket settings
- Or implement compression for large datasets
