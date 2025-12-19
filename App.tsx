import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, PlusCircle, History, Settings, Wallet, CalendarRange, LogOut, Target, Shield, Tags } from 'lucide-react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import ResetPassword from './components/ResetPassword';
import Dashboard from './components/Dashboard';
import AddTransaction from './components/AddTransaction';
import TransactionList from './components/TransactionList';
import EditTransactionModal from './components/EditTransactionModal';
import SettingsView from './components/SettingsView';
import AccountsView from './components/AccountsView';
import CalendarView from './components/CalendarView';
import PlanningView from './components/PlanningView';
import CategoriesView from './components/CategoriesView';
import WarrantiesView from './components/WarrantiesView';
import BottomTabs from './components/BottomTabs';
import NavigationDrawer from './components/NavigationDrawer';
import { Transaction, View, AppSettings, TransactionType, Category, Account, RecurringRule, SavingsGoal, WarrantyItem } from './types';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_SETTINGS: AppSettings = {
  baseCurrency: 'USD',
  categories: [],
  accounts: [],
  recurringRules: [],
  savingsGoals: [],
  warranties: [],
  gradientStartColor: '#d0dddf',
  gradientEndColor: '#dcfefb',
  gradientAngle: 135
};

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isResetPasswordPage, setIsResetPasswordPage] = useState(false);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    baseCurrency: 'USD',
    categories: [],
    accounts: [],
    recurringRules: [],
    savingsGoals: [],
    warranties: [],
    gradientStartColor: '#d0dddf',
    gradientEndColor: '#dcfefb',
    gradientAngle: 135
  });
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<'month' | 'year' | 'week' | 'custom' | 'all'>('month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Navigation offsets (0 = current, -1 = previous, +1 = next)
  const [monthOffset, setMonthOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);

  // Check if on reset password page
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || window.location.pathname === '/reset-password') {
      setIsResetPasswordPage(true);
      setLoading(false);
    }
  }, []);

  // Check auth session on mount
  useEffect(() => {
    if (!isResetPasswordPage) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
      });

      return () => subscription.unsubscribe();
    }
  }, [isResetPasswordPage]);

  // Load user data when authenticated
  useEffect(() => {
    if (session?.user) {
      loadUserData();
    }
  }, [session]);

  // Filter transactions based on date filter
  const filteredTransactions = useMemo(() => {
    if (dateFilter === 'all') {
      return transactions;
    }

    const now = new Date();

    return transactions.filter(t => {
      const [yStr, mStr, dStr] = t.date.split('-');
      const txYear = parseInt(yStr);
      const txMonth = parseInt(mStr) - 1; // 0-indexed
      const txDay = parseInt(dStr);
      const txDate = new Date(txYear, txMonth, txDay);

      switch (dateFilter) {
        case 'month': {
          // Calculate target month with offset
          const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
          const targetYear = targetDate.getFullYear();
          const targetMonth = targetDate.getMonth();
          return txYear === targetYear && txMonth === targetMonth;
        }

        case 'year': {
          const targetYear = now.getFullYear() + yearOffset;
          return txYear === targetYear;
        }

        case 'week': {
          // Get start of target week
          const targetWeekStart = new Date(now);
          targetWeekStart.setDate(now.getDate() + (weekOffset * 7) - now.getDay());
          targetWeekStart.setHours(0, 0, 0, 0);

          // Get end of target week
          const targetWeekEnd = new Date(targetWeekStart);
          targetWeekEnd.setDate(targetWeekStart.getDate() + 6);
          targetWeekEnd.setHours(23, 59, 59, 999);

          return txDate >= targetWeekStart && txDate <= targetWeekEnd;
        }

        case 'custom': {
          if (!customStartDate || !customEndDate) return true;

          const startDate = new Date(customStartDate);
          const endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);

          return txDate >= startDate && txDate <= endDate;
        }

        default:
          return true;
      }
    });
  }, [transactions, dateFilter, monthOffset, yearOffset, weekOffset, customStartDate, customEndDate]);

  const loadUserData = async () => {
    try {
      const userId = session?.user?.id;
      if (!userId) return;

      // Load settings (gradient columns may not exist in database yet)
      let userSettings = null;
      const settingsResult = await supabase
        .from('user_settings')
        .select('base_currency, gradient_start_color, gradient_end_color, gradient_angle')
        .eq('id', userId)
        .single();

      if (settingsResult.error) {
        // If gradient columns don't exist, fall back to base_currency only
        console.log('Gradient columns not found, using defaults:', settingsResult.error.message);
        const fallbackResult = await supabase
          .from('user_settings')
          .select('base_currency')
          .eq('id', userId)
          .single();
        userSettings = fallbackResult.data;
      } else {
        userSettings = settingsResult.data;
      }

      // Load categories
      const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at');

      // Load accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at');

      // Load recurring rules
      const { data: rules } = await supabase
        .from('recurring_rules')
        .select('*')
        .eq('user_id', userId);

      // Load transactions
      const { data: txns } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      // Map database data to app format
      const mappedCategories: Category[] = (categories || []).map(c => ({
        id: c.id,
        name: c.name,
        color: c.color,
        isDefault: c.is_default
      }));

      const mappedAccounts: Account[] = (accounts || []).map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        last4Digits: a.last_4_digits,
        color: a.color,
        currency: a.currency,
        balance: parseFloat(a.balance),
        autoUpdateBalance: a.auto_update_balance,
        totalCreditLimit: a.total_credit_limit ? parseFloat(a.total_credit_limit) : undefined,
        monthlySpendingLimit: a.monthly_spending_limit ? parseFloat(a.monthly_spending_limit) : undefined,
        paymentDueDay: a.payment_due_day
      }));

      const mappedRules: RecurringRule[] = (rules || []).map(r => ({
        id: r.id,
        merchantKeyword: r.merchant_keyword,
        category: r.category,
        type: r.type
      }));

      const mappedTransactions: Transaction[] = (txns || []).map(t => ({
        id: t.id,
        amount: parseFloat(t.amount),
        currency: t.currency,
        originalAmount: t.original_amount ? parseFloat(t.original_amount) : undefined,
        originalCurrency: t.original_currency,
        exchangeRate: t.exchange_rate ? parseFloat(t.exchange_rate) : undefined,
        merchant: t.merchant,
        date: t.date,
        time: t.time,
        category: t.category,
        type: t.type,
        account: t.account,
        accountId: t.account_id,
        rawText: t.raw_text,
        tags: t.tags,
        parsedMeta: t.parsed_meta,
        isTransfer: t.is_transfer
      }));

      setSettings({
        baseCurrency: userSettings?.base_currency || 'USD',
        categories: mappedCategories,
        accounts: mappedAccounts,
        recurringRules: mappedRules,
        savingsGoals: [], // TODO: Load from database when table is created
        warranties: [], // TODO: Load from database when table is created
        gradientStartColor: userSettings?.gradient_start_color || '#d0dddf',
        gradientEndColor: userSettings?.gradient_end_color || '#dcfefb',
        gradientAngle: userSettings?.gradient_angle || 135
      });

      setTransactions(mappedTransactions);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  // Helper: Check if transaction should update balance (compare to most recent transaction)
  const shouldUpdateBalance = (transaction: Transaction, accountId: string): boolean => {
    // Find most recent transaction for this account
    const accountTransactions = transactions.filter(t => t.accountId === accountId);

    // If no existing transactions for this account, always update
    if (accountTransactions.length === 0) return true;

    // Find the most recent transaction date
    const mostRecentTxn = accountTransactions.reduce((latest, current) => {
      const latestDateTime = `${latest.date} ${latest.time || '00:00'}`;
      const currentDateTime = `${current.date} ${current.time || '00:00'}`;
      return currentDateTime > latestDateTime ? current : latest;
    });

    const mostRecentDateTime = `${mostRecentTxn.date} ${mostRecentTxn.time || '00:00'}`;
    const newTxnDateTime = `${transaction.date} ${transaction.time || '00:00'}`;

    // Update balance only if new transaction is >= most recent
    return newTxnDateTime >= mostRecentDateTime;
  };

  const handleAddTransactions = async (newTransactions: Transaction[]) => {
    try {
      const userId = session?.user?.id;
      if (!userId) return;

      // 1. Insert transactions into database
      const txnsToInsert = newTransactions.map(t => ({
        user_id: userId,
        amount: t.amount,
        currency: t.currency,
        original_amount: t.originalAmount,
        original_currency: t.originalCurrency,
        exchange_rate: t.exchangeRate,
        merchant: t.merchant,
        date: t.date,
        time: t.time,
        category: t.category,
        type: t.type,
        account: t.account,
        account_id: t.accountId,
        raw_text: t.rawText,
        tags: t.tags,
        parsed_meta: t.parsedMeta,
        is_transfer: t.isTransfer
      }));

      const { data: insertedTxns, error } = await supabase
        .from('transactions')
        .insert(txnsToInsert)
        .select();

      if (error) throw error;

      // 2. Update Account Balances
      const updatedAccounts = [...settings.accounts];
      let accountsChanged = false;

      newTransactions.forEach(t => {
        const accIndex = t.accountId ? updatedAccounts.findIndex(a => a.id === t.accountId) : -1;

        if (accIndex !== -1) {
          const acc = updatedAccounts[accIndex];

          // Smart balance update: Only update if transaction is recent
          const shouldUpdate = shouldUpdateBalance(t, t.accountId!);

          if (shouldUpdate) {
            let balanceUpdatedViaSnapshot = false;

            if (acc.autoUpdateBalance !== false && t.parsedMeta) {
              if (t.parsedMeta.availableCredit !== undefined && acc.totalCreditLimit) {
                acc.balance = -(acc.totalCreditLimit - t.parsedMeta.availableCredit);
                balanceUpdatedViaSnapshot = true;
              } else if (t.parsedMeta.availableBalance !== undefined) {
                acc.balance = t.parsedMeta.availableBalance;
                balanceUpdatedViaSnapshot = true;
              }
            }

            if (!balanceUpdatedViaSnapshot) {
              if (t.type === TransactionType.EXPENSE) {
                acc.balance -= t.amount;
              } else if (t.type === TransactionType.INCOME) {
                acc.balance += t.amount;
              }
            }
            accountsChanged = true;
          }
        }
      });

      // 3. Update accounts in database
      if (accountsChanged) {
        for (const acc of updatedAccounts) {
          await supabase
            .from('accounts')
            .update({ balance: acc.balance })
            .eq('id', acc.id);
        }
      }

      // 4. Update local state
      const mappedInserted: Transaction[] = (insertedTxns || []).map(t => ({
        id: t.id,
        amount: parseFloat(t.amount),
        currency: t.currency,
        originalAmount: t.original_amount ? parseFloat(t.original_amount) : undefined,
        originalCurrency: t.original_currency,
        exchangeRate: t.exchange_rate ? parseFloat(t.exchange_rate) : undefined,
        merchant: t.merchant,
        date: t.date,
        time: t.time,
        category: t.category,
        type: t.type,
        account: t.account,
        accountId: t.account_id,
        rawText: t.raw_text,
        tags: t.tags,
        parsedMeta: t.parsed_meta,
        isTransfer: t.is_transfer
      }));

      setTransactions(prev => [...mappedInserted, ...prev]);
      setSettings(prev => ({ ...prev, accounts: updatedAccounts }));
      setCurrentView('dashboard');
    } catch (error) {
      console.error('Error adding transactions:', error);
      alert('Failed to add transactions. Please try again.');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this transaction?")) {
      try {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', id);

        if (error) throw error;

        setTransactions(prev => prev.filter(t => t.id !== id));
      } catch (error) {
        console.error('Error deleting transaction:', error);
        alert('Failed to delete transaction. Please try again.');
      }
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  };

  const handleUpdateTransaction = async (updatedTransaction: Transaction) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          amount: updatedTransaction.amount,
          currency: updatedTransaction.currency,
          original_amount: updatedTransaction.originalAmount,
          original_currency: updatedTransaction.originalCurrency,
          exchange_rate: updatedTransaction.exchangeRate,
          merchant: updatedTransaction.merchant,
          date: updatedTransaction.date,
          time: updatedTransaction.time,
          category: updatedTransaction.category,
          type: updatedTransaction.type,
          account: updatedTransaction.account,
          account_id: updatedTransaction.accountId,
          raw_text: updatedTransaction.rawText,
          tags: updatedTransaction.tags,
          parsed_meta: updatedTransaction.parsedMeta,
          is_transfer: updatedTransaction.isTransfer
        })
        .eq('id', updatedTransaction.id);

      if (error) throw error;

      setTransactions(prev => prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t));
      setEditingTransaction(null);
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Failed to update transaction. Please try again.');
    }
  };

  const handleAddRuleFromTransaction = async (merchant: string, category: string, type: TransactionType) => {
    try {
      const userId = session?.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from('recurring_rules')
        .insert({
          user_id: userId,
          merchant_keyword: merchant,
          category,
          type
        })
        .select()
        .single();

      if (error) throw error;

      const newRule: RecurringRule = {
        id: data.id,
        merchantKeyword: data.merchant_keyword,
        category: data.category,
        type: data.type
      };

      setSettings(prev => ({
        ...prev,
        recurringRules: [...prev.recurringRules, newRule]
      }));
    } catch (error) {
      console.error('Error adding recurring rule:', error);
    }
  };

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
    setCurrentView('history');
  };

  const handleUpdateSettings = async (newSettings: AppSettings, accountReplacements?: { newAccountId: string, replaceAccountId: string | 'ORPHANS' }[]) => {
    try {
      const userId = session?.user?.id;
      if (!userId) return;

      // Handle Developer Reset Actions
      if ((newSettings as any).__resetTransactions) {
        // Soft Reset - Delete all transactions and reset account balances to 0
        await supabase.from('transactions').delete().eq('user_id', userId);

        // Reset all account balances to 0
        const { data: userAccounts } = await supabase
          .from('accounts')
          .select('id')
          .eq('user_id', userId);

        if (userAccounts) {
          for (const acc of userAccounts) {
            await supabase
              .from('accounts')
              .update({ balance: 0 })
              .eq('id', acc.id);
          }
        }

        setTransactions([]);
        // Reload user data to get updated balances
        await loadUserData();
        return;
      }

      if ((newSettings as any).__resetToDefault) {
        // Hard Reset - Delete all user data
        await supabase.from('transactions').delete().eq('user_id', userId);
        await supabase.from('recurring_rules').delete().eq('user_id', userId);
        await supabase.from('accounts').delete().eq('user_id', userId);
        await supabase.from('categories').delete().eq('user_id', userId);
        await supabase.from('user_settings').delete().eq('user_id', userId);

        // Reset to defaults
        setTransactions([]);
        setSettings(DEFAULT_SETTINGS);
        return;
      }

      // Update categories
      for (const category of newSettings.categories) {
        const existingCategory = settings.categories.find(c => c.id === category.id);
        if (!existingCategory) {
          // New category - insert
          await supabase.from('categories').insert({
            id: category.id,
            user_id: userId,
            name: category.name,
            color: category.color,
            is_default: category.isDefault || false
          });
        } else if (JSON.stringify(existingCategory) !== JSON.stringify(category)) {
          // Updated category - update
          await supabase.from('categories').update({
            name: category.name,
            color: category.color,
            is_default: category.isDefault || false
          }).eq('id', category.id);
        }
      }

      // Delete removed categories
      const removedCategories = settings.categories.filter(
        c => !newSettings.categories.find(nc => nc.id === c.id)
      );
      for (const category of removedCategories) {
        await supabase.from('categories').delete().eq('id', category.id);
      }

      // Update accounts
      for (const account of newSettings.accounts) {
        const existingAccount = settings.accounts.find(a => a.id === account.id);
        if (!existingAccount) {
          // New account - insert
          await supabase.from('accounts').insert({
            id: account.id,
            user_id: userId,
            name: account.name,
            type: account.type,
            last_4_digits: account.last4Digits,
            color: account.color,
            currency: account.currency,
            balance: account.balance,
            total_credit_limit: account.totalCreditLimit,
            monthly_spending_limit: account.monthlySpendingLimit,
            payment_due_day: account.paymentDueDay,
            auto_update_balance: account.autoUpdateBalance !== false
          });
        } else {
          // Updated account - update
          await supabase.from('accounts').update({
            name: account.name,
            type: account.type,
            last_4_digits: account.last4Digits,
            color: account.color,
            currency: account.currency,
            balance: account.balance,
            total_credit_limit: account.totalCreditLimit,
            monthly_spending_limit: account.monthlySpendingLimit,
            payment_due_day: account.paymentDueDay,
            auto_update_balance: account.autoUpdateBalance !== false
          }).eq('id', account.id);
        }
      }

      // Auto-link orphaned transactions by last4Digits
      for (const account of newSettings.accounts) {
        if (account.last4Digits) {
          // Find orphaned transactions that match this account's last4Digits
          const { data: orphanedTxns } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .is('account_id', null);

          if (orphanedTxns && orphanedTxns.length > 0) {
            // Filter transactions where the account field contains the last4Digits
            const matchingTxns = orphanedTxns.filter(t =>
              t.account && t.account.includes(account.last4Digits!)
            );

            // Update matching transactions to link them to this account
            for (const txn of matchingTxns) {
              await supabase
                .from('transactions')
                .update({ account_id: account.id })
                .eq('id', txn.id);
            }

            if (matchingTxns.length > 0) {
              console.log(`Auto-linked ${matchingTxns.length} transactions to account ${account.name}`);
            }
          }
        }
      }

      // Handle account replacements (manual reassignment)
      if (accountReplacements && accountReplacements.length > 0) {
        for (const replacement of accountReplacements) {
          if (replacement.replaceAccountId === 'ORPHANS') {
            // Reassign all orphaned transactions to the new account
            await supabase
              .from('transactions')
              .update({ account_id: replacement.newAccountId })
              .eq('user_id', userId)
              .is('account_id', null);

            console.log(`Reassigned orphaned transactions to account ${replacement.newAccountId}`);
          } else {
            // Reassign all transactions from old account to new account
            await supabase
              .from('transactions')
              .update({ account_id: replacement.newAccountId })
              .eq('user_id', userId)
              .eq('account_id', replacement.replaceAccountId);

            console.log(`Reassigned transactions from ${replacement.replaceAccountId} to ${replacement.newAccountId}`);
          }
        }

        // Reload transactions to reflect changes
        const { data: updatedTransactions } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false });

        if (updatedTransactions) {
          setTransactions(updatedTransactions.map(t => ({
            id: t.id,
            groupId: t.group_id,
            amount: t.amount,
            currency: t.currency,
            originalAmount: t.original_amount,
            originalCurrency: t.original_currency,
            exchangeRate: t.exchange_rate,
            merchant: t.merchant,
            date: t.date,
            time: t.time,
            category: t.category,
            type: t.type as TransactionType,
            account: t.account,
            accountId: t.account_id,
            rawText: t.raw_text,
            tags: t.tags,
            parsedMeta: t.parsed_meta,
            isTransfer: t.is_transfer
          })));
        }
      }

      // Delete removed accounts
      const removedAccounts = settings.accounts.filter(
        a => !newSettings.accounts.find(na => na.id === a.id)
      );
      for (const account of removedAccounts) {
        await supabase.from('accounts').delete().eq('id', account.id);
      }

      // Update recurring rules
      for (const rule of newSettings.recurringRules) {
        const existingRule = settings.recurringRules.find(r => r.id === rule.id);
        if (!existingRule) {
          // New rule - insert
          await supabase.from('recurring_rules').insert({
            id: rule.id,
            user_id: userId,
            merchant_keyword: rule.merchantKeyword,
            category: rule.category,
            type: rule.type
          });
        }
      }

      // Delete removed rules
      const removedRules = settings.recurringRules.filter(
        r => !newSettings.recurringRules.find(nr => nr.id === r.id)
      );
      for (const rule of removedRules) {
        await supabase.from('recurring_rules').delete().eq('id', rule.id);
      }

      // Update base currency and gradient settings
      if (newSettings.baseCurrency !== settings.baseCurrency ||
          newSettings.gradientStartColor !== settings.gradientStartColor ||
          newSettings.gradientEndColor !== settings.gradientEndColor ||
          newSettings.gradientAngle !== settings.gradientAngle) {
        // Try to update gradient settings
        const updateResult = await supabase.from('user_settings').update({
          base_currency: newSettings.baseCurrency,
          gradient_start_color: newSettings.gradientStartColor,
          gradient_end_color: newSettings.gradientEndColor,
          gradient_angle: newSettings.gradientAngle
        }).eq('id', userId);

        // If gradient columns don't exist, update only base_currency
        if (updateResult.error) {
          console.log('Gradient columns not found, updating base_currency only:', updateResult.error.message);
          await supabase.from('user_settings').update({
            base_currency: newSettings.baseCurrency
          }).eq('id', userId);
        }
      }

      // Update local state
      setSettings(newSettings);
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setTransactions([]);
    setSettings({
      baseCurrency: 'USD',
      categories: [],
      accounts: [],
      recurringRules: [],
      savingsGoals: [],
      warranties: []
    });
  };

  // Navigation handlers
  const handlePreviousPeriod = () => {
    switch (dateFilter) {
      case 'month':
        setMonthOffset(prev => prev - 1);
        break;
      case 'year':
        setYearOffset(prev => prev - 1);
        break;
      case 'week':
        setWeekOffset(prev => prev - 1);
        break;
    }
  };

  const handleNextPeriod = () => {
    switch (dateFilter) {
      case 'month':
        setMonthOffset(prev => prev + 1);
        break;
      case 'year':
        setYearOffset(prev => prev + 1);
        break;
      case 'week':
        setWeekOffset(prev => prev + 1);
        break;
    }
  };

  const handleDateFilterChange = (filter: 'month' | 'year' | 'week' | 'custom' | 'all') => {
    setDateFilter(filter);
    // Reset offsets when changing filter type
    setMonthOffset(0);
    setYearOffset(0);
    setWeekOffset(0);
  };

  // Get current period label for display
  const getCurrentPeriodLabel = () => {
    const now = new Date();
    switch (dateFilter) {
      case 'month': {
        const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
        return targetDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      }
      case 'year': {
        return (now.getFullYear() + yearOffset).toString();
      }
      case 'week': {
        const targetWeekStart = new Date(now);
        targetWeekStart.setDate(now.getDate() + (weekOffset * 7) - now.getDay());
        const weekEnd = new Date(targetWeekStart);
        weekEnd.setDate(targetWeekStart.getDate() + 6);
        return `${targetWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
      case 'custom':
        return customStartDate && customEndDate ? `${customStartDate} to ${customEndDate}` : 'Custom Range';
      case 'all':
        return 'All Time';
      default:
        return '';
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            transactions={filteredTransactions}
            accounts={settings.accounts}
            baseCurrency={settings.baseCurrency}
            dateFilter={dateFilter}
            onDateFilterChange={handleDateFilterChange}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onCustomStartDateChange={setCustomStartDate}
            onCustomEndDateChange={setCustomEndDate}
            onPreviousPeriod={handlePreviousPeriod}
            onNextPeriod={handleNextPeriod}
            currentPeriodLabel={getCurrentPeriodLabel()}
            gradientStartColor={settings.gradientStartColor}
            gradientEndColor={settings.gradientEndColor}
            gradientAngle={settings.gradientAngle}
          />
        );
      case 'add':
        return (
          <AddTransaction
            onAdd={handleAddTransactions}
            onCancel={() => setCurrentView('dashboard')}
            settings={settings}
            existingTransactions={transactions}
          />
        );
      case 'accounts':
        return (
          <AccountsView
            accounts={settings.accounts}
            transactions={filteredTransactions}
            onSelectAccount={handleAccountSelect}
            dateFilter={dateFilter}
            onDateFilterChange={handleDateFilterChange}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onCustomStartDateChange={setCustomStartDate}
            onCustomEndDateChange={setCustomEndDate}
            onPreviousPeriod={handlePreviousPeriod}
            onNextPeriod={handleNextPeriod}
            currentPeriodLabel={getCurrentPeriodLabel()}
          />
        );
      case 'history':
        return (
          <TransactionList
            transactions={filteredTransactions}
            accounts={settings.accounts}
            onDelete={handleDeleteTransaction}
            onEdit={handleEditTransaction}
            initialFilterAccountId={selectedAccountId}
            onClearAccountFilter={() => setSelectedAccountId(null)}
            dateFilter={dateFilter}
            onDateFilterChange={handleDateFilterChange}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onCustomStartDateChange={setCustomStartDate}
            onCustomEndDateChange={setCustomEndDate}
            onPreviousPeriod={handlePreviousPeriod}
            onNextPeriod={handleNextPeriod}
            currentPeriodLabel={getCurrentPeriodLabel()}
          />
        );
      case 'calendar':
        return (
          <CalendarView
            transactions={transactions}
            onSelectTransaction={handleEditTransaction}
          />
        );
      case 'planning':
        return (
          <PlanningView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            transactions={transactions}
          />
        );
      case 'categories':
        return (
          <CategoriesView
            settings={settings}
            transactions={filteredTransactions}
            onUpdateSettings={handleUpdateSettings}
            dateFilter={dateFilter}
            onDateFilterChange={handleDateFilterChange}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onCustomStartDateChange={setCustomStartDate}
            onCustomEndDateChange={setCustomEndDate}
            onPreviousPeriod={handlePreviousPeriod}
            onNextPeriod={handleNextPeriod}
            currentPeriodLabel={getCurrentPeriodLabel()}
          />
        );
      case 'warranties':
        return (
          <WarrantiesView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        );
      case 'settings':
        return (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onBack={() => setCurrentView('dashboard')}
            transactions={transactions}
          />
        );
      default:
        return (
          <Dashboard
            transactions={transactions}
            accounts={settings.accounts}
            baseCurrency={settings.baseCurrency}
            dateFilter={dateFilter}
            onDateFilterChange={handleDateFilterChange}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onCustomStartDateChange={setCustomStartDate}
            onCustomEndDateChange={setCustomEndDate}
            onPreviousPeriod={handlePreviousPeriod}
            onNextPeriod={handleNextPeriod}
            currentPeriodLabel={getCurrentPeriodLabel()}
            gradientStartColor={settings.gradientStartColor}
            gradientEndColor={settings.gradientEndColor}
            gradientAngle={settings.gradientAngle}
          />
        );
    }
  };

  if (isResetPasswordPage) {
    return <ResetPassword />;
  }

  if (loading) {
    const gradient = `linear-gradient(${settings.gradientAngle || 135}deg, ${settings.gradientStartColor || '#d0dddf'} 0%, ${settings.gradientEndColor || '#dcfefb'} 100%)`;
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: gradient }}>
        <div className="text-center">
          <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg mx-auto mb-4">
            F
          </div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth onAuthSuccess={loadUserData} />;
  }

  const gradient = `linear-gradient(${settings.gradientAngle || 135}deg, ${settings.gradientStartColor || '#d0dddf'} 0%, ${settings.gradientEndColor || '#dcfefb'} 100%)`;

  return (
    <div className="min-h-screen text-slate-900 font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden flex flex-col" style={{ background: gradient }}>
      {/* Header */}
      {currentView !== 'settings' && (
        <header className="px-6 py-5 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-brand-500/50 shadow-md">
              F
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">FinSnap</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs font-medium px-2 py-1 bg-brand-50 text-brand-700 rounded-md border border-brand-100">
              {settings.baseCurrency}
            </div>
            <button onClick={handleSignOut} className="text-slate-400 hover:text-slate-600" title="Sign Out">
              <LogOut size={20} />
            </button>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto scroll-smooth no-scrollbar">
        {currentView !== 'settings' ? (
          <div className="p-6 pb-32">{renderView()}</div>
        ) : (
          renderView()
        )}
      </main>

      {/* Edit Modal */}
      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          categories={settings.categories}
          accounts={settings.accounts}
          onClose={() => setEditingTransaction(null)}
          onDelete={(id) => { handleDeleteTransaction(id); setEditingTransaction(null); }}
          onSave={handleUpdateTransaction}
          onAddRule={handleAddRuleFromTransaction}
        />
      )}

      {/* Bottom Tabs Navigation (Only show if NOT in Add or Settings mode) */}
      {currentView !== 'add' && currentView !== 'settings' && (
        <BottomTabs
          currentView={currentView}
          onNavigate={setCurrentView}
          onAdd={() => setCurrentView('add')}
          onDrawerOpen={() => setIsDrawerOpen(true)}
        />
      )}

      {/* Navigation Drawer */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentView={currentView}
        onNavigate={setCurrentView}
      />
    </div>
  );
};

export default App;
