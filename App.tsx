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
import {
  getAllTransactions,
  getAllAccounts,
  getAllCategories,
  getAllRecurringRules,
  getAllWarranties,
  getSetting,
  saveSetting,
  saveTransaction,
  deleteTransaction as deleteTransactionDB,
  saveAccount,
  deleteAccount as deleteAccountDB,
  saveCategory,
  deleteCategory as deleteCategoryDB,
  saveRecurringRule,
  deleteRecurringRule as deleteRecurringRuleDB,
  saveWarranty,
  deleteWarranty as deleteWarrantyDB,
  clearTransactions,
  clearAllData,
} from './services/indexedDBService';
import { isBiometricEnabled, setBiometricEnabled } from './services/biometricService';
import BiometricLock from './components/BiometricLock';
import BackupRestoreModal from './components/BackupRestoreModal';
import { needsMigration, migrateFromSupabase } from './services/migrationService';
import { cleanupOldReceipts } from './services/receiptCleanupService';
import { shouldAutoBackup, exportToCSV, exportReceiptsZip, uploadBackup, markAutoBackupComplete } from './services/backupService';

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
  const [biometricLocked, setBiometricLocked] = useState(true);
  const [showBackupRestoreModal, setShowBackupRestoreModal] = useState(false);
  const [migrating, setMigrating] = useState(false);

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
      // Check if migration needed
      if (session?.user) {
        const needsMig = await needsMigration(session.user.id);
        if (needsMig) {
          setMigrating(true);
          await migrateFromSupabase(session.user.id);
          setMigrating(false);
        }
      }

      // Load from IndexedDB
      const [
        txns,
        accounts,
        categories,
        rules,
        warranties,
        baseCurrency,
        gradientStartColor,
        gradientEndColor,
        gradientAngle,
      ] = await Promise.all([
        getAllTransactions(),
        getAllAccounts(),
        getAllCategories(),
        getAllRecurringRules(),
        getAllWarranties(),
        getSetting('baseCurrency'),
        getSetting('gradientStartColor'),
        getSetting('gradientEndColor'),
        getSetting('gradientAngle'),
      ]);

      setTransactions(txns || []);
      setSettings({
        baseCurrency: baseCurrency || 'USD',
        categories: categories || [],
        accounts: accounts || [],
        recurringRules: rules || [],
        savingsGoals: [], // Not migrated yet
        warranties: warranties || [],
        gradientStartColor: gradientStartColor || '#d0dddf',
        gradientEndColor: gradientEndColor || '#dcfefb',
        gradientAngle: gradientAngle || 135,
      });

      // Run cleanup on startup
      await cleanupOldReceipts();

      // Check auto-backup
      if (session?.user) {
        const shouldBackup = await shouldAutoBackup();
        if (shouldBackup) {
          try {
            const csv = await exportToCSV();
            const receiptsBlob = await exportReceiptsZip();
            await uploadBackup(session.user.id, csv, receiptsBlob);
            await markAutoBackupComplete();
            console.log('Auto-backup completed');
          } catch (err) {
            console.error('Auto-backup failed:', err);
          }
        }
      }
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

  const handleAddTransactions = async (newTransactions: Omit<Transaction, 'id'>[]) => {
    const txnsWithIds = newTransactions.map(tx => ({
      ...tx,
      id: uuidv4(),
    }));

    // Save to IndexedDB
    for (const tx of txnsWithIds) {
      await saveTransaction(tx);

      // Update account balances
      if (tx.accountId) {
        const account = settings.accounts.find(a => a.id === tx.accountId);
        if (account) {
          let newBalance = account.balance;

          if (tx.parsedMeta?.availableBalance !== undefined) {
            newBalance = tx.parsedMeta.availableBalance;
          } else if (tx.parsedMeta?.availableCredit !== undefined && account.totalCreditLimit) {
            newBalance = -(account.totalCreditLimit - tx.parsedMeta.availableCredit);
          } else {
            if (tx.type === TransactionType.EXPENSE) {
              newBalance -= tx.amount;
            } else if (tx.type === TransactionType.INCOME) {
              newBalance += tx.amount;
            }
          }

          const updatedAccount = { ...account, balance: newBalance };
          await saveAccount(updatedAccount);
        }
      }
    }

    // Reload data
    await loadUserData();
    setCurrentView('dashboard');
  };

  const handleDeleteTransaction = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this transaction?")) {
      await deleteTransactionDB(id);
      await loadUserData();
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  };

  const handleUpdateTransaction = async (updated: Transaction) => {
    await saveTransaction(updated);
    setEditingTransaction(null);
    await loadUserData();
  };

  const handleAddRuleFromTransaction = async (merchant: string, category: string, type: TransactionType) => {
    try {
      const newRule: RecurringRule = {
        id: uuidv4(),
        merchantKeyword: merchant,
        category,
        type
      };

      await saveRecurringRule(newRule);
      await loadUserData();
    } catch (error) {
      console.error('Error adding recurring rule:', error);
    }
  };

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
    setCurrentView('history');
  };

  const handleUpdateSettings = async (newSettings: AppSettings) => {
    try {
      // Handle Developer Reset Actions
      if ((newSettings as any).__resetTransactions) {
        // Soft Reset - Delete all transactions and reset account balances to 0
        await clearTransactions();
        const accounts = await getAllAccounts();
        for (const acc of accounts) {
          await saveAccount({ ...acc, balance: 0 });
        }
        await loadUserData();
        return;
      }

      if ((newSettings as any).__resetToDefault) {
        // Hard Reset - Delete all user data
        await clearAllData();
        setTransactions([]);
        setSettings(DEFAULT_SETTINGS);
        return;
      }

      // Save settings
      await saveSetting('baseCurrency', newSettings.baseCurrency);
      await saveSetting('gradientStartColor', newSettings.gradientStartColor);
      await saveSetting('gradientEndColor', newSettings.gradientEndColor);
      await saveSetting('gradientAngle', newSettings.gradientAngle);

      // Save categories
      for (const cat of newSettings.categories) {
        await saveCategory(cat);
      }

      // Delete removed categories
      const removedCategories = settings.categories.filter(
        c => !newSettings.categories.find(nc => nc.id === c.id)
      );
      for (const cat of removedCategories) {
        await deleteCategoryDB(cat.id);
      }

      // Save accounts
      for (const acc of newSettings.accounts) {
        await saveAccount(acc);
      }

      // Delete removed accounts
      const removedAccounts = settings.accounts.filter(
        a => !newSettings.accounts.find(na => na.id === a.id)
      );
      for (const acc of removedAccounts) {
        await deleteAccountDB(acc.id);
      }

      // Save rules
      for (const rule of newSettings.recurringRules) {
        await saveRecurringRule(rule);
      }

      // Delete removed rules
      const removedRules = settings.recurringRules.filter(
        r => !newSettings.recurringRules.find(nr => nr.id === r.id)
      );
      for (const rule of removedRules) {
        await deleteRecurringRuleDB(rule.id);
      }

      // Save warranties
      for (const warranty of newSettings.warranties) {
        await saveWarranty(warranty);
      }

      // Delete removed warranties
      const removedWarranties = settings.warranties.filter(
        w => !newSettings.warranties.find(nw => nw.id === w.id)
      );
      for (const warranty of removedWarranties) {
        await deleteWarrantyDB(warranty.id);
      }

      // Reload
      await loadUserData();
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

  if (loading || migrating) {
    const gradient = `linear-gradient(${settings.gradientAngle || 135}deg, ${settings.gradientStartColor || '#d0dddf'} 0%, ${settings.gradientEndColor || '#dcfefb'} 100%)`;
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: gradient }}>
        <div className="text-center">
          <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg mx-auto mb-4">
            F
          </div>
          <p className="text-slate-600">{migrating ? 'Migrating data to local storage...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth onAuthSuccess={loadUserData} />;
  }

  // Biometric lock check
  if (biometricLocked) {
    return (
      <BiometricLock
        onUnlock={async () => {
          const enabled = await isBiometricEnabled();
          if (!enabled) {
            setBiometricLocked(false);
          } else {
            setBiometricLocked(false);
          }
        }}
      />
    );
  }

  const gradient = `linear-gradient(${settings.gradientAngle || 135}deg, ${settings.gradientStartColor || '#d0dddf'} 0%, ${settings.gradientEndColor || '#dcfefb'} 100%)`;

  return (
    <div className="min-h-screen text-slate-900 font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden flex flex-col" style={{ background: gradient }}>
      {showBackupRestoreModal && (
        <BackupRestoreModal
          onClose={() => setShowBackupRestoreModal(false)}
          onRestoreComplete={async () => {
            setShowBackupRestoreModal(false);
            await loadUserData();
          }}
        />
      )}

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
