# Bills, Debts & Loans Feature Design

**Date:** 2025-12-29
**Status:** Design Approved, Ready for Implementation

## Overview

This design adds comprehensive scheduled transaction management, loan/BNPL account tracking, snapshot-based balance reconciliation, and postdated cheque tracking to FinSnap.

## Core Features

1. **Scheduled Transactions System** - Auto-creating recurring transactions with smart matching
2. **Loan/BNPL Account Type** - Track Tamara, Tabby, and other installment loans
3. **Balance Reconciliation** - Snapshot-based validation to prevent drift
4. **Postdated Cheque Tracking** - Batch creator for cheque series with image support
5. **Dashboard Integration** - Prominent visibility for upcoming bills and discrepancies

## Key User Scenarios

### Scenario 1: Salary (Recurring Income)
- **Expected:** Salary of 12,000 AED on the 1st of every month
- **Reality:** Sometimes paid early (28th of previous month) or late (5th)
- **Solution:** Smart matching recognizes salary within ±30 days, same amount + merchant

### Scenario 2: Rent Cheques (Postdated)
- **Setup:** Issue 6 cheques dated every 2 months (Jan 1, Mar 1, May 1, Jul 1, Sep 1, Nov 1)
- **Reality:** Landlord cashes them late (Jan cheque cashed Jan 15)
- **Solution:** Track both issue date (due_date) and clearing date (cleared_date)
- **Critical:** Balance only affected when cheque actually clears, not when issued

### Scenario 3: Tamara/Tabby Loans
- **Purchase:** Buy iPhone for 3,000 AED via Tamara (4 installments)
- **Tracking:** Auto-generate 4 scheduled installment transactions
- **Balance:** Loan account starts at -3,000 AED, increases to 0 as installments paid

---

## Database Schema Changes

### New Table: `scheduled_transactions`

```sql
CREATE TABLE scheduled_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Transaction Details
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT NOT NULL,
  merchant TEXT NOT NULL,
  category TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('EXPENSE', 'INCOME')),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,

  -- Scheduling
  due_date DATE NOT NULL,
  recurrence_pattern TEXT, -- 'ONCE', 'MONTHLY', 'WEEKLY', 'CUSTOM'
  recurrence_interval INTEGER, -- e.g., 2 for "every 2 months"
  recurrence_end_date DATE,

  -- Status & Matching
  status TEXT DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'SKIPPED', 'OVERDUE'
  matched_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  cleared_date DATE, -- Actual date paid (for cheques especially)

  -- Cheque Specific
  is_cheque BOOLEAN DEFAULT false,
  cheque_number TEXT,
  cheque_image TEXT, -- Base64 image of physical cheque
  series_id UUID, -- Links batch-created cheques together

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduled_transactions_user_date ON scheduled_transactions(user_id, due_date);
CREATE INDEX idx_scheduled_transactions_status ON scheduled_transactions(status) WHERE status = 'PENDING';
CREATE INDEX idx_scheduled_transactions_series ON scheduled_transactions(series_id) WHERE series_id IS NOT NULL;
```

**RLS Policies:**
```sql
-- Users can only view/create/edit/delete their own scheduled transactions
CREATE POLICY "Users can view own scheduled transactions" ON scheduled_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scheduled transactions" ON scheduled_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled transactions" ON scheduled_transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled transactions" ON scheduled_transactions
  FOR DELETE USING (auth.uid() = user_id);
```

### Modify Existing: `accounts` table

```sql
-- Add new account type: Loan/BNPL
ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_type_check;

ALTER TABLE accounts
  ADD CONSTRAINT accounts_type_check
    CHECK (type IN ('Bank', 'Credit Card', 'Cash', 'Wallet', 'Loan/BNPL', 'Other'));

-- Add loan-specific fields
ALTER TABLE accounts
  ADD COLUMN loan_principal DECIMAL(12, 2), -- Original loan amount
  ADD COLUMN loan_installments INTEGER, -- Total number of installments
  ADD COLUMN loan_start_date DATE; -- Date loan was taken
```

---

## Smart Matching System

### Matching Algorithm

When a new transaction is created (via SMS parsing or manual entry):

**Step 1: Find Candidates**
```sql
SELECT * FROM scheduled_transactions
WHERE user_id = ?
  AND status = 'PENDING'
  AND type = ? -- Match EXPENSE/INCOME
  AND due_date BETWEEN (transaction_date - INTERVAL '30 days')
                   AND (transaction_date + INTERVAL '30 days')
```

**Step 2: Score Each Candidate**

| Factor | Exact Match | Close Match | Weak Match |
|--------|-------------|-------------|------------|
| Amount | 100 points (exact) | 50 points (±5%) | 25 points (±10%) |
| Merchant | 100 points (exact) | 50 points (keyword) | 25 points (fuzzy) |
| Date Proximity | 50 points (same day) | 25 points (±7 days) | 10 points (±30 days) |
| Account Match | 50 points | 0 points | 0 points |

**Step 3: Auto-Suggest if Score ≥ 150**

### Confirmation Flow

```
┌─────────────────────────────────────────┐
│  Possible Match Found                   │
├─────────────────────────────────────────┤
│  Scheduled:                             │
│  Rent - 7,000 AED                       │
│  Due: Jan 1, 2026                       │
│                                         │
│  Actual Transaction:                    │
│  RENT PAYMENT - 7,000 AED               │
│  Paid: Jan 15, 2026                     │
│                                         │
│  Delay: 14 days late                    │
│                                         │
│  [✓ Yes, Match This]  [✗ New Transaction]│
└─────────────────────────────────────────┘
```

**If User Confirms Match:**
1. Update scheduled transaction:
   - `status = 'PAID'`
   - `matched_transaction_id = transaction.id`
   - `cleared_date = transaction.date`
2. Create actual transaction normally (affects balance)
3. Both dates preserved for reference

**If User Rejects:**
- Create transaction as normal
- Scheduled transaction remains PENDING

### Critical Balance Rule

**Scheduled transactions NEVER affect account balance.**

- `status = 'PENDING'` → No balance impact (just visibility/reminder)
- `status = 'PAID'` → Matched to actual transaction, that transaction affects balance
- For cheques: Balance changes on `cleared_date`, not `due_date`

---

## Loan/BNPL Account Type

### Account Creation Flow

**UI for Creating Loan Account:**

```
Create New Account
┌─────────────────────────────────────────┐
│ Name: [Tamara - iPhone Purchase]        │
│ Type: [Loan/BNPL ▼]                     │
│ Currency: [AED ▼]                       │
│ Color: [🎨 Picker]                      │
│                                         │
│ 💰 Loan Details:                        │
│ ┌─────────────────────────────────────┐ │
│ │ Principal Amount: [3,000] AED       │ │
│ │ Number of Installments: [4]         │ │
│ │ First Payment Date: [Feb 1, 2026]   │ │
│ │                                     │ │
│ │ Frequency:                          │ │
│ │ ● Monthly                           │ │
│ │ ○ Every 2 weeks                     │ │
│ │ ○ Custom                            │ │
│ │                                     │ │
│ │ ✓ Auto-create scheduled installments│ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Cancel]                    [Create]    │
└─────────────────────────────────────────┘
```

### What Happens When Created

1. **Account Record:**
   ```json
   {
     "id": "uuid",
     "name": "Tamara - iPhone Purchase",
     "type": "Loan/BNPL",
     "currency": "AED",
     "balance": -3000, // Negative = debt owed
     "loan_principal": 3000,
     "loan_installments": 4,
     "loan_start_date": "2026-02-01"
   }
   ```

2. **Auto-Generate 4 Scheduled Transactions:**
   ```
   Installment #1: Feb 1, 2026 - 750 AED (Tamara Installment #1)
   Installment #2: Mar 1, 2026 - 750 AED (Tamara Installment #2)
   Installment #3: Apr 1, 2026 - 750 AED (Tamara Installment #3)
   Installment #4: May 1, 2026 - 750 AED (Tamara Installment #4)
   ```
   - All marked with same `account_id`
   - All `status = 'PENDING'`
   - Merchant = account name + " Installment #X"

3. **When Installment is Paid:**
   - SMS comes in: "Tamara payment 750 AED"
   - Smart matching recognizes it
   - Creates actual EXPENSE transaction
   - Loan balance updates: `-3000 → -2250 → -1500 → -750 → 0`
   - Scheduled installment `status = 'PAID'`

### Account Display

**In Accounts View:**
```
┌─────────────────────────────────────────┐
│ 📱 Tamara - iPhone Purchase             │
│ Loan/BNPL                               │
│                                         │
│ Borrowed: 3,000 AED                     │
│ Paid: 1,500 AED (2/4 installments)     │
│ Remaining: 1,500 AED                    │
│                                         │
│ ████████░░░░ 50%                        │
│                                         │
│ Next Payment: Apr 1, 2026 - 750 AED    │
│                                         │
│ [View Schedule] [Pay Installment]       │
└─────────────────────────────────────────┘
```

**Installment Schedule Modal:**
```
Tamara - iPhone Purchase
Total: 3,000 AED (4 installments)

✅ #1: Feb 1, 2026 - 750 AED (Paid Feb 1)
✅ #2: Mar 1, 2026 - 750 AED (Paid Mar 5)
⏳ #3: Apr 1, 2026 - 750 AED (Pending)
⏳ #4: May 1, 2026 - 750 AED (Pending)

[Close]
```

---

## Balance Reconciliation (Snapshot-Based)

### The Problem

Currently:
- User deletes transaction from Dec 20
- Account balance doesn't auto-adjust
- Over time, balance drifts from actual bank balance

### The Solution

Use SMS balance snapshots (already in `parsedMeta`) as "truth checkpoints."

### How It Works

**1. Capture Snapshots (Already Happening):**

When transaction parsed from SMS:
```json
{
  "parsedMeta": {
    "availableBalance": 15420.50,
    "availableCredit": 8500.00
  }
}
```

This becomes a truth checkpoint tied to transaction date.

**2. Calculate Expected Balance:**

```javascript
function calculateExpectedBalance(accountId) {
  // Find latest transaction with snapshot
  const latestSnapshot = getLatestSnapshotTransaction(accountId);

  // Get all transactions after snapshot
  const transactionsAfter = getTransactionsAfter(
    accountId,
    latestSnapshot.date
  );

  // Calculate: Snapshot + (Income - Expenses) since snapshot
  const delta = transactionsAfter.reduce((sum, t) => {
    return sum + (t.type === 'INCOME' ? t.amount : -t.amount);
  }, 0);

  return latestSnapshot.parsedMeta.availableBalance + delta;
}
```

**3. Detect Discrepancies:**

Run check after every transaction edit/delete:
```javascript
const currentBalance = account.balance;
const expectedBalance = calculateExpectedBalance(account.id);
const difference = Math.abs(currentBalance - expectedBalance);

if (difference > 100 || difference > currentBalance * 0.05) {
  showReconciliationWarning({
    account,
    currentBalance,
    expectedBalance,
    difference,
    lastSnapshot: getLatestSnapshotTransaction(account.id)
  });
}
```

**4. Reconciliation Warning (PROMINENT):**

```
┌─────────────────────────────────────────┐
│  ⚠️ BALANCE MISMATCH DETECTED           │
├─────────────────────────────────────────┤
│  Account: ADCB Mastercard (XXX4532)     │
│                                         │
│  Current Balance: -12,450 AED           │
│  Latest Snapshot: -11,200 AED (Dec 25)  │
│  Calculated Balance: -11,850 AED        │
│                                         │
│  ⚠️ Difference: -600 AED                │
│                                         │
│  Possible Causes:                       │
│  • Missing transaction (Dec 25-29)      │
│  • Edited/deleted transaction           │
│  • Bank fee not recorded                │
│                                         │
│  [Review Transactions]                  │
│  [Accept Calculated (-11,850 AED)]      │
│  [Manually Adjust Balance]              │
└─────────────────────────────────────────┘
```

**5. Display Strategy (PROMINENT):**

**Dashboard (Top Priority):**
```
⚠️ BALANCE MISMATCH DETECTED
2 accounts need reconciliation
[Review Now]
```
- Red/orange banner at top
- Cannot be dismissed until reviewed

**Account Card Badge:**
```
💳 ADCB Mastercard
Balance: -12,450 AED
⚠️ -600 AED discrepancy
[Reconcile]
```

**Blocking Modal (If Large Discrepancy):**
- If difference > 5% of balance or > 500 AED
- Show full-screen modal requiring action
- Must either accept calculated balance or manually adjust

---

## Batch Cheque Creator

### UI Flow

User clicks **"+ Batch Cheques"** in Bills & Debts view:

```
Create Cheque Series
┌─────────────────────────────────────────┐
│ Merchant: [Rent - Landlord Name]        │
│ Amount: [7,000] AED                     │
│ Category: [Housing ▼]                   │
│ Account: [ADCB Current Account ▼]      │
│                                         │
│ First Cheque Date: [Jan 1, 2026]       │
│                                         │
│ Frequency:                              │
│ ○ Monthly                               │
│ ● Every [2] months                      │
│ ○ Every [__] weeks                      │
│                                         │
│ Number of Cheques: [6]                 │
│                                         │
│ Preview:                                │
│ ┌─────────────────────────────────────┐ │
│ │ ✓ Jan 1, 2026 - 7,000 AED           │ │
│ │ ✓ Mar 1, 2026 - 7,000 AED           │ │
│ │ ✓ May 1, 2026 - 7,000 AED           │ │
│ │ ✓ Jul 1, 2026 - 7,000 AED           │ │
│ │ ✓ Sep 1, 2026 - 7,000 AED           │ │
│ │ ✓ Nov 1, 2026 - 7,000 AED           │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Cheque Numbers (optional):              │
│ Starting from: [10001]                  │
│ (Auto-increments: 10001, 10002...)      │
│                                         │
│ Cheque Images (optional):               │
│ ┌─────────────────────────────────────┐ │
│ │ [📷 Scan with Camera] [📁 Upload]   │ │
│ │                                     │ │
│ │ Scanning Options:                   │ │
│ │ • Individual: Scan each separately  │ │
│ │ • Book view: Scan full page         │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Scanned Images:                         │
│ [img] #10001  [img] #10002  [img] #10003│
│ [+ Scan Another]                        │
│                                         │
│ [Cancel]                    [Create]    │
└─────────────────────────────────────────┘
```

### LiveScanner Integration

**Scanning Flow:**

1. User clicks **"📷 Scan with Camera"**
2. `LiveScanner` component opens (reuse from Warranties)
3. User can:
   - **Individual mode:** Scan one cheque at a time (6 separate scans)
   - **Book mode:** Scan full cheque book page (multi-segment stitching)
4. Each captured image mapped to cheque:
   - First scan → Cheque #10001
   - Second scan → Cheque #10002
   - etc.
5. Can rescan/replace any image before creating

**Technical:**
- Reuse existing `components/LiveScanner.tsx`
- Images stored as base64 in `scheduled_transactions.cheque_image`
- Included in backup/restore system

### What Happens When Created

1. **6 Scheduled Transactions Created:**
   ```json
   [
     {
       "id": "uuid-1",
       "merchant": "Rent - Landlord Name",
       "amount": 7000,
       "due_date": "2026-01-01",
       "is_cheque": true,
       "cheque_number": "10001",
       "cheque_image": "data:image/jpeg;base64,...",
       "series_id": "series-uuid",
       "status": "PENDING"
     },
     // ... 5 more
   ]
   ```

2. **Series Linked:** All share same `series_id` for group management

3. **Displayed in Bills & Debts:**
   ```
   📋 Cheque Series
   ┌─────────────────────────────────────┐
   │ Rent 2026 (Landlord Name)           │
   │ 4/6 cashed                          │
   │ Next: Jul 1, 2026 - #10005          │
   │ [View All] [Edit Series]            │
   └─────────────────────────────────────┘
   ```

### Viewing Cheque Details

Click on individual cheque:
```
Rent Cheque #10001
┌─────────────────────────────────────┐
│ Amount: 7,000 AED                   │
│ Due Date: Jan 1, 2026               │
│ Status: Cashed                      │
│ Cleared: Jan 15, 2026 (14 days late)│
│                                     │
│ [📷 View Cheque Image]              │
│                                     │
│ Linked Transaction:                 │
│ Jan 15, 2026 - Rent Payment         │
│ -7,000 AED                          │
│                                     │
│ [Edit] [Delete]                     │
└─────────────────────────────────────┘
```

---

## Bills & Debts View (New)

### Navigation

Add new item to radial navigation between **Planning** and **Warranties**:
- Icon: 📋 or 💰
- Label: "Bills & Debts"
- Badge: Red count of overdue items (if any)

### View Layout

```
Bills & Debts
┌─────────────────────────────────────────┐
│ [+ New Scheduled] [+ Batch Cheques]     │
├─────────────────────────────────────────┤
│                                         │
│ 🚨 Overdue (2)                          │
│ ┌─────────────────────────────────────┐ │
│ │ 2 days ago • Electricity Bill       │ │
│ │ 450 AED                             │ │
│ │ [Mark Paid] [Skip]                  │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 5 days ago • Internet Bill          │ │
│ │ 299 AED                             │ │
│ │ [Mark Paid] [Skip]                  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 📅 Upcoming (Next 30 Days)              │
│ ┌─────────────────────────────────────┐ │
│ │ Tomorrow • Tamara Installment #3    │ │
│ │ 750 AED                             │ │
│ │ [Quick Pay]                         │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Jan 15 • Rent Cheque #10003         │ │
│ │ 7,000 AED • [View Image]            │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Feb 1 • Salary (Expected)           │ │
│ │ 12,000 AED                          │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 📋 Cheque Series                        │
│ ┌─────────────────────────────────────┐ │
│ │ Rent 2026 (Landlord Name)           │ │
│ │ 4/6 cashed                          │ │
│ │ Next: Jul 1 - #10005 - 7,000 AED    │ │
│ │ [View All]                          │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 💰 Recurring                            │
│ ┌─────────────────────────────────────┐ │
│ │ Monthly Salary - 12,000 AED         │ │
│ │ Every 1st of month                  │ │
│ │ Last paid: Dec 1, 2025              │ │
│ └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Sections Priority

1. **Overdue** (most urgent, red)
2. **Upcoming** (next 30 days)
3. **Cheque Series** (grouped view)
4. **Recurring** (ongoing expectations)

### Interactive Actions

**Mark Paid:**
- Opens transaction form pre-filled with scheduled details
- User can adjust amount/date if needed
- On save, triggers smart matching flow

**Quick Pay:**
- One-tap to create transaction matching scheduled item exactly
- Still triggers matching confirmation

**Skip:**
- Marks scheduled transaction as SKIPPED
- Prompts for reason (optional)
- Removes from upcoming list

---

## Dashboard Integration

### Updated Dashboard Layout

```
Dashboard
┌─────────────────────────────────────────┐
│ ⚠️ BALANCE MISMATCH DETECTED            │
│ 2 accounts need reconciliation          │
│ [Review Now]                            │
├─────────────────────────────────────────┤
│ Summary Cards                           │
│ [Total Income] [Total Expenses] [Net]   │
├─────────────────────────────────────────┤
│ 🚨 Overdue Bills (2)                    │
│ ┌─────────────────────────────────────┐ │
│ │ Electricity - 450 AED (2 days ago)  │ │
│ │ [Pay Now]                           │ │
│ └─────────────────────────────────────┘ │
│ [View All Overdue →]                    │
├─────────────────────────────────────────┤
│ 📅 Upcoming Bills (Next 7 Days)         │
│ ┌─────────────────────────────────────┐ │
│ │ Tomorrow • Tamara Installment       │ │
│ │ 750 AED                             │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Jan 15 • Rent Cheque                │ │
│ │ 7,000 AED                           │ │
│ └─────────────────────────────────────┘ │
│ [View All Bills →]                      │
├─────────────────────────────────────────┤
│ 💳 Loan Accounts                        │
│ ┌─────────────────────────────────────┐ │
│ │ 📱 Tamara - iPhone                  │ │
│ │ 1,500 / 3,000 AED paid              │ │
│ │ ████████░░░░ 50%                    │ │
│ │ Next: Feb 1 - 750 AED               │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 🛍️ Tabby - Laptop                   │ │
│ │ 2,400 / 4,000 AED paid              │ │
│ │ ████████████░ 60%                   │ │
│ │ Next: Jan 28 - 800 AED              │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ Spending by Category                    │
│ [Charts...]                             │
└─────────────────────────────────────────┘
```

### Priority Order

1. **Balance Mismatch** (top, can't miss, blocking if severe)
2. **Overdue Bills** (urgent, red)
3. **Upcoming Bills** (next 7 days only)
4. **Loan Summaries** (active loans)
5. **Existing Content** (stats, charts)

### Navigation Badge

```
Bills & Debts (3) ← Red badge showing overdue count
```

Only shows if overdue items exist.

---

## Implementation Notes

### TypeScript Types

Add to `types.ts`:

```typescript
export interface ScheduledTransaction {
  id: string;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  type: TransactionType;
  accountId?: string;

  // Scheduling
  dueDate: string; // ISO date
  recurrencePattern?: 'ONCE' | 'MONTHLY' | 'WEEKLY' | 'CUSTOM';
  recurrenceInterval?: number;
  recurrenceEndDate?: string;

  // Status
  status: 'PENDING' | 'PAID' | 'SKIPPED' | 'OVERDUE';
  matchedTransactionId?: string;
  clearedDate?: string; // Actual date paid

  // Cheque specific
  isCheque?: boolean;
  chequeNumber?: string;
  chequeImage?: string; // Base64
  seriesId?: string;

  notes?: string;
}

// Add to Account interface
export interface Account {
  // ... existing fields

  // For Loan/BNPL accounts
  loanPrincipal?: number;
  loanInstallments?: number;
  loanStartDate?: string;
}

// Update AccountType
export type AccountType = 'Bank' | 'Credit Card' | 'Cash' | 'Wallet' | 'Loan/BNPL' | 'Other';
```

### Component Structure

New components to create:

```
components/
├─ BillsDebtsView.tsx           # Main view
├─ ScheduledTransactionCard.tsx # Individual item card
├─ BatchChequeCreator.tsx       # Batch creator modal
├─ ReconciliationWarning.tsx    # Balance mismatch alert
├─ LoanAccountCard.tsx          # Loan account display
├─ InstallmentScheduleModal.tsx # View loan schedule
└─ ScheduledTransactionForm.tsx # Create/edit single scheduled item
```

### Services

New service files:

```
services/
├─ scheduledTransactionsService.ts # CRUD for scheduled transactions
├─ matchingService.ts              # Smart matching algorithm
└─ reconciliationService.ts        # Balance reconciliation logic
```

### Database Migration

Create SQL migration file: `supabase/migrations/YYYYMMDD_scheduled_transactions.sql`

Include:
1. Create `scheduled_transactions` table
2. Modify `accounts` table
3. Create indexes
4. Add RLS policies
5. Create triggers for auto-updating statuses

### Backup Integration

Update `services/backupService.ts`:
- Include `scheduled_transactions` in export
- Include cheque images (base64)
- Restore scheduled transactions on import

---

## Testing Scenarios

### 1. Salary Matching (Early/Late)
- Create scheduled: Salary, 12,000 AED, due Feb 1
- Test: SMS comes Jan 28 (early) → Should match
- Test: SMS comes Feb 5 (late) → Should match
- Test: Wrong amount (11,500) → Should NOT auto-match, suggest only

### 2. Postdated Cheque
- Create cheque series: 6 cheques, every 2 months
- Verify: All 6 created with correct dates
- Test: Landlord cashes cheque 15 days late
- Verify: Both dates stored, balance only changes on cleared_date

### 3. Tamara Loan
- Create Tamara account: 3,000 AED, 4 installments
- Verify: 4 scheduled transactions auto-created
- Test: Pay first installment
- Verify: Balance -3000 → -2250
- Verify: Progress shows 1/4 paid

### 4. Balance Reconciliation
- Create account with snapshot balance
- Delete old transaction
- Verify: Reconciliation warning appears
- Test: Accept calculated balance
- Verify: Balance updated correctly

### 5. Batch Cheque with Images
- Create cheque series with LiveScanner
- Scan 6 individual cheques
- Verify: Each cheque has correct image
- Test: Backup and restore
- Verify: Images preserved

---

## Success Metrics

**User Goals Achieved:**
- ✅ Track postdated cheques (rent, etc.) without manual entry
- ✅ Handle late/early payments intelligently (no duplicates)
- ✅ Monitor loan balances and installments automatically
- ✅ Catch balance discrepancies immediately (prominent warnings)
- ✅ Visual proof of cheques (images backed up)

**Technical Goals:**
- ✅ Scheduled transactions never double-count in balances
- ✅ Smart matching reduces duplicate entries
- ✅ Snapshot-based reconciliation prevents drift
- ✅ Loan accounts integrate seamlessly with existing account types
- ✅ Cheque images included in backup system

---

## Future Enhancements (Post-MVP)

1. **Notifications:** Push notifications for upcoming/overdue bills
2. **Recurring Patterns:** More complex patterns (e.g., "last Friday of month")
3. **Payment Links:** Direct integration with Tamara/Tabby APIs for one-tap pay
4. **Analytics:** Spending forecast based on scheduled transactions
5. **Auto-categorization:** Learn from matched transactions to improve future matching
6. **Multi-currency Loans:** Handle loans in different currencies with exchange rates

---

## Ready for Implementation

This design is approved and ready for implementation. Next steps:

1. Create git branch: `feature/bills-debts-loans`
2. Use `superpowers:writing-plans` to create detailed implementation plan
3. Execute plan with `superpowers:executing-plans` or `superpowers:subagent-driven-development`
