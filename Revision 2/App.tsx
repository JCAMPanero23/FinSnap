import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
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
import RadialNavigation from './components/RadialNavigation';
import { Transaction, View, AppSettings, TransactionType } from './types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'finsnap_transactions';
const SETTINGS_KEY = 'finsnap_settings';

const DEFAULT_CATEGORIES = [
  { id: '1', name: 'Food & Dining', color: '#ef4444', icon: 'Utensils', isDefault: true },
  { id: '2', name: 'Shopping', color: '#f97316', icon: 'ShoppingBag', isDefault: true },
  { id: '3', name: 'Transportation', color: '#3b82f6', icon: 'Car', isDefault: true },
  { id: '4', name: 'Bills & Utilities', color: '#eab308', icon: 'Zap', isDefault: true },
  { id: '5', name: 'Entertainment', color: '#8b5cf6', icon: 'Film', isDefault: true },
  { id: '6', name: 'Health & Wellness', color: '#ec4899', icon: 'Heart', isDefault: true },
  { id: '7', name: 'Income', color: '#10b981', icon: 'Briefcase', isDefault: true },
  { id: '8', name: 'Transfer', color: '#64748b', icon: 'ArrowRightLeft', isDefault: true },
  { id: '9', name: 'Other', color: '#94a3b8', icon: 'MoreHorizontal', isDefault: true }
];

const DEFAULT_SETTINGS: AppSettings = {
  baseCurrency: 'USD',
  categories: DEFAULT_CATEGORIES,
  accounts: [],
  recurringRules: [],
  savingsGoals: [],
  warranties: []
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    const savedTxns = localStorage.getItem(STORAGE_KEY);
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    
    if (savedTxns) {
      try {
        setTransactions(JSON.parse(savedTxns));
      } catch (e) { console.error("Failed to parse transactions"); }
    }
    
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        // Merge defaults in case of new fields (like icons or warranties)
        setSettings({ 
          ...DEFAULT_SETTINGS, 
          ...parsed,
          categories: parsed.categories.map((c: any) => ({
             ...c,
             // Ensure legacy categories get a default icon if missing
             icon: c.icon || 'Tag'
          })),
          warranties: parsed.warranties || []
        });
      } catch (e) { console.error("Failed to parse settings"); }
    }
  }, []);

  // Persistence
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const handleAddTransactions = (newTransactions: Transaction[]) => {
    // 1. Add Transactions
    setTransactions(prev => [...newTransactions, ...prev]);

    // 2. Update Account Balances
    const updatedAccounts = [...settings.accounts];
    let accountsChanged = false;

    newTransactions.forEach(t => {
      // Find the account this transaction belongs to
      const accIndex = t.accountId ? updatedAccounts.findIndex(a => a.id === t.accountId) : -1;
      
      if (accIndex !== -1) {
        const acc = updatedAccounts[accIndex];
        let balanceUpdatedViaSnapshot = false;

        // A. Try Snapshot Update (AI parsed absolute values)
        // If the AI found a specific "Available Balance" or "Limit", force update the balance
        if (acc.autoUpdateBalance !== false && t.parsedMeta) {
           if (t.parsedMeta.availableCredit !== undefined && acc.totalCreditLimit) {
              acc.balance = -(acc.totalCreditLimit - t.parsedMeta.availableCredit);
              balanceUpdatedViaSnapshot = true;
           } else if (t.parsedMeta.availableBalance !== undefined) {
               acc.balance = t.parsedMeta.availableBalance;
               balanceUpdatedViaSnapshot = true;
           }
        }

        // B. Fallback: Delta Update
        // If no snapshot was found (or manual entry), update balance by adding/subtracting amount
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

    if (accountsChanged) {
      setSettings(prev => ({ ...prev, accounts: updatedAccounts }));
    }

    setCurrentView('dashboard');
  };

  const handleDeleteTransaction = (id: string) => {
    if (window.confirm("Are you sure you want to delete this transaction?")) {
      // Logic could be added here to reverse-update balance if needed, 
      // but simpler to just delete record for now or ask user to adjust balance manually
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  };

  const handleUpdateTransaction = (updated: Transaction | Transaction[]) => {
    if (Array.isArray(updated)) {
      // It's a split operation (or bulk update).
      // 1. Remove the original transaction(s) that match the IDs provided (usually just the first one's original ID)
      // However, our Edit Modal logic keeps the FIRST item id as the original ID.
      // So we filter out the original ID, then add all new ones.
      
      const originalId = updated[0].id; // Assumption based on EditModal logic
      
      setTransactions(prev => {
        // Remove the original
        const filtered = prev.filter(t => t.id !== originalId);
        // Add all the new splits
        return [...updated, ...filtered];
      });
    } else {
      // Standard single update
      setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
    }
    setEditingTransaction(null);
  };

  const handleAddRuleFromTransaction = (merchant: string, category: string, type: TransactionType) => {
    setSettings(prev => ({
      ...prev,
      recurringRules: [
        ...(prev.recurringRules || []),
        { id: uuidv4(), merchantKeyword: merchant, category, type }
      ]
    }));
  };

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
    setCurrentView('history');
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
      case 'categories':
        return (
          <CategoriesView 
             settings={settings}
             transactions={transactions}
             onUpdateSettings={setSettings}
          />
        );
      case 'warranties':
        return (
          <WarrantiesView 
             settings={settings}
             onUpdateSettings={setSettings}
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
      case 'planning':
        return (
          <PlanningView 
            settings={settings}
            onUpdateSettings={setSettings}
            onAddTransaction={(tx) => {
               const newTx = { ...tx, id: uuidv4(), currency: settings.baseCurrency };
               handleAddTransactions([newTx]);
            }}
          />
        );
      case 'settings':
        return (
          <SettingsView 
            settings={settings}
            onUpdateSettings={setSettings}
            onBack={() => setCurrentView('dashboard')}
            onViewCategories={() => setCurrentView('categories')}
          />
        );
      default:
        return <Dashboard transactions={transactions} accounts={settings.accounts} />;
    }
  };

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

      {/* Radial Navigation (Only show if NOT in Add or Settings mode for clarity) */}
      {currentView !== 'add' && currentView !== 'settings' && (
        <RadialNavigation 
          currentView={currentView}
          onNavigate={setCurrentView}
          onAdd={() => setCurrentView('add')}
        />
      )}

    </div>
  );
};

export default App;