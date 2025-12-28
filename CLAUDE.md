# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FinSnap** is a full-stack AI-powered expense tracking application. It combines:
- **Frontend**: React 19 + TypeScript web app optimized for mobile (also packaged as Android APK via Capacitor)
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **AI**: Google Gemini 2.5 Flash for transaction parsing from SMS, emails, and receipt images

The app is production-ready with secure cloud sync, multi-device support, and no computer needed to run it after installation.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Sync with Android (after npm run build)
npx cap sync android

# Open Android project in Android Studio
npx cap open android
```

## Building Android APK

### Important: flatDir Configuration Issue

The Capacitor-generated Android build files contain a deprecated `flatDir` repository configuration that causes APK build failures ("App not installed as package appears to be invalid" error).

**Problem**: Capacitor 8.0.0 generates `android/capacitor-cordova-android-plugins/build.gradle` with a `flatDir` repository pointing to non-existent directories, which corrupts APK packaging.

**Solution**: After running `npx cap sync android`, you must manually remove the `flatDir` block from the generated file.

#### Fix Steps:

1. **After running `npx cap sync android`**, edit `android/capacitor-cordova-android-plugins/build.gradle`

2. **Find and remove** lines 39-41:
   ```gradle
   flatDir{
       dirs 'src/main/libs', 'libs'
   }
   ```

3. **The repositories block should look like this**:
   ```gradle
   repositories {
       google()
       mavenCentral()
   }
   ```

4. **In Android Studio**:
   - File → Sync Project with Gradle Files
   - Build → Clean Project
   - Build → Build Bundle(s) / APK(s) → Build APK(s)

5. **APK location**: `android/app/build/outputs/apk/debug/app-debug.apk`

**Note**: This fix must be reapplied every time you run `npx cap sync android` because Capacitor regenerates the file from its template.

**Why this isn't committed**: The entire `android/` directory is in `.gitignore` as it's considered generated build artifacts by Capacitor. This is standard practice for Capacitor projects.

## Environment Setup

### For Local Development
Create `.env.local` with your Gemini API key:
```
GEMINI_API_KEY=your-api-key-here
```

**Important**: The app uses `services/geminiService.ts` for local development, which calls the Gemini API directly from the client with your `.env.local` key.

### For Production (APK) - Future Enhancement
- Production can use Supabase Edge Functions for server-side API calls
- Edge Function `parse-transactions` would store API key securely server-side
- Current implementation: Client-side Gemini API calls (suitable for personal use)

## Architecture

### Full-Stack Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Android Phone (Capacitor APK)                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  React 19 Frontend (TypeScript + Tailwind)              │   │
│  │  - Dashboard, Add Transaction, History, Settings        │   │
│  │  - Auth Component (Login/Signup)                        │   │
│  │  - State Management in App.tsx                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            ↓ HTTPS                               │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Supabase Cloud (Backend)                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database                                     │  │
│  │  - user_settings, categories, accounts, transactions...  │  │
│  │  - Row Level Security (user data isolation)              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↕                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Authentication Service                                  │  │
│  │  - Email/Password signup & signin                        │  │
│  │  - Auto-triggers default categories on signup           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Edge Function: parse-transactions                       │  │
│  │  - Receives SMS text or receipt image                    │  │
│  │  - Calls Gemini API server-side (API key secure)        │  │
│  │  - Post-processes: balances, exchange rates, matching   │  │
│  │  - Returns parsed transactions                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
└─────────────────────────────────────────────────────────────────┘
                             ↓
         ┌──────────────────────────────────────┐
         │   Google Gemini 2.5 Flash API        │
         │   (AI Transaction Parsing)            │
         └──────────────────────────────────────┘
```

### State Management Pattern

**Single-Source-of-Truth in App.tsx**: All state lives in `App.tsx` and flows down as props. No external state management library.

- **Auth Session**: Managed by Supabase (`session` state)
- **Transactions**: `Transaction[]` fetched from Supabase database
- **Settings**: `AppSettings` fetched from Supabase (categories, accounts, rules)
- **View State**: React useState for navigation between views

**Important**: All database updates happen via async Supabase client calls (not just local state changes)

### Core Data Flow

1. **Input** → User pastes SMS/email text or uploads image in `AddTransaction.tsx`
2. **AI Parsing** → `geminiService.ts:parseTransactions()` sends to Gemini API with structured schema
3. **Account Mapping** → `AddTransaction.tsx` maps last4digits returned by AI to actual account UUIDs
4. **Post-Processing** → Service calculates exchange rates and refines amounts using balance snapshots
5. **State Update** → `App.tsx:handleAddTransactions()` inserts transactions to Supabase and updates account balances
6. **Persistence** → All changes saved to Supabase database with real-time sync

### Balance Update Logic (App.tsx:70-116)

**Critical**: Transactions update account balances using two strategies:

1. **Snapshot Update** (preferred): If AI parsed `availableBalance` or `availableCredit` from SMS, directly set account balance to that value
2. **Delta Update** (fallback): If no snapshot, increment/decrement balance by transaction amount

This dual approach handles both:
- SMS with explicit balance info (accurate)
- Manual entries without balance info (estimated)

### Gemini Service Architecture (services/geminiService.ts)

**Model**: `gemini-2.5-flash` with structured JSON output schema

**Key Features**:
- Multi-modal parsing (text + image via base64)
- Account matching by last 4 digits (`last4Digits` field)
- Recurring rules for merchant categorization
- Foreign currency detection with exchange rate calculation
- Failed transaction filtering (ignores "declined", "failed", "reversed")
- Transfer detection (generates paired EXPENSE/INCOME transactions)

**Post-Processing Pipeline** (lines 130-204):
1. Sort chronologically for bulk entries
2. Initialize running balance states from current app settings
3. Refine amounts using balance snapshots (especially for foreign currency)
4. Calculate exchange rates from original vs. final amounts
5. Reverse to newest-first for UI display

### Component Architecture

**View Components** (all receive props from App.tsx):
- `Dashboard.tsx` - Summary cards, charts (uses Recharts)
- `AddTransaction.tsx` - Input form with image upload, calls geminiService
- `TransactionList.tsx` - Filterable history with edit/delete
- `AccountsView.tsx` - Account cards with balances
- `CalendarView.tsx` - Month/date navigation
- `PlanningView.tsx` - Budget planning and savings goals
- `CategoriesView.tsx` - Dedicated category management
- `WarrantiesView.tsx` - Warranty tracking with receipt images
- `SettingsView.tsx` - Multi-tab settings (General, Categories, Accounts, Rules, **Developer**)
  - General: Base currency preferences
  - Categories: Add/edit/delete categories
  - Accounts: Manage accounts + **Orphaned Transactions Manager**
  - Rules: Recurring transaction parsing rules
  - **Developer**: Soft reset, hard reset, database stats
- `EditTransactionModal.tsx` - Edit/delete/create recurring rules
- `Auth.tsx` - Authentication with sign in/sign up/forgot password
- `ResetPassword.tsx` - Password reset page
- `LiveScanner.tsx` - Real-time camera scanning (future feature)
- `ReceiptViewer.tsx` - Receipt image viewer component

**Navigation**: Radial navigation component (`RadialNavigation.tsx`) with circular menu for all views

### Type System (types.ts)

**Key Interfaces**:
- `Transaction` - Includes `parsedMeta` for AI-extracted balance snapshots, `groupId` for split transactions
- `Account` - Balances can be negative (credit card debt) or positive (assets)
- `AppSettings` - Categories, accounts, recurring rules, savings goals, warranties
- `RecurringRule` - Merchant keyword → category/type mapping with frequency and billing details
- `SavingsGoal` - Target amount tracking with deadlines
- `WarrantyItem` - Receipt storage with expiration tracking
- `Category` - Enhanced with icons and monthly budgets

**Important**: `TransactionType.TRANSFER` is modeled as paired EXPENSE+INCOME transactions with `isTransfer: true` flag.

**Supported Views**: `'dashboard' | 'accounts' | 'categories' | 'add' | 'history' | 'settings' | 'calendar' | 'planning' | 'warranties'`

### Mobile-First Design

- Tailwind CSS with custom brand colors (teal palette)
- `max-w-md mx-auto` container for phone-sized UI
- No-scrollbar utility class for cleaner mobile UX
- Viewport meta with `user-scalable=no` for app-like feel

## Important Implementation Details

### Account ID Mapping

When AI parses transactions, it returns last4digits (e.g., "XXX920001") which are mapped to actual account UUIDs in `AddTransaction.tsx:68-76` before saving to database.

### Settings Persistence

All settings updates go through `App.tsx:handleUpdateSettings()` which:
- Syncs categories, accounts, and recurring rules to Supabase
- Handles inserts, updates, and deletes
- Maintains data integrity across refreshes
- **Auto-links orphaned transactions** when accounts are created/updated (App.tsx:537-566)
- **Handles account replacements** for bulk transaction reassignment (App.tsx:568-621)

### Transaction Linking System (Comprehensive)

**Three-Phase System for Managing Account-Transaction Relationships:**

#### Phase 1: Auto-Link by last4Digits (App.tsx:537-566)
- Automatically runs when any account is created or updated
- Finds orphaned transactions (accountId = NULL)
- Matches transactions where `account` field (raw SMS text) contains the last4Digits
- Automatically updates `accountId` to link transactions
- **Use case**: Recover transactions after accidentally deleting an account

#### Phase 2: Account Replacement Flow (SettingsView.tsx:466-487, App.tsx:568-621)
- When creating a NEW account, user can select:
  - "Orphaned Transactions Only" - Link all orphaned transactions
  - "Replace: [Account Name]" - Transfer all transactions from old account to new
- Perfect for switching banks or getting new card with different last4Digits
- Bulk updates all transactions in one operation
- **Use case**: Changed bank accounts, new credit card number

#### Phase 3: Orphaned Transactions Manager (SettingsView.tsx:310-375)
- Dedicated section in Settings → Accounts tab
- Shows count and list of orphaned transactions
- Dropdown to bulk-reassign all orphans to any account
- Real-time reassignment with confirmation
- **Use case**: Fix orphaned transactions from any source

**Database Constraint**: `account_id UUID REFERENCES accounts(id) ON DELETE SET NULL`
- When an account is deleted, transactions are preserved but `account_id` is set to NULL
- This prevents data loss but creates "orphaned" transactions
- The Transaction Linking System recovers these orphaned transactions

### Account Balance Reconciliation

When editing/deleting transactions, balances are NOT automatically adjusted backward. Users must manually correct account balances via Settings or use Developer → Soft Reset if needed.

### Currency Handling

- Base currency set in Settings (default: USD)
- Foreign transactions store both `originalAmount`/`originalCurrency` AND converted `amount`/`currency`
- Exchange rate calculated from balance snapshots when available (geminiService.ts:169-178)

### Image Processing

Images are converted to base64 in `AddTransaction.tsx` before sending to Gemini API. Supported formats: JPEG, PNG, GIF, WebP.

### Recurring Rules

Not automatic triggers - they're hints to the AI parser (geminiService.ts:54-57). The AI uses keyword matching to suggest categories, but rules don't auto-create transactions.

### Authentication

- Supabase Auth with email/password
- Forgot password flow with email reset link
- Password reset page at `/reset-password` route
- Row Level Security ensures user data isolation

### Developer Settings (Settings → Developer Tab)

**Location**: SettingsView.tsx:463-545, App.tsx:450-487

Comprehensive developer tools for testing and data management:

#### Soft Reset
- **Button**: "Reset Transactions & Balances"
- **Action**: Deletes all transactions + resets all account balances to 0
- **Keeps**: Accounts, categories, recurring rules
- **Use case**: Clean slate for testing without losing configuration
- **Implementation**: App.tsx:450-473
  - Deletes all transactions from database
  - Resets all account balances to 0
  - Reloads user data to refresh UI

#### Hard Reset (Factory Reset)
- **Button**: "Factory Reset (Delete Everything)"
- **Action**: Deletes ALL user data (transactions, accounts, categories, rules)
- **Resets**: App to default state with default categories
- **Confirmation**: Requires typing "DELETE EVERYTHING"
- **Use case**: Complete reset for new user or major testing
- **Implementation**: App.tsx:475-487

#### Database Stats
- Real-time counters for:
  - Total transactions
  - Total accounts
  - Total categories
  - Total recurring rules
  - Orphaned transactions (highlighted in orange if > 0)

**Security**: All reset functions require explicit confirmation dialogs to prevent accidental data loss.

## Category Management

### Gesture Controls
- **Double-Tap**: Opens CategorySummaryModal (analytics, read-only)
- **3-Second Hold**: Enters global edit mode
  - Drag & drop to reorder categories
  - Tap category to edit (name, icon, color, budget)
  - Delete badge (X) to remove category
  - "Add Category" card to create new
  - "Done" button to exit edit mode

### UI Enhancements
- Circular category icons (not square)
- 360° budget progress rings around icons
- No white card backgrounds (cleaner design)
- 2-line category names with line-clamp

## AI Receipt Splitting

### Feature
Split single receipts into multiple transactions grouped by category.

### Usage
1. **In Review Mode**: Tap "Split with Receipt" on any parsed transaction
2. **In Edit Mode**: Tap "Split" button in EditTransactionModal

### Flow
- AI parses receipt image into line items
- Auto-groups by category (e.g., Groceries, Entertainment)
- User can:
  - Edit item descriptions and amounts
  - Drag items between groups
  - Change group categories
  - Add new groups or items
  - Remove items
- Creates multiple transactions with shared `groupId`
- All splits share the same receipt image

### Split Transaction Display
- Badge: "🔗 Split (X)" shows linked count
- Tap badge to view all transactions in group
- SplitTransactionsModal shows individual + total amounts

## Implementation Files
- `hooks/useDoubleTapGesture.ts` - Double-tap detection
- `hooks/useHoldGesture.ts` - 3-second hold for edit mode
- `components/CategoryEditModal.tsx` - Create/edit categories
- `services/receiptSplitService.ts` - AI receipt line item parsing
- `components/SplitEditorModal.tsx` - Grouping and editing line items
- `components/SplitTransactionsModal.tsx` - View linked split transactions

## Utilities

- `start-dev.bat` - Windows batch file to quickly start dev server
- Local Gemini API key in `.env.local` for development
- Supabase configuration in `lib/supabase.ts`

## Known Limitations

- Balance adjustments on edit/delete require manual reconciliation
- Recurring rules are parsing hints, not scheduled transactions
- Savings goals and warranties tables not yet created in Supabase (local state only)
- API key exposed in client bundle (acceptable for personal use)
