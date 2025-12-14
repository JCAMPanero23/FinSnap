import React, { useState, useEffect } from 'react';
import { LayoutDashboard, PlusCircle, History, Settings, Wallet, CalendarRange, LogOut } from 'lucide-react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import AddTransaction from './components/AddTransaction';
import TransactionList from './components/TransactionList';
import EditTransactionModal from './components/EditTransactionModal';
import SettingsView from './components/SettingsView';
import AccountsView from './components/AccountsView';
import CalendarView from './components/CalendarView';
import { Transaction, View, AppSettings, TransactionType, Category, Account, RecurringRule } from './types';
import { v4 as uuidv4 } from 'uuid';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    baseCurrency: 'USD',
    categories: [],
    accounts: [],
    recurringRules: []
  });
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Check auth session on mount
  useEffect(() => {
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
  }, []);

  // Load user data when authenticated
  useEffect(() => {
    if (session?.user) {
      loadUserData();
    }
  }, [session]);

  const loadUserData = async () => {
    try {
      const userId = session?.user?.id;
      if (!userId) return;

      // Load settings
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('base_currency')
        .eq('id', userId)
        .single();

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
        recurringRules: mappedRules
      });

      setTransactions(mappedTransactions);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setTransactions([]);
    setSettings({
      baseCurrency: 'USD',
      categories: [],
      accounts: [],
      recurringRules: []
    });
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard transactions={transactions} accounts={settings.accounts} />;
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
            transactions={transactions}
            onSelectAccount={handleAccountSelect}
          />
        );
      case 'history':
        return (
          <TransactionList
            transactions={transactions}
            accounts={settings.accounts}
            onDelete={handleDeleteTransaction}
            onEdit={handleEditTransaction}
            initialFilterAccountId={selectedAccountId}
            onClearAccountFilter={() => setSelectedAccountId(null)}
          />
        );
      case 'calendar':
        return (
          <CalendarView
            transactions={transactions}
            onSelectTransaction={handleEditTransaction}
          />
        );
      case 'settings':
        return (
          <SettingsView
            settings={settings}
            onUpdateSettings={setSettings}
            onBack={() => setCurrentView('dashboard')}
          />
        );
      default:
        return <Dashboard transactions={transactions} accounts={settings.accounts} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden flex flex-col">
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
            <button onClick={() => setCurrentView('settings')} className="text-slate-400 hover:text-slate-600">
              <Settings size={20} />
            </button>
            <button onClick={handleSignOut} className="text-slate-400 hover:text-slate-600" title="Sign Out">
              <LogOut size={20} />
            </button>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto scroll-smooth no-scrollbar">
        {currentView !== 'settings' ? (
          <div className="p-6">{renderView()}</div>
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

      {/* Bottom Navigation */}
      {currentView !== 'settings' && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-3 pb-6 flex justify-between items-center z-30 max-w-md mx-auto text-[10px] font-medium">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'dashboard' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <LayoutDashboard size={24} strokeWidth={currentView === 'dashboard' ? 2.5 : 2} />
            Home
          </button>

          <button
            onClick={() => setCurrentView('accounts')}
            className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'accounts' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Wallet size={24} strokeWidth={currentView === 'accounts' ? 2.5 : 2} />
            Accounts
          </button>

          {/* Floating Action Button for Add */}
          <div className="relative -top-5">
            <button
              onClick={() => setCurrentView('add')}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                currentView === 'add'
                  ? 'bg-slate-800 text-white rotate-45'
                  : 'bg-brand-600 text-white shadow-brand-500/40'
              }`}
            >
              <PlusCircle size={28} />
            </button>
          </div>

          <button
            onClick={() => { setSelectedAccountId(null); setCurrentView('history'); }}
            className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'history' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <History size={24} strokeWidth={currentView === 'history' ? 2.5 : 2} />
            History
          </button>

          <button
            onClick={() => setCurrentView('calendar')}
            className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'calendar' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <CalendarRange size={24} strokeWidth={currentView === 'calendar' ? 2.5 : 2} />
            Calendar
          </button>
        </nav>
      )}
    </div>
  );
};

export default App;
