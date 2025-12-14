export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
  TRANSFER = 'TRANSFER', // Added for specific styling if needed, though usually modeled as pair of EXPENSE/INCOME
}

export interface Category {
  id: string;
  name: string;
  color: string;
  isDefault?: boolean;
}

export type AccountType = 'Bank' | 'Credit Card' | 'Cash' | 'Wallet' | 'Other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  last4Digits?: string;
  color: string;
  currency: string;
  
  // Financial Status
  balance: number; // Positive = Asset (Bank), Negative = Liability (Credit Card Debt)
  autoUpdateBalance?: boolean; // If true, parse balance/limit from SMS and update this field
  
  // Limits & Settings
  totalCreditLimit?: number; // Max limit for credit cards (Required to calc debt from Avl Limit)
  monthlySpendingLimit?: number; // Budget warning threshold
  paymentDueDay?: number; // Day of month (1-31) for credit card payments
}

export interface RecurringRule {
  id: string;
  merchantKeyword: string;
  category?: string;
  type?: TransactionType; // EXPENSE, INCOME, or TRANSFER
}

export interface AppSettings {
  baseCurrency: string;
  categories: Category[];
  accounts: Account[];
  recurringRules: RecurringRule[];
}

export interface Transaction {
  id: string;
  amount: number; // Value in Base Currency
  currency: string; // Base Currency code
  
  originalAmount?: number; // Value in original currency
  originalCurrency?: string; // Original currency code
  exchangeRate?: number; // Rate used for conversion
  
  merchant: string;
  date: string; // ISO String YYYY-MM-DD
  time?: string; // HH:mm
  category: string;
  type: TransactionType;
  account?: string; // Snapshot of account name or raw text
  accountId?: string; // Reference to configured account
  rawText?: string;
  tags?: string[];
  
  // New: Snapshot of account status found in the message
  parsedMeta?: {
    availableBalance?: number;
    availableCredit?: number;
  };
  
  isTransfer?: boolean; // New flag to identify transfers
}

export type View = 'dashboard' | 'accounts' | 'add' | 'history' | 'settings' | 'calendar';

export interface CategoryStat {
  name: string;
  value: number;
  color: string;
}

export interface MonthlyStat {
  name: string;
  income: number;
  expense: number;
}