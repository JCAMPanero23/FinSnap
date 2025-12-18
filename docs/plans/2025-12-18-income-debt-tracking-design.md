# Income & Debt Tracking Enhancement Design

**Date:** 2025-12-18
**Status:** Approved for Implementation

## Overview

Enhance FinSnap with flexible finance tracking by adding manual income input, payment method filters, and smart balance updates. This design preserves existing transaction categorization while adding new views for debt visibility and spending analysis.

## Core Principle

We're NOT changing how transactions are stored or categorized. Credit card purchases remain expenses with proper categories (Food, Transport, etc.). We're adding **views and filters** on top of existing data to show the same information in different ways.

## Features

### 1. Manual Income Input

**Current State:** Manual entry is hardcoded to create EXPENSE transactions only (AddTransaction.tsx:152)

**Enhancement:**
- Add transaction type toggle at top of manual entry form
- Toggle options: "Expense" | "Income"
- Same form fields for both types (amount, date, category, account, description)
- Dynamic button text: "Add Expense" vs "Add Income"

**UI Layout:**
```
┌─────────────────────────────────────┐
│  [ Expense ]  [ Income ]   ← Toggle │
├─────────────────────────────────────┤
│  Amount: USD [_______]              │
│  Date: [____]  Time: [____]         │
│  Description: [___________]         │
│  Category: [dropdown]               │
│  Account: [dropdown]                │
│                                     │
│  [Cancel]  [Add Income/Expense]     │
└─────────────────────────────────────┘
```

**State Management:**
- Add `manualType` state: `'EXPENSE' | 'INCOME'` (default: 'EXPENSE')
- Form submission uses `manualType` instead of hardcoded `TransactionType.EXPENSE`

**Visual Feedback:**
- Income toggle: Green accent color
- Expense toggle: Current brand color
- Amount preview shows +/- based on selected type

### 2. Dashboard Filters & Debt Overview

**Current Dashboard:** Shows total income/expenses with category breakdown charts

**Enhancement:** Add filter tabs to view data by payment method

**Filter Tabs:**
```
[ All Spending ]  [ Cash Only ]  [ Credit Only ]  [ Debt Overview ]
```

**View A: All Spending (Default)**
- Current behavior - all accounts combined
- Total Income / Total Expenses
- Category pie chart (all transactions)
- Monthly trend chart (all transactions)

**View B: Cash Only**
- Filters to accounts where `type !== 'Credit Card'`
- Shows: Cash + Bank + Wallet expenses only
- Same cards/charts, but filtered data
- **Use case:** "How much am I spending in actual money?"

**View C: Credit Only**
- Filters to accounts where `type === 'Credit Card'`
- Shows: Credit card expenses only
- Same cards/charts, but filtered data
- **Use case:** "How much am I charging to credit?"

**View D: Debt Overview (NEW)**
```
┌─────────────────────────────────────────┐
│  Total Debt: $2,450.00                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━         │
│                                         │
│  💳 Visa (...4321)      -$1,200.00     │
│     Due: Jan 15         Limit: $5,000  │
│                                         │
│  💳 Mastercard (...9876) -$1,250.00    │
│     Due: Jan 20         Limit: $3,000  │
│                                         │
│  Recent Credit Card Transactions ↓      │
│  [List of last 10 credit card txns]    │
└─────────────────────────────────────────┘
```

**Technical Approach:**
- Filter transactions by `accountId` → check if linked account has `type === 'Credit Card'`
- Calculate debt by summing negative balances on all Credit Card accounts
- Add UI controls (tabs) to toggle between filter views
- Update dashboard cards to show filtered totals

### 3. Transaction History Filters

**Current History:** Shows all transactions with search and edit capabilities

**Enhancement:** Add filter dropdown to view specific transaction types

**UI Layout:**
```
┌──────────────────────────────────────────┐
│  Transaction History                     │
│  Filter: [ All Transactions ▼ ]         │
│         [ Cash Payments     ]            │
│         [ Credit Card       ]            │
│         [ Income Only       ]            │
├──────────────────────────────────────────┤
│  [Search box...]                         │
│                                          │
│  Transaction cards...                    │
└──────────────────────────────────────────┘
```

**Filter Logic:**
1. **All Transactions** - No filter, show everything
2. **Cash Payments** - `type === EXPENSE && account.type !== 'Credit Card'`
3. **Credit Card** - `type === EXPENSE && account.type === 'Credit Card'`
4. **Income Only** - `type === INCOME`

**Implementation:**
- Add `filterMode` state to TransactionList component
- Filter transactions array before rendering
- Preserve search functionality (works with filters)
- Show count: "Showing 45 of 120 transactions" when filtered

### 4. Smart Balance Update Logic

**Current Problem:**
When importing transactions, the system updates account balance regardless of transaction date. Importing an old SMS from last month incorrectly adjusts today's balance.

**Enhancement:** Compare transaction date to existing history before updating balance

**Algorithm:**
```
For each new transaction being added:
  1. Get target account
  2. Find the most recent transaction date for that account in history
  3. Compare new transaction date to most recent date:

     IF new transaction date >= most recent date:
        → This is a NEW transaction
        → UPDATE account balance (current behavior)

     ELSE:
        → This is a HISTORICAL transaction
        → DO NOT update account balance
        → Just add to history for record-keeping
```

**Edge Cases:**
1. **First transaction ever for account** - No history, so always update balance
2. **Same-day multiple transactions** - All update balance (date >= most recent)
3. **Bulk import with mixed dates** - Each checked individually
4. **Manual entries** - Same logic applies (respects date field)

**Implementation Location:**
- Modify `App.tsx:handleAddTransactions()` (lines 70-116)
- Add helper function: `shouldUpdateBalance(transaction, accountId, existingTransactions)`
- Check before applying balance snapshot or delta updates

## Technical Implementation Notes

**Files to Modify:**
1. `components/AddTransaction.tsx` - Add income toggle to manual form
2. `components/Dashboard.tsx` - Add filter tabs and debt overview section
3. `components/TransactionList.tsx` - Add filter dropdown
4. `App.tsx` - Enhance balance update logic with smart date checking

**No Data Model Changes:**
- Uses existing `TransactionType.INCOME` (already defined)
- Uses existing `Account.type` field to distinguish payment methods
- Uses existing `Transaction.date` for smart balance logic
- No database schema changes needed

**Filter Implementation Pattern:**
```typescript
const getFilteredTransactions = (transactions, accounts, filterMode) => {
  switch (filterMode) {
    case 'cash':
      return transactions.filter(t => {
        const account = accounts.find(a => a.id === t.accountId);
        return t.type === 'EXPENSE' && account?.type !== 'Credit Card';
      });
    case 'credit':
      return transactions.filter(t => {
        const account = accounts.find(a => a.id === t.accountId);
        return t.type === 'EXPENSE' && account?.type === 'Credit Card';
      });
    case 'income':
      return transactions.filter(t => t.type === 'INCOME');
    default:
      return transactions;
  }
};
```

## Benefits

1. **Preserves Category Insights** - Credit card purchases still show proper categories (Food, Transport, etc.)
2. **Adds Debt Tracking** - Clear visibility into credit card balances and payment obligations
3. **Flexible Filtering** - View spending by payment method (cash vs credit)
4. **Prevents Balance Errors** - Smart date checking prevents double-counting old transactions
5. **Manual Income Support** - Complete transaction management (income + expenses)
6. **No Breaking Changes** - All enhancements are additive, existing data unaffected

## Success Criteria

- [ ] Users can manually add income transactions
- [ ] Dashboard shows filtered views: All, Cash Only, Credit Only, Debt Overview
- [ ] History has filter dropdown for transaction types
- [ ] Importing old transactions doesn't incorrectly update current balances
- [ ] All existing functionality remains intact
- [ ] UI is mobile-optimized and consistent with current design
