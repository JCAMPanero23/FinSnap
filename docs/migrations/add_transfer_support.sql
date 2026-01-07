-- Migration: Add Transfer Transaction Support
-- Date: 2026-01-07
-- Description: Adds to_account_id column to transactions table for proper transfer handling

-- Add to_account_id column to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS to_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

-- Add index for faster queries on to_account_id
CREATE INDEX IF NOT EXISTS idx_transactions_to_account ON transactions(to_account_id);

-- Update DATABASE_SCHEMA.md after running this migration
-- The transactions table now supports:
--   - EXPENSE/INCOME: Uses accountId only
--   - TRANSFER: Uses accountId (FROM) and toAccountId (TO)
