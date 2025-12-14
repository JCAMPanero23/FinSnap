# FinSnap Setup Guide

Complete step-by-step guide to set up FinSnap from scratch.

## Prerequisites

- Node.js 16+ (download from https://nodejs.org)
- Supabase account (free at https://supabase.com)
- Google Gemini API key (free at https://ai.google.dev)
- Android Studio (optional, for building APK)
- Git (optional, for cloning)

---

## Step 1: Clone or Download the Repository

### Option A: Using Git
```bash
git clone https://github.com/JCAMPanero23/FinSnap.git
cd FinSnap
```

### Option B: Download ZIP
1. Go to https://github.com/JCAMPanero23/FinSnap
2. Click **Code** → **Download ZIP**
3. Extract the ZIP file
4. Open terminal/command prompt in the extracted folder

---

## Step 2: Install Dependencies

```bash
npm install
```

This installs all required Node packages (React, Supabase, Tailwind, etc.)

---

## Step 3: Set Up Supabase Backend

### 3.1 Create a Supabase Project

1. Go to https://supabase.com and sign up/login
2. Click **New Project**
3. Fill in:
   - **Name**: FinSnap
   - **Database Password**: Create a strong password
   - **Region**: Choose one close to you
4. Click **Create New Project**
5. Wait 2-5 minutes for provisioning

### 3.2 Create Database Tables

1. In Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy the entire SQL schema from `docs/DATABASE_SCHEMA.sql`
4. Paste it into the editor
5. Click **Run** (F5)
6. Verify success: "No rows returned"

### 3.3 Get Your Credentials

1. Go to **Project Settings** (gear icon, bottom left)
2. Click **API** tab
3. Copy these values:
   - **Project URL** (looks like: https://xxxxx.supabase.co)
   - **anon public key** (starts with: eyJ...)

### 3.4 Update Supabase Config

1. Open `lib/supabase.ts` in your code editor
2. Replace the values:
   ```typescript
   const supabaseUrl = 'YOUR_PROJECT_URL';
   const supabaseAnonKey = 'YOUR_ANON_KEY';
   ```
3. Save the file

### 3.5 Create Edge Function

1. In Supabase, click **Edge Functions** (left sidebar)
2. Click **Create a new function**
3. Name it: `parse-transactions`
4. Copy the code from `docs/EDGE_FUNCTION.md`
5. Paste into the editor
6. Click **Deploy**

### 3.6 Add Gemini API Key to Edge Function

1. In Supabase Edge Functions, click on `parse-transactions`
2. Click **Secrets** tab
3. Click **Add new secret**
4. Enter:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: [Your Gemini API key]
5. Click **Add secret**

---

## Step 4: Get Gemini API Key

1. Go to https://ai.google.dev
2. Click **Get API Key**
3. Create a new API key
4. Copy it and save it somewhere safe
5. This is what you'll put in the Supabase secret above

---

## Step 5: Test the Web App

1. In terminal, run:
   ```bash
   npm run dev
   ```

2. Open http://localhost:3000 in browser

3. You should see the FinSnap login screen!

4. Test signup:
   - Click "Don't have an account? Sign Up"
   - Enter email and password
   - Click **Sign Up**
   - Check email for confirmation link (check spam folder!)
   - Click confirmation link
   - Back in app, sign in with your credentials
   - You should see the dashboard!

### If you get errors:
- Check Supabase credentials in `lib/supabase.ts`
- Verify database schema was created (check **Table Editor** in Supabase)
- Make sure Gemini API key is added as a secret in Edge Function
- Check browser console for error messages (F12)

---

## Step 6: Build Android APK (Optional)

### Prerequisites
- Android Studio installed
- Android SDK (auto-installed with Studio)

### Build Steps

1. Build the web app:
   ```bash
   npm run build
   ```

2. Sync with Android:
   ```bash
   npx cap sync android
   ```

3. Open in Android Studio:
   ```bash
   npx cap open android
   ```

4. Wait for Gradle sync to complete (first time takes 3-5 min)

5. Click **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**

6. Wait for build (2-3 minutes)

7. Click **locate** in the notification to find your APK

### Install on Phone

**Option A: USB Cable**
1. Connect phone via USB
2. Enable **Developer Options** (Settings → About → Tap Build Number 7 times)
3. Enable **USB Debugging** (Settings → Developer Options)
4. In Android Studio, click green **Run** button
5. Select your device
6. App installs automatically

**Option B: Transfer APK File**
1. Copy `android/app/build/outputs/apk/debug/app-debug.apk`
2. Transfer to phone via USB or email
3. On phone, enable **Install from Unknown Sources** (Settings → Security)
4. Open the APK and tap **Install**

---

## Step 7: Test on Phone

After installing the APK:

- [ ] Sign up with email/password
- [ ] Check email for confirmation (wait a few seconds, check spam)
- [ ] Sign in
- [ ] Go to Settings → Accounts
- [ ] Add an account (e.g., "My Bank" type: Bank)
- [ ] Go to Add Transaction
- [ ] Paste in a transaction text, e.g.:
  ```
  Your card ending 1234 was charged $50.00 at Starbucks on Dec 15.
  Available balance: $450.00
  ```
- [ ] Click the **AI icon** to parse
- [ ] Verify it extracted: Merchant: Starbucks, Amount: $50, Category: Food & Dining
- [ ] Click **Add**
- [ ] Check Dashboard to see the transaction!

---

## Configuration Options

### Customize Categories

1. In the app, go to **Settings** → **Categories**
2. Click **+** to add new categories
3. Delete default categories if you don't need them

### Add Accounts

1. Go to **Settings** → **Accounts**
2. Click **+** to add new account
3. Fill in account type, name, last 4 digits
4. Set balance and credit limit (if credit card)
5. Save

### Change Currency

1. Go to **Settings**
2. Click the currency code (USD by default)
3. Change to your preferred currency

---

## Common Issues & Solutions

### "Database error saving new user"
**Solution**: Check that the SQL schema ran completely. Go to Supabase **Table Editor** and verify all tables exist.

### "Gemini API error: Not authenticated"
**Solution**: Check that `GEMINI_API_KEY` secret is added to Edge Function. Go to **Edge Functions** → **parse-transactions** → **Secrets**.

### "Cannot read property 'user' of undefined"
**Solution**: Check Supabase credentials in `lib/supabase.ts`. Make sure they match your Project URL and anon key.

### APK won't install on phone
**Solution**:
- Enable "Install from Unknown Sources" in phone settings
- Make sure Android version is 8.0+ (API 26)
- Try uninstalling old version first if updating

### Transactions not syncing to other devices
**Solution**: Log out and back in on both devices to trigger data sync.

---

## Updating the App

### After Code Changes

To update the web version:
```bash
npm run build
npm run preview
```

To update the APK:
```bash
npm run build
npx cap sync android
npx cap open android
# Then rebuild in Android Studio
```

---

## Security Notes

### For Personal Use (Current Setup)
- ✅ API key is secure (server-side only)
- ✅ Data is encrypted on Supabase
- ✅ Users isolated by RLS policies

### For Production/SaaS
Consider adding:
- [ ] Signed release APK (not debug)
- [ ] Firebase/error tracking
- [ ] User invite system
- [ ] Data export/backup features
- [ ] Rate limiting per user
- [ ] API request authentication tokens

---

## Next Steps

1. **Enjoy tracking expenses!** The app is fully functional
2. **Add your financial accounts** in Settings
3. **Create custom categories** for your spending
4. **Set up recurring rules** for merchants you use often
5. **Share APK** with friends/family (they'll have separate data)

---

## Getting Help

- **Check the README.md** for full documentation
- **Check CLAUDE.md** for architecture details
- **Check browser console** (F12) for error messages
- **Check Supabase logs** for API errors
- **Open a GitHub issue** with details and error messages

---

## What's Next (Future Ideas)

- Offline mode with sync
- Budget alerts
- Receipt OCR
- PDF statement import
- Family/shared accounts
- Bill reminders
- Dark mode
- Push notifications

Happy tracking! 🎉
