# FinSnap Database Schema

This document describes the PostgreSQL database schema used by FinSnap, hosted on Supabase.

## Overview

The database uses Row Level Security (RLS) to ensure users can only access their own data. All tables are automatically created when you run the SQL schema.

## Tables

### user_settings
Stores user-level settings and preferences.

```sql
CREATE TABLE user_settings (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  gradient_start_color TEXT DEFAULT '#d0dddf',
  gradient_end_color TEXT DEFAULT '#dcfefb',
  gradient_angle INTEGER DEFAULT 135 CHECK (gradient_angle >= 0 AND gradient_angle <= 360),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Columns:**
- `id` - User ID from Supabase Auth
- `base_currency` - User's preferred currency (e.g., 'USD', 'EUR', 'AED')
- `gradient_start_color` - Starting color of background gradient (hex format, e.g., '#d0dddf')
- `gradient_end_color` - Ending color of background gradient (hex format, e.g., '#dcfefb')
- `gradient_angle` - Gradient angle in degrees (0-360, default 135 for diagonal)
- `created_at` - Timestamp when settings were created
- `updated_at` - Timestamp of last update

**RLS Policy:**
- Users can view their own settings
- Users can update their own settings

**Auto-Populated:** When a user signs up, this is automatically created with base_currency = 'USD'

---

### categories
Custom and default transaction categories for each user.

```sql
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Columns:**
- `id` - Unique category ID
- `user_id` - User who owns this category
- `name` - Category name (e.g., 'Food & Dining', 'Transportation')
- `color` - Hex color code (e.g., '#ef4444')
- `is_default` - Whether this is a default category
- `created_at` - Timestamp when created

**RLS Policy:**
- Users can only view/create/edit/delete their own categories

**Auto-Populated:** When a user signs up, 9 default categories are created:
- Food & Dining (#ef4444)
- Shopping (#f97316)
- Transportation (#3b82f6)
- Bills & Utilities (#eab308)
- Entertainment (#8b5cf6)
- Health & Wellness (#ec4899)
- Income (#10b981)
- Transfer (#64748b)
- Other (#94a3b8)

---

### accounts
Bank accounts, credit cards, wallets, and other financial accounts.

```sql
CREATE TABLE accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Bank', 'Credit Card', 'Cash', 'Wallet', 'Other')),
  last_4_digits TEXT,
  color TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  auto_update_balance BOOLEAN DEFAULT true,
  total_credit_limit DECIMAL(12, 2),
  monthly_spending_limit DECIMAL(12, 2),
  payment_due_day INTEGER CHECK (payment_due_day >= 1 AND payment_due_day <= 31),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Columns:**
- `id` - Unique account ID
- `user_id` - User who owns this account
- `name` - Display name (e.g., 'My Chase Checking')
- `type` - Account type (Bank, Credit Card, Cash, Wallet, Other)
- `last_4_digits` - Last 4 digits for matching SMS messages
- `color` - Display color
- `currency` - Account currency code
- `balance` - Current balance (positive = asset, negative = liability for CC)
- `auto_update_balance` - Whether to auto-update from SMS balance info
- `total_credit_limit` - For credit cards, the credit limit
- `monthly_spending_limit` - Budget warning threshold
- `payment_due_day` - Day of month when payment is due (1-31)
- `created_at` - Timestamp when created
- `updated_at` - Timestamp of last update

**RLS Policy:**
- Users can only view/create/edit/delete their own accounts

**Important Notes:**
- For credit cards: `balance` represents debt (negative value)
- AI parser automatically updates balance from SMS messages if `auto_update_balance` is true
- Last 4 digits are used to match accounts in SMS messages

---

### recurring_rules
Merchant patterns for automatic categorization.

```sql
CREATE TABLE recurring_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  merchant_keyword TEXT NOT NULL,
  category TEXT,
  type TEXT CHECK (type IN ('EXPENSE', 'INCOME', 'TRANSFER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Columns:**
- `id` - Unique rule ID
- `user_id` - User who owns this rule
- `merchant_keyword` - Keyword to match merchant names
- `category` - Category to assign when merchant matches
- `type` - Transaction type (EXPENSE, INCOME, or TRANSFER)
- `created_at` - Timestamp when created

**RLS Policy:**
- Users can only view/create/edit/delete their own rules

**How It Works:**
- When parsing a transaction, AI checks merchant name against these keywords
- If keyword matches, the specified category and type are suggested
- Created manually by user or auto-created from "Add Rule" in UI

---

### transactions
Individual financial transactions.

```sql
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT NOT NULL,
  original_amount DECIMAL(12, 2),
  original_currency TEXT,
  exchange_rate DECIMAL(12, 6),
  merchant TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME,
  category TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('EXPENSE', 'INCOME', 'TRANSFER')),
  account TEXT,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  raw_text TEXT,
  tags TEXT[],
  parsed_meta JSONB,
  is_transfer BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Columns:**
- `id` - Unique transaction ID
- `user_id` - User who owns this transaction
- `amount` - Amount in base currency
- `currency` - Base currency code
- `original_amount` - Amount in original currency (if foreign)
- `original_currency` - Original currency code
- `exchange_rate` - Exchange rate used for conversion
- `merchant` - Merchant/payee name
- `date` - Transaction date (YYYY-MM-DD)
- `time` - Transaction time (HH:mm)
- `category` - Category name
- `type` - Transaction type (EXPENSE, INCOME, TRANSFER)
- `account` - Original account text from SMS
- `account_id` - Reference to matched account
- `raw_text` - Original SMS/email text
- `tags` - Array of user-defined tags
- `parsed_meta` - JSON metadata from AI parsing (e.g., availableBalance, availableCredit)
- `is_transfer` - Whether this is part of a transfer pair
- `created_at` - Timestamp when created
- `updated_at` - Timestamp of last update

**RLS Policy:**
- Users can only view/create/edit/delete their own transactions

**Important Notes:**
- Transfers are stored as TWO transactions (expense from source, income to destination)
- Both have `is_transfer: true` to identify them as a pair
- `parsed_meta` contains AI-extracted balance info for auto-updating accounts
- Indexed on (user_id, date) for fast queries

---

## Indexes

Indexes for performance optimization:

```sql
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_accounts_user ON accounts(user_id);
CREATE INDEX idx_categories_user ON categories(user_id);
CREATE INDEX idx_recurring_rules_user ON recurring_rules(user_id);
```

---

## Triggers & Functions

### initialize_user_defaults()
Automatically called when a new user signs up (via Supabase Auth).

**What it does:**
1. Creates a `user_settings` row with base_currency = 'USD'
2. Creates 9 default categories

**Important:** Function has `SECURITY DEFINER` to allow inserts while RLS is enabled.

### update_updated_at_column()
Automatically updates the `updated_at` timestamp whenever a row is modified.

Applied to:
- user_settings
- accounts
- transactions

---

## Row Level Security (RLS)

All tables have RLS enabled with policies that ensure:
- ✅ Users can only SELECT their own rows
- ✅ Users can only INSERT rows with their user_id
- ✅ Users can only UPDATE/DELETE their own rows

**Example Policy:**
```sql
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);
```

This prevents any user from accessing another user's data, even if they somehow bypass the app.

---

## Data Types

- `UUID` - Universally unique identifier (primary keys)
- `TEXT` - Unlimited text strings
- `DECIMAL(12, 2)` - Financial amounts (12 digits, 2 decimal places)
- `DATE` - Date only (YYYY-MM-DD)
- `TIME` - Time only (HH:mm:ss)
- `TIMESTAMPTZ` - Date + time with timezone
- `BOOLEAN` - True/False
- `INTEGER` - Whole numbers
- `TEXT[]` - Array of text (for tags)
- `JSONB` - JSON data (for parsed_meta)

---

## Cascade Behavior

When a user is deleted from auth.users:
- All their transactions are automatically deleted
- All their accounts are automatically deleted
- All their categories are automatically deleted
- All their recurring rules are automatically deleted

This is handled by `ON DELETE CASCADE` constraints.

---

## Setup Instructions

To set up this schema in your Supabase project:

1. Go to **SQL Editor** in Supabase dashboard
2. Click **New Query**
3. Copy the complete SQL schema from `docs/DATABASE_SCHEMA.sql`
4. Click **Run**
5. Verify all tables were created in **Table Editor**

Done! Your database is ready to use.
