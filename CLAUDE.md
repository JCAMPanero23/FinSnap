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

## Environment Setup

### For Web Development
Create `.env.local` with (optional, for local testing without Supabase):
```
GEMINI_API_KEY=your-api-key-here
```

### For Production (APK)
- Gemini API key is stored as a secret in **Supabase Edge Functions**
- Never included in the client app code
- Edge Function `parse-transactions` makes all API calls server-side

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
3. **Post-Processing** → Service calculates exchange rates and refines amounts using balance snapshots
4. **State Update** → `App.tsx:handleAddTransactions()` updates both transactions AND account balances
5. **Persistence** → Changes auto-save to localStorage via useEffect hooks

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

**View Components** (all receive props from App.tsx, no local persistence):
- `Dashboard.tsx` - Summary cards, charts (uses Recharts)
- `AddTransaction.tsx` - Input form with image upload, calls geminiService
- `TransactionList.tsx` - Filterable history with edit/delete
- `AccountsView.tsx` - Account cards with balances
- `CalendarView.tsx` - Month/date navigation
- `SettingsView.tsx` - Categories, accounts, recurring rules config
- `EditTransactionModal.tsx` - Edit/delete/create recurring rules

**Navigation**: Bottom nav bar in `App.tsx:247-295` with floating FAB for "Add"

### Type System (types.ts)

**Key Interfaces**:
- `Transaction` - Includes `parsedMeta` for AI-extracted balance snapshots
- `Account` - Balances can be negative (credit card debt) or positive (assets)
- `AppSettings` - Categories, accounts, recurring rules, base currency
- `RecurringRule` - Merchant keyword → category/type mapping

**Important**: `TransactionType.TRANSFER` is modeled as paired EXPENSE+INCOME transactions with `isTransfer: true` flag.

### Mobile-First Design

- Tailwind CSS with custom brand colors (teal palette)
- `max-w-md mx-auto` container for phone-sized UI
- No-scrollbar utility class for cleaner mobile UX
- Viewport meta with `user-scalable=no` for app-like feel

## Important Implementation Details

### Account Balance Reconciliation

When editing/deleting transactions, balances are NOT automatically adjusted backward (App.tsx:118-123). Users must manually correct account balances via Settings if needed. This is a known simplification.

### Currency Handling

- Base currency set in Settings (default: USD)
- Foreign transactions store both `originalAmount`/`originalCurrency` AND converted `amount`/`currency`
- Exchange rate calculated from balance snapshots when available (geminiService.ts:169-178)

### Image Processing

Images are converted to base64 in `AddTransaction.tsx` before sending to Gemini API. Supported formats: JPEG, PNG, GIF, WebP.

### Recurring Rules

Not automatic triggers - they're hints to the AI parser (geminiService.ts:54-57). The AI uses keyword matching to suggest categories, but rules don't auto-create transactions.

## Known Limitations

- No backend - all data in browser localStorage
- API key exposed in frontend bundle (acceptable for personal use)
- No multi-device sync
- Balance adjustments on edit/delete require manual reconciliation
- Recurring rules are parsing hints, not scheduled transactions
