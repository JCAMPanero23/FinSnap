import React, { useState, useEffect } from 'react';
import { AppSettings, Category, Account, AccountType, RecurringRule, TransactionType, Transaction } from '../types';
import { Plus, X, Save, Trash2, RotateCcw, CreditCard, Wallet, Building2, Banknote, Tag, ArrowRight, RefreshCw, Fingerprint, Cloud } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { isBiometricEnabled, setBiometricEnabled, isBiometricAvailable } from '../services/biometricService';
import { getSetting, saveSetting } from '../services/indexedDBService';
import BackupRestoreModal from './BackupRestoreModal';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings, accountReplacements?: { newAccountId: string, replaceAccountId: string | 'ORPHANS' }[]) => void;
  onBack: () => void;
  transactions?: Transaction[]; // Optional: for showing orphan count
}

const DEFAULT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', 
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', 
  '#f43f5e', '#64748b'
];

const ACCOUNT_TYPES: AccountType[] = ['Bank', 'Credit Card', 'Cash', 'Wallet', 'Other'];

const SettingsView: React.FC<SettingsViewProps> = ({ settings, onUpdateSettings, onBack, transactions }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(JSON.parse(JSON.stringify(settings)));
  const [activeTab, setActiveTab] = useState<'general' | 'categories' | 'accounts' | 'rules' | 'security' | 'backup' | 'developer'>('general');

  // Category State
  const [newCategoryName, setNewCategoryName] = useState('');

  // Account State
  const [editingAccount, setEditingAccount] = useState<Partial<Account> | null>(null);
  const [replacingAccountId, setReplacingAccountId] = useState<string | 'ORPHANS' | null>(null); // Track account replacement
  const [accountReplacements, setAccountReplacements] = useState<{ newAccountId: string, replaceAccountId: string | 'ORPHANS' }[]>([]);

  // Rule State
  const [newRule, setNewRule] = useState<Partial<RecurringRule>>({
    merchantKeyword: '',
    category: '',
    type: TransactionType.EXPENSE
  });

  // Security State
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [autoBackupMonthly, setAutoBackupMonthly] = useState(false);
  const [dailyAutoBackupEnabled, setDailyAutoBackupEnabled] = useState(false);
  const [lastDailyBackup, setLastDailyBackup] = useState<string | null>(null);
  const [showBackupModal, setShowBackupModal] = useState(false);

  // Calculate orphaned transactions count
  const orphanedTransactionsCount = transactions?.filter(t => !t.accountId).length || 0;

  useEffect(() => {
    loadSecuritySettings();
  }, []);

  const loadSecuritySettings = async () => {
    const enabled = await isBiometricEnabled();
    const available = await isBiometricAvailable();
    const autoBackup = await getSetting('autoBackupMonthly');
    const dailyBackup = await getSetting('dailyAutoBackupEnabled');
    const lastDaily = await getSetting('lastDailyBackup');

    setBiometricEnabledState(enabled);
    setBiometricAvailable(available);
    setAutoBackupMonthly(autoBackup === true);
    setDailyAutoBackupEnabled(dailyBackup === true);
    setLastDailyBackup(lastDaily || null);
  };

  const toggleBiometric = async () => {
    const newValue = !biometricEnabled;
    await setBiometricEnabled(newValue);
    setBiometricEnabledState(newValue);
  };

  const toggleAutoBackup = async () => {
    const newValue = !autoBackupMonthly;
    await saveSetting('autoBackupMonthly', newValue);
    setAutoBackupMonthly(newValue);
  };

  const toggleDailyAutoBackup = async () => {
    const newValue = !dailyAutoBackupEnabled;
    await saveSetting('dailyAutoBackupEnabled', newValue);
    setDailyAutoBackupEnabled(newValue);

    // Reinitialize or stop the scheduler
    if (newValue) {
      // Reload the page to reinitialize the scheduler
      window.location.reload();
    }
  };

  // --- Category Handlers ---
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const newCategory: Category = {
      id: uuidv4(),
      name: newCategoryName.trim(),
      color: DEFAULT_COLORS[localSettings.categories.length % DEFAULT_COLORS.length]
    };
    setLocalSettings(prev => ({ ...prev, categories: [...prev.categories, newCategory] }));
    setNewCategoryName('');
  };

  const handleDeleteCategory = (id: string) => {
    if (window.confirm("Delete this category?")) {
      setLocalSettings(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== id) }));
    }
  };

  // --- Account Handlers ---
  const handleSaveAccount = () => {
    if (!editingAccount || !editingAccount.name?.trim()) return;

    let savedAccountId: string | null = null;

    setLocalSettings(prev => {
      const newAccounts = [...prev.accounts];

      if (editingAccount.id) {
        // Update existing
        const index = newAccounts.findIndex(a => a.id === editingAccount.id);
        if (index !== -1) {
          newAccounts[index] = { ...newAccounts[index], ...editingAccount } as Account;
        }
        savedAccountId = editingAccount.id;
      } else {
        // Create new
        const newAcc: Account = {
          id: uuidv4(),
          name: editingAccount.name!.trim(),
          type: (editingAccount.type as AccountType) || 'Other',
          last4Digits: editingAccount.last4Digits?.trim(),
          color: DEFAULT_COLORS[prev.accounts.length % DEFAULT_COLORS.length],
          currency: prev.baseCurrency,
          balance: editingAccount.balance || 0,
          totalCreditLimit: editingAccount.totalCreditLimit,
          monthlySpendingLimit: editingAccount.monthlySpendingLimit,
          paymentDueDay: editingAccount.paymentDueDay,
          autoUpdateBalance: editingAccount.autoUpdateBalance ?? true,
        };
        newAccounts.push(newAcc);
        savedAccountId = newAcc.id;
      }
      return { ...prev, accounts: newAccounts };
    });

    // Track account replacement if selected
    if (replacingAccountId && savedAccountId) {
      setAccountReplacements(prev => [...prev, { newAccountId: savedAccountId!, replaceAccountId: replacingAccountId }]);
    }

    setEditingAccount(null);
    setReplacingAccountId(null);
  };

  const handleEditAccount = (acc: Account) => {
    setEditingAccount({ ...acc });
  };

  const handleCreateAccount = () => {
     setEditingAccount({
        name: '',
        type: 'Bank',
        last4Digits: '',
        balance: 0,
        autoUpdateBalance: true,
     });
     setReplacingAccountId(null); // Reset replacement selection
  };

  const handleDeleteAccount = (id: string) => {
    if (window.confirm("Delete this account?")) {
      setLocalSettings(prev => ({ ...prev, accounts: prev.accounts.filter(a => a.id !== id) }));
      if (editingAccount?.id === id) setEditingAccount(null);
    }
  };

  // --- Rule Handlers ---
  const handleAddRule = () => {
    if (!newRule.merchantKeyword?.trim()) return;
    setLocalSettings(prev => ({
      ...prev,
      recurringRules: [...(prev.recurringRules || []), { 
        id: uuidv4(), 
        merchantKeyword: newRule.merchantKeyword!, 
        category: newRule.category,
        type: newRule.type
      }]
    }));
    setNewRule({ merchantKeyword: '', category: '', type: TransactionType.EXPENSE });
  };

  const handleDeleteRule = (id: string) => {
    setLocalSettings(prev => ({ ...prev, recurringRules: (prev.recurringRules || []).filter(r => r.id !== id) }));
  };

  const handleSave = () => {
    onUpdateSettings(localSettings, accountReplacements.length > 0 ? accountReplacements : undefined);
    onBack();
  };

  const renderAccountIcon = (type: AccountType) => {
    switch (type) {
      case 'Credit Card': return <CreditCard size={18} />;
      case 'Bank': return <Building2 size={18} />;
      case 'Cash': return <Banknote size={18} />;
      case 'Wallet': return <Wallet size={18} />;
      default: return <CreditCard size={18} />;
    }
  };

  const gradient = `linear-gradient(${settings.gradientAngle || 135}deg, ${settings.gradientStartColor || '#d0dddf'} 0%, ${settings.gradientEndColor || '#dcfefb'} 100%)`;

  return (
    <div className="h-full flex flex-col pb-24 relative" style={{ background: gradient }}>
      <div className="px-6 py-4 bg-white border-b border-slate-100 sticky top-0 z-10 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
        <button 
          onClick={handleSave}
          className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold shadow-brand-500/20 shadow-lg active:scale-95 transition-all"
        >
          Save
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-2 bg-white border-b border-slate-100 gap-2 overflow-x-auto">
        {(['general', 'categories', 'accounts', 'rules', 'security', 'backup', 'developer'] as const).map(tab => (
           <button
             key={tab}
             onClick={() => setActiveTab(tab)}
             className={`px-4 py-2 rounded-lg text-sm font-medium capitalize whitespace-nowrap transition-colors ${
               activeTab === tab ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50'
             }`}
           >
             {tab === 'rules' ? 'Helpers' : tab === 'backup' ? 'Backup & Restore' : tab}
           </button>
        ))}
      </div>

      <div className="p-6 space-y-8 flex-1 overflow-y-auto">
        
        {/* General Tab */}
        {activeTab === 'general' && (
          <section className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Preferences</h3>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
               <label className="block text-xs font-semibold text-slate-500 mb-2">Base Currency</label>
               <div className="relative">
                 <select 
                   value={localSettings.baseCurrency}
                   onChange={(e) => setLocalSettings(prev => ({ ...prev, baseCurrency: e.target.value }))}
                   className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
                 >
                   {['USD', 'EUR', 'GBP', 'AED', 'JPY', 'CAD', 'AUD', 'INR'].map(c => (
                     <option key={c} value={c}>{c}</option>
                   ))}
                 </select>
                 <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                   <RotateCcw size={16} />
                 </div>
               </div>
               <p className="mt-2 text-xs text-slate-500">
                 Transactions in other currencies will be converted to this currency using historical rates.
               </p>
            </div>

            {/* Gradient Background Settings */}
            <div className="mt-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Background Gradient</h3>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
                {/* Gradient Start Color */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">Start Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={localSettings.gradientStartColor || '#d0dddf'}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, gradientStartColor: e.target.value }))}
                      className="w-16 h-10 rounded-lg border border-slate-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={localSettings.gradientStartColor || '#d0dddf'}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, gradientStartColor: e.target.value }))}
                      className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                      placeholder="#d0dddf"
                    />
                  </div>
                </div>

                {/* Gradient End Color */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">End Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={localSettings.gradientEndColor || '#dcfefb'}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, gradientEndColor: e.target.value }))}
                      className="w-16 h-10 rounded-lg border border-slate-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={localSettings.gradientEndColor || '#dcfefb'}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, gradientEndColor: e.target.value }))}
                      className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                      placeholder="#dcfefb"
                    />
                  </div>
                </div>

                {/* Gradient Angle */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">
                    Gradient Angle: {localSettings.gradientAngle || 135}°
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="15"
                    value={localSettings.gradientAngle || 135}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, gradientAngle: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right,
                        ${localSettings.gradientStartColor || '#d0dddf'},
                        ${localSettings.gradientEndColor || '#dcfefb'})`
                    }}
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>0°</span>
                    <span>90°</span>
                    <span>180°</span>
                    <span>270°</span>
                    <span>360°</span>
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">Preview</label>
                  <div
                    className="w-full h-20 rounded-lg border border-slate-200"
                    style={{
                      background: `linear-gradient(${localSettings.gradientAngle || 135}deg, ${localSettings.gradientStartColor || '#d0dddf'} 0%, ${localSettings.gradientEndColor || '#dcfefb'} 100%)`
                    }}
                  />
                </div>

                <p className="text-xs text-slate-500">
                  Customize the background gradient that appears across all app views.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <section className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Manage Categories</h3>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex gap-2">
                <input 
                  type="text" 
                  placeholder="New Category Name..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button 
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim()}
                  className="p-2 bg-brand-100 text-brand-600 rounded-lg hover:bg-brand-200 disabled:opacity-50"
                >
                  <Plus size={20} />
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {localSettings.categories.map(cat => (
                  <div key={cat.id} className="p-3 flex items-center justify-between group hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-medium text-slate-700">{cat.name}</span>
                    </div>
                    {!cat.isDefault && (
                      <button 
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Accounts Tab */}
        {activeTab === 'accounts' && (
          <section className="animate-in fade-in slide-in-from-right-4 duration-300">
             <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Manage Accounts</h3>
                <button 
                 onClick={handleCreateAccount}
                 className="flex items-center gap-1 text-xs font-bold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-colors"
                >
                 <Plus size={14} /> New Account
               </button>
             </div>

             {/* Account List */}
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-50">
               {localSettings.accounts.length === 0 && (
                 <div className="p-6 text-center text-slate-400 text-sm">
                   No accounts added yet. Add one to track balances and budgets.
                 </div>
               )}
               {localSettings.accounts.map(acc => (
                 <div key={acc.id} onClick={() => handleEditAccount(acc)} className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer group transition-colors">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                          {renderAccountIcon(acc.type)}
                       </div>
                       <div>
                         <div className="font-semibold text-slate-800 text-sm">{acc.name}</div>
                         <div className="text-xs text-slate-400 flex items-center gap-2">
                           <span>{acc.type}</span>
                           {acc.last4Digits && <span className="font-mono bg-slate-100 px-1 rounded">...{acc.last4Digits}</span>}
                         </div>
                       </div>
                    </div>
                    <div className="text-right">
                       <div className={`text-sm font-bold ${acc.balance < 0 ? 'text-red-500' : 'text-slate-700'}`}>
                         {acc.balance < 0 ? '-' : ''}${Math.abs(acc.balance).toFixed(2)}
                       </div>
                       {acc.monthlySpendingLimit && <div className="text-[10px] text-slate-400">Budget: ${acc.monthlySpendingLimit}</div>}
                    </div>
                 </div>
               ))}
             </div>

             {/* Orphaned Transactions Section */}
             {orphanedTransactionsCount > 0 && transactions && (
               <div className="mt-6">
                 <div className="flex items-center justify-between mb-3">
                   <h3 className="text-sm font-bold text-orange-600 uppercase tracking-wider">
                     ⚠️ Orphaned Transactions ({orphanedTransactionsCount})
                   </h3>
                 </div>

                 <div className="bg-orange-50 rounded-xl shadow-sm border border-orange-200 p-4">
                   <p className="text-xs text-orange-700 mb-4">
                     These transactions have no linked account. Reassign them to an account below.
                   </p>

                   {/* Bulk Reassign */}
                   <div className="flex gap-2 mb-4">
                     <select
                       className="flex-1 p-2.5 bg-white border border-orange-200 rounded-lg text-sm"
                       value=""
                       onChange={(e) => {
                         if (e.target.value && window.confirm(`Reassign all ${orphanedTransactionsCount} orphaned transactions to this account?`)) {
                           const targetAccountId = e.target.value;
                           setAccountReplacements(prev => [...prev, { newAccountId: targetAccountId, replaceAccountId: 'ORPHANS' }]);
                           // Trigger save
                           setTimeout(() => {
                             onUpdateSettings(localSettings, [{ newAccountId: targetAccountId, replaceAccountId: 'ORPHANS' }]);
                           }, 100);
                         }
                       }}
                     >
                       <option value="">Select account to reassign all...</option>
                       {localSettings.accounts.map(acc => (
                         <option key={acc.id} value={acc.id}>
                           {acc.name} ({acc.last4Digits || 'No digits'})
                         </option>
                       ))}
                     </select>
                   </div>

                   {/* Show recent orphaned transactions */}
                   <div className="space-y-2 max-h-60 overflow-y-auto">
                     {transactions
                       .filter(t => !t.accountId)
                       .slice(0, 10)
                       .map(t => (
                         <div key={t.id} className="bg-white p-3 rounded-lg border border-orange-100 text-xs">
                           <div className="flex justify-between items-start">
                             <div>
                               <div className="font-bold text-slate-800">{t.merchant}</div>
                               <div className="text-slate-500">{t.date} • {t.category}</div>
                             </div>
                             <div className="font-mono font-bold text-slate-700">
                               ${t.amount.toFixed(2)}
                             </div>
                           </div>
                         </div>
                       ))}
                     {orphanedTransactionsCount > 10 && (
                       <div className="text-center text-xs text-orange-600 mt-2">
                         + {orphanedTransactionsCount - 10} more transactions
                       </div>
                     )}
                   </div>
                 </div>
               </div>
             )}
          </section>
        )}

        {/* Parsing Rules Tab */}
        {activeTab === 'rules' && (
          <section className="animate-in fade-in slide-in-from-right-4 duration-300">
             <div className="mb-4 bg-blue-50 p-4 rounded-xl border border-blue-100 text-xs text-blue-700">
               <p className="font-bold mb-1">Parsing Helpers & Recurring</p>
               <p>Add rules here to help the AI categorize or identify transfers. Use "Transfer" type to force specific keywords to be treated as internal transfers.</p>
             </div>

             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <div className="text-xs font-bold text-slate-500 uppercase mb-2">Add New Rule</div>
                  <div className="flex flex-col gap-2">
                     <div className="flex gap-2">
                       <input 
                         type="text"
                         placeholder="Merchant Keyword (e.g. Netflix)"
                         className="flex-[2] p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
                         value={newRule.merchantKeyword}
                         onChange={(e) => setNewRule(prev => ({...prev, merchantKeyword: e.target.value}))}
                       />
                       <select 
                         className="flex-1 p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
                         value={newRule.type}
                         onChange={(e) => setNewRule(prev => ({...prev, type: e.target.value as TransactionType}))}
                       >
                         <option value={TransactionType.EXPENSE}>Expense</option>
                         <option value={TransactionType.INCOME}>Income</option>
                         <option value={TransactionType.TRANSFER}>Transfer</option>
                       </select>
                     </div>
                     <div className="flex gap-2">
                       <select 
                         className="flex-1 p-2.5 bg-white border border-slate-200 rounded-lg text-sm"
                         value={newRule.category}
                         onChange={(e) => setNewRule(prev => ({...prev, category: e.target.value}))}
                         disabled={newRule.type === TransactionType.TRANSFER}
                       >
                         <option value="">{newRule.type === TransactionType.TRANSFER ? 'N/A' : 'Select Category'}</option>
                         {localSettings.categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                       </select>
                       <button 
                         onClick={handleAddRule}
                         disabled={!newRule.merchantKeyword}
                         className="px-4 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                       >
                         <Plus size={20} />
                       </button>
                     </div>
                  </div>
                </div>
                
                <div className="divide-y divide-slate-50">
                  {(!localSettings.recurringRules || localSettings.recurringRules.length === 0) && (
                    <div className="p-6 text-center text-slate-400 text-sm">
                      No rules added.
                    </div>
                  )}
                  {localSettings.recurringRules?.map(rule => (
                    <div key={rule.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${rule.type === TransactionType.TRANSFER ? 'bg-purple-50 text-purple-600' : 'bg-indigo-50 text-indigo-500'}`}>
                           {rule.type === TransactionType.TRANSFER ? <RefreshCw size={16} /> : <Tag size={16} />}
                        </div>
                        <div>
                           <div className="font-semibold text-slate-800 text-sm">{rule.merchantKeyword}</div>
                           <div className="text-xs text-slate-400 flex items-center gap-1">
                             <ArrowRight size={10} /> 
                             {rule.type === TransactionType.TRANSFER ? 'Always Transfer' : rule.category || 'Auto-categorize'}
                           </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-2 text-slate-300 hover:text-red-500 rounded-full transition-colors"
                      >
                         <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
             </div>
          </section>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Fingerprint className="w-5 h-5" />
                Biometric Authentication
              </h3>

              {!biometricAvailable ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Biometric authentication is not available on this device.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-800">Enable Biometric Lock</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Require fingerprint/face unlock on app startup
                    </div>
                  </div>
                  <button
                    onClick={toggleBiometric}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      biometricEnabled ? 'bg-teal-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        biometricEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'backup' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Cloud className="w-5 h-5" />
                Cloud Backup
              </h3>

              <div className="space-y-4">
                <button
                  onClick={() => setShowBackupModal(true)}
                  className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition"
                >
                  Manage Backups
                </button>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-800">Auto-backup Monthly</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Automatically backup on the last day of each month
                    </div>
                  </div>
                  <button
                    onClick={toggleAutoBackup}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      autoBackupMonthly ? 'bg-teal-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        autoBackupMonthly ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <div className="font-medium text-gray-800">Daily Auto-backup at Midnight</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Automatically backup every day at midnight (overwrites previous day)
                    </div>
                    {lastDailyBackup && (
                      <div className="text-xs text-gray-500 mt-2">
                        Last backup: {new Date(lastDailyBackup).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={toggleDailyAutoBackup}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      dailyAutoBackupEnabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        dailyAutoBackupEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Developer Tab */}
        {activeTab === 'developer' && (
          <section className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-4 bg-red-50 p-4 rounded-xl border border-red-200 text-xs text-red-700">
              <p className="font-bold mb-1">⚠️ Developer Tools - Use with Caution</p>
              <p>These actions are irreversible. Make sure you have backups before proceeding.</p>
            </div>

            <div className="space-y-4">
              {/* Soft Reset */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-slate-800 mb-1">Soft Reset</h4>
                    <p className="text-xs text-slate-500">Delete all transactions and reset account balances to 0. Keeps accounts, categories, and rules.</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('⚠️ This will DELETE ALL transactions and reset account balances to 0. This cannot be undone. Are you sure?')) {
                      onUpdateSettings({ ...localSettings, __resetTransactions: true } as any);
                    }
                  }}
                  className="w-full px-4 py-3 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 transition-colors"
                >
                  Reset Transactions & Balances
                </button>
              </div>

              {/* Hard Reset */}
              <div className="bg-white rounded-xl shadow-sm border border-red-300 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-red-600 mb-1">Hard Reset (Factory Reset)</h4>
                    <p className="text-xs text-slate-500">Delete ALL data including transactions, accounts, categories, and rules. Resets to default state.</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const confirmation = window.prompt('⚠️ DANGER: This will DELETE ALL YOUR DATA! Type "DELETE EVERYTHING" to confirm:');
                    if (confirmation === 'DELETE EVERYTHING') {
                      onUpdateSettings({ ...localSettings, __resetToDefault: true } as any);
                    } else if (confirmation) {
                      alert('Confirmation text did not match. Reset cancelled.');
                    }
                  }}
                  className="w-full px-4 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
                >
                  Factory Reset (Delete Everything)
                </button>
              </div>

              {/* Database Info */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <h4 className="font-bold text-slate-800 mb-3">Database Stats</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="text-xs text-slate-500 mb-1">Transactions</div>
                    <div className="font-bold text-slate-800">{transactions?.length || 0}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="text-xs text-slate-500 mb-1">Accounts</div>
                    <div className="font-bold text-slate-800">{localSettings.accounts.length}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="text-xs text-slate-500 mb-1">Categories</div>
                    <div className="font-bold text-slate-800">{localSettings.categories.length}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="text-xs text-slate-500 mb-1">Rules</div>
                    <div className="font-bold text-slate-800">{localSettings.recurringRules.length}</div>
                  </div>
                  {orphanedTransactionsCount > 0 && (
                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 col-span-2">
                      <div className="text-xs text-orange-600 mb-1">Orphaned Transactions</div>
                      <div className="font-bold text-orange-700">{orphanedTransactionsCount}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Account Edit Modal - Super Light Backdrop */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-100/80 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
               <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center">
                  <h4 className="font-bold text-lg text-slate-800">{editingAccount.id ? 'Edit Account' : 'New Account'}</h4>
                  <button onClick={() => setEditingAccount(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"><X size={20} /></button>
               </div>
               
               <div className="p-5 space-y-4 overflow-y-auto">
                 <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Account Name</label>
                    <input 
                      type="text"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="e.g. Chase Sapphire"
                      value={editingAccount.name}
                      onChange={(e) => setEditingAccount(prev => ({ ...prev!, name: e.target.value }))}
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-3">
                   <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Type</label>
                      <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        value={editingAccount.type}
                        onChange={(e) => setEditingAccount(prev => ({ ...prev!, type: e.target.value as AccountType }))}
                      >
                        {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Last 4 Digits</label>
                      <input 
                        type="text"
                        maxLength={4}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="1234"
                        value={editingAccount.last4Digits || ''}
                        onChange={(e) => setEditingAccount(prev => ({ ...prev!, last4Digits: e.target.value.replace(/\D/g,'') }))}
                      />
                   </div>
                 </div>

                 <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Current Balance</label>
                    <input 
                      type="number" step="0.01"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      value={editingAccount.balance || 0}
                      onChange={(e) => setEditingAccount(prev => ({ ...prev!, balance: parseFloat(e.target.value) }))}
                    />
                    <p className="text-[10px] text-slate-400 mt-1.5 ml-1">Use negative value for Credit Card debt.</p>
                 </div>

                 <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <div className="text-xs font-bold text-slate-700">Auto-update Balance</div>
                      <div className="text-[10px] text-slate-400">Update balance from SMS/Text automatically</div>
                    </div>
                    <button
                      onClick={() => setEditingAccount(prev => ({ ...prev!, autoUpdateBalance: !prev!.autoUpdateBalance }))}
                      className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${editingAccount.autoUpdateBalance ? 'bg-brand-500' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${editingAccount.autoUpdateBalance ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                 </div>

                 {/* Account Replacement Section - Only for new accounts */}
                 {!editingAccount.id && (settings.accounts.length > 0 || orphanedTransactionsCount > 0) && (
                   <div className="p-3 bg-teal-50 rounded-xl border border-teal-100">
                     <div className="text-xs font-bold text-teal-700 mb-2">🔄 Replace Old Account?</div>
                     <div className="text-[10px] text-teal-600 mb-3">Link existing transactions to this new account</div>
                     <select
                       value={replacingAccountId || ''}
                       onChange={(e) => setReplacingAccountId(e.target.value || null)}
                       className="w-full p-2.5 bg-white border border-teal-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                     >
                       <option value="">No - This is a new account</option>
                       {orphanedTransactionsCount > 0 && (
                         <option value="ORPHANS">Orphaned Transactions Only ({orphanedTransactionsCount})</option>
                       )}
                       {settings.accounts.map(acc => (
                         <option key={acc.id} value={acc.id}>
                           Replace: {acc.name} ({acc.last4Digits || 'No digits'})
                         </option>
                       ))}
                     </select>
                   </div>
                 )}

                 <div className="pt-4 border-t border-slate-100">
                    <h5 className="text-xs font-bold text-brand-600 mb-3 uppercase tracking-wider">Limits & Alerts</h5>
                    <div className="grid grid-cols-2 gap-3">
                       <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block">Monthly Budget</label>
                          <input 
                            type="number" step="100"
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            placeholder="Optional"
                            value={editingAccount.monthlySpendingLimit || ''}
                            onChange={(e) => setEditingAccount(prev => ({ ...prev!, monthlySpendingLimit: parseFloat(e.target.value) || undefined }))}
                          />
                       </div>
                       {editingAccount.type === 'Credit Card' && (
                         <>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 mb-1 block">Credit Limit</label>
                                <input 
                                  type="number" step="100"
                                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                  placeholder="Total Limit"
                                  value={editingAccount.totalCreditLimit || ''}
                                  onChange={(e) => setEditingAccount(prev => ({ ...prev!, totalCreditLimit: parseFloat(e.target.value) || undefined }))}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 mb-1 block">Payment Due Day</label>
                                <input 
                                  type="number" min="1" max="31"
                                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                  placeholder="Day (1-31)"
                                  value={editingAccount.paymentDueDay || ''}
                                  onChange={(e) => setEditingAccount(prev => ({ ...prev!, paymentDueDay: parseInt(e.target.value) || undefined }))}
                                />
                            </div>
                         </>
                       )}
                    </div>
                 </div>
               </div>

               <div className="p-5 border-t border-slate-50 flex gap-3 bg-slate-50/50">
                  {editingAccount.id && (
                    <button 
                      onClick={() => handleDeleteAccount(editingAccount.id!)}
                      className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                  <button 
                   onClick={handleSaveAccount}
                   disabled={!editingAccount.name?.trim()}
                   className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-bold text-sm shadow-brand-500/20 shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:shadow-none"
                 >
                   {editingAccount.id ? 'Update Account' : 'Create Account'}
                 </button>
               </div>
           </div>
        </div>
      )}

      {showBackupModal && (
        <BackupRestoreModal
          onClose={() => setShowBackupModal(false)}
          onRestoreComplete={() => {
            setShowBackupModal(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
};

export default SettingsView;