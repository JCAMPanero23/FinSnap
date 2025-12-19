import { supabase } from '../lib/supabase';
import {
  saveTransaction,
  saveAccount,
  saveCategory,
  saveRecurringRule,
  saveWarranty,
  saveSetting,
  getSetting,
} from './indexedDBService';
import { Transaction, Account, Category, RecurringRule, WarrantyItem } from '../types';

const MIGRATION_COMPLETED_KEY = 'migrationCompleted';

export async function needsMigration(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;

  const completed = await getSetting(MIGRATION_COMPLETED_KEY);
  if (completed === true) return false;

  // Check if IndexedDB is empty (needs migration)
  const { getAllTransactions } = await import('./indexedDBService');
  const txns = await getAllTransactions();
  return txns.length === 0;
}

export async function migrateFromSupabase(userId: string): Promise<void> {
  console.log('Starting migration from Supabase to IndexedDB...');

  try {
    // Fetch user settings
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('base_currency, gradient_start_color, gradient_end_color, gradient_angle')
      .eq('id', userId)
      .single();

    if (userSettings) {
      await saveSetting('baseCurrency', userSettings.base_currency || 'USD');
      await saveSetting('gradientStartColor', userSettings.gradient_start_color || '#d0dddf');
      await saveSetting('gradientEndColor', userSettings.gradient_end_color || '#dcfefb');
      await saveSetting('gradientAngle', userSettings.gradient_angle || 135);
    }

    // Fetch and save categories
    const { data: categories } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at');

    if (categories) {
      for (const cat of categories) {
        const category: Category = {
          id: cat.id,
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
          isDefault: cat.is_default,
          monthlyBudget: cat.monthly_budget,
        };
        await saveCategory(category);
      }
      console.log(`Migrated ${categories.length} categories`);
    }

    // Fetch and save accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at');

    if (accounts) {
      for (const acc of accounts) {
        const account: Account = {
          id: acc.id,
          name: acc.name,
          type: acc.type,
          last4Digits: acc.last4_digits,
          color: acc.color,
          currency: acc.currency,
          balance: acc.balance,
          autoUpdateBalance: acc.auto_update_balance,
          totalCreditLimit: acc.total_credit_limit,
          monthlySpendingLimit: acc.monthly_spending_limit,
          paymentDueDay: acc.payment_due_day,
        };
        await saveAccount(account);
      }
      console.log(`Migrated ${accounts.length} accounts`);
    }

    // Fetch and save recurring rules
    const { data: rules } = await supabase
      .from('recurring_rules')
      .select('*')
      .eq('user_id', userId);

    if (rules) {
      for (const rule of rules) {
        const recurringRule: RecurringRule = {
          id: rule.id,
          merchantKeyword: rule.merchant_keyword,
          category: rule.category,
          type: rule.type,
          frequency: rule.frequency,
          dueDay: rule.due_day,
          avgAmount: rule.avg_amount,
          lastPaidDate: rule.last_paid_date,
        };
        await saveRecurringRule(recurringRule);
      }
      console.log(`Migrated ${rules.length} recurring rules`);
    }

    // Fetch and save transactions
    const { data: txns } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (txns) {
      for (const tx of txns) {
        const transaction: Transaction = {
          id: tx.id,
          groupId: tx.group_id,
          amount: tx.amount,
          currency: tx.currency,
          originalAmount: tx.original_amount,
          originalCurrency: tx.original_currency,
          exchangeRate: tx.exchange_rate,
          merchant: tx.merchant,
          date: tx.date,
          time: tx.time,
          category: tx.category,
          type: tx.type,
          account: tx.account,
          accountId: tx.account_id,
          rawText: tx.raw_text,
          tags: tx.tags,
          parsedMeta: tx.parsed_meta,
          splitParent: tx.split_parent,
          isTransfer: tx.is_transfer,
        };
        await saveTransaction(transaction);
      }
      console.log(`Migrated ${txns.length} transactions`);
    }

    // Mark migration as completed
    await saveSetting(MIGRATION_COMPLETED_KEY, true);
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw new Error('Failed to migrate data from Supabase');
  }
}

export async function resetMigration(): Promise<void> {
  await saveSetting(MIGRATION_COMPLETED_KEY, false);
}
