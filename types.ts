export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
  TRANSFER = 'TRANSFER', // Added for specific styling if needed, though usually modeled as pair of EXPENSE/INCOME
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string; // Icon name from library
  isDefault?: boolean;
  monthlyBudget?: number; // Added for budgeting
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

export type Frequency = 'MONTHLY' | 'WEEKLY' | 'YEARLY';

export interface RecurringRule {
  id: string;
  merchantKeyword: string;
  category?: string;
  type?: TransactionType; // EXPENSE, INCOME, or TRANSFER

  // Advanced Billing Details
  frequency?: Frequency;
  dueDay?: number; // Day of month (1-31)
  avgAmount?: number; // Expected amount for alerts
  lastPaidDate?: string; // ISO Date to track parsing hits
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  color: string;
  deadline?: string;
  icon?: string;
}

export interface WarrantyItem {
  id: string;
  name: string;
  merchant?: string;
  purchaseDate: string; // ISO Date
  warrantyDurationMonths: number; // Duration in months
  receiptImage?: string; // Base64
  price?: number;
  notes?: string;
  // Calculated on render, but good to have explicit override if needed
  customExpirationDate?: string;
}

export interface AppSettings {
  baseCurrency: string;
  categories: Category[];
  accounts: Account[];
  recurringRules: RecurringRule[];
  savingsGoals: SavingsGoal[];
  warranties: WarrantyItem[];
}

export interface Transaction {
  id: string;
  groupId?: string; // Links multiple split transactions together
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

  // New: For split transactions to reference the original
  splitParent?: {
    merchant: string;
    totalAmount: number;
  };

  isTransfer?: boolean; // New flag to identify transfers
}

export type View = 'dashboard' | 'accounts' | 'categories' | 'add' | 'history' | 'settings' | 'calendar' | 'planning' | 'warranties';

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