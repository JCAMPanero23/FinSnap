import React, { useState } from 'react';
import { AppSettings, RecurringRule, SavingsGoal, TransactionType, Frequency } from '../types';
import { Plus, Trash2, Calendar, AlertCircle, CheckCircle2, PiggyBank, Target, ArrowRight, DollarSign, Edit3, X, Save, TrendingUp } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface PlanningViewProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onAddTransaction: (tx: any) => void; // Quick link to add a payment/deposit
}

const PlanningView: React.FC<PlanningViewProps> = ({ settings, onUpdateSettings, onAddTransaction }) => {
  const [activeTab, setActiveTab] = useState<'bills' | 'savings'>('bills');
  
  // --- Savings State ---
  const [editingGoal, setEditingGoal] = useState<Partial<SavingsGoal> | null>(null);
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');

  // --- Bills State ---
  const [editingRule, setEditingRule] = useState<Partial<RecurringRule> | null>(null);

  // --- Helpers ---
  const getNextDueDate = (day?: number) => {
    if (!day) return null;
    const today = new Date();
    const currentDay = today.getDate();
    let nextDate = new Date(today.getFullYear(), today.getMonth(), day);
    
    if (currentDay > day) {
      // Move to next month
      nextDate = new Date(today.getFullYear(), today.getMonth() + 1, day);
    }
    return nextDate;
  };

  const getDaysUntil = (date: Date) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    date.setHours(0,0,0,0);
    const diffTime = date.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // --- Savings Handlers ---
  const handleSaveGoal = () => {
    if (!editingGoal?.name || !editingGoal.targetAmount) return;

    const newGoal: SavingsGoal = {
      id: editingGoal.id || uuidv4(),
      name: editingGoal.name,
      targetAmount: Number(editingGoal.targetAmount),
      currentAmount: Number(editingGoal.currentAmount || 0),
      currency: settings.baseCurrency,
      color: editingGoal.color || '#10b981',
      deadline: editingGoal.deadline
    };

    const updatedGoals = editingGoal.id 
      ? settings.savingsGoals.map(g => g.id === editingGoal.id ? newGoal : g)
      : [...settings.savingsGoals, newGoal];

    onUpdateSettings({ ...settings, savingsGoals: updatedGoals });
    setEditingGoal(null);
  };

  const handleDeleteGoal = (id: string) => {
    if(window.confirm("Delete this savings goal?")) {
      onUpdateSettings({ 
        ...settings, 
        savingsGoals: settings.savingsGoals.filter(g => g.id !== id) 
      });
    }
  };

  const handleDeposit = () => {
    if (!depositGoalId || !depositAmount) return;
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) return;

    // 1. Update Goal Amount
    const updatedGoals = settings.savingsGoals.map(g => {
      if (g.id === depositGoalId) {
        return { ...g, currentAmount: g.currentAmount + amount };
      }
      return g;
    });

    onUpdateSettings({ ...settings, savingsGoals: updatedGoals });

    // 2. Offer to create a transaction record
    if (window.confirm("Do you want to record this deposit as a Transfer in your history?")) {
       const goalName = settings.savingsGoals.find(g => g.id === depositGoalId)?.name;
       onAddTransaction({
         amount: amount,
         merchant: `Deposit to ${goalName}`,
         type: TransactionType.TRANSFER,
         category: 'Savings',
         date: new Date().toISOString().split('T')[0]
       });
    }

    setDepositGoalId(null);
    setDepositAmount('');
  };

  // --- Bills Handlers ---
  const handleSaveRule = () => {
    if (!editingRule?.merchantKeyword) return;

    const newRule: RecurringRule = {
       id: editingRule.id || uuidv4(),
       merchantKeyword: editingRule.merchantKeyword,
       category: editingRule.category,
       type: editingRule.type || TransactionType.EXPENSE,
       frequency: editingRule.frequency || 'MONTHLY',
       dueDay: editingRule.dueDay,
       avgAmount: Number(editingRule.avgAmount || 0)
    };

    const updatedRules = editingRule.id
      ? settings.recurringRules.map(r => r.id === editingRule.id ? newRule : r)
      : [...settings.recurringRules, newRule];

    onUpdateSettings({ ...settings, recurringRules: updatedRules });
    setEditingRule(null);
  };

  const handleDeleteRule = (id: string) => {
    if(window.confirm("Delete this bill rule?")) {
      onUpdateSettings({ 
        ...settings, 
        recurringRules: settings.recurringRules.filter(r => r.id !== id) 
      });
    }
  };

  return (
    <div className="h-full flex flex-col pb-24 bg-slate-50">
      {/* Tabs */}
      <div className="px-6 py-4 bg-white border-b border-slate-100 sticky top-0 z-10">
         <h2 className="text-2xl font-bold text-slate-800 mb-4">Planning</h2>
         <div className="flex p-1 bg-slate-100 rounded-xl">
           <button 
             onClick={() => setActiveTab('bills')}
             className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'bills' ? 'bg-white shadow text-brand-600' : 'text-slate-500'}`}
           >
             <Calendar size={16} /> Bills & Rules
           </button>
           <button 
             onClick={() => setActiveTab('savings')}
             className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'savings' ? 'bg-white shadow text-brand-600' : 'text-slate-500'}`}
           >
             <PiggyBank size={16} /> Savings
           </button>
         </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        
        {/* --- BILLS TAB --- */}
        {activeTab === 'bills' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <div className="bg-blue-50 p-4 rounded-xl text-xs text-blue-700 mb-4 flex gap-2">
               <AlertCircle size={16} className="shrink-0" />
               <p>These rules help parse your SMS. Set a "Due Day" to see them as upcoming bills here. They won't auto-add to expenses until parsed or manually added.</p>
            </div>

            <button 
               onClick={() => setEditingRule({ merchantKeyword: '', type: TransactionType.EXPENSE })}
               className="w-full py-3 bg-white border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-sm flex items-center justify-center gap-2 hover:border-brand-300 hover:text-brand-600 transition-all"
            >
               <Plus size={18} /> Add Recurring Bill / Rule
            </button>

            <div className="space-y-3">
              {settings.recurringRules.map(rule => {
                 const nextDate = getNextDueDate(rule.dueDay);
                 const daysLeft = nextDate ? getDaysUntil(nextDate) : null;
                 
                 return (
                   <div key={rule.id} onClick={() => setEditingRule(rule)} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 active:scale-[0.99] transition-transform cursor-pointer">
                      <div className="flex justify-between items-start mb-2">
                         <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${rule.type === TransactionType.TRANSFER ? 'bg-purple-50 text-purple-500' : 'bg-orange-50 text-orange-500'}`}>
                               {rule.type === TransactionType.TRANSFER ? <ArrowRight size={18} /> : <Calendar size={18} />}
                            </div>
                            <div>
                               <div className="font-bold text-slate-800">{rule.merchantKeyword}</div>
                               <div className="text-xs text-slate-400">{rule.category || 'Uncategorized'} • {rule.frequency || 'Monthly'}</div>
                            </div>
                         </div>
                         {rule.avgAmount && (
                           <div className="font-bold text-slate-700">~{settings.baseCurrency} {rule.avgAmount}</div>
                         )}
                      </div>
                      
                      {daysLeft !== null && (
                        <div className={`mt-3 flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg ${
                           daysLeft <= 3 ? 'bg-red-50 text-red-600' : daysLeft <= 7 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'
                        }`}>
                           <Calendar size={14} />
                           {daysLeft === 0 ? 'Due Today' : `Due in ${daysLeft} days`} ({nextDate?.toLocaleDateString()})
                        </div>
                      )}
                      
                      {!rule.dueDay && (
                        <div className="mt-2 text-[10px] text-slate-400 italic">No due date set - used for parsing only.</div>
                      )}
                   </div>
                 );
              })}
            </div>
          </div>
        )}

        {/* --- SAVINGS TAB --- */}
        {activeTab === 'savings' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
             {/* Total Savings Card */}
             <div className="bg-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-500/20">
                <div className="flex items-center gap-2 mb-1 opacity-80">
                  <PiggyBank size={16} />
                  <h2 className="text-sm font-medium">Total Saved</h2>
                </div>
                <div className="text-3xl font-bold">
                  {settings.baseCurrency} {settings.savingsGoals.reduce((sum, g) => sum + g.currentAmount, 0).toFixed(2)}
                </div>
             </div>

             <button 
               onClick={() => setEditingGoal({ name: '', targetAmount: 1000, currentAmount: 0 })}
               className="w-full py-3 bg-white border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-sm flex items-center justify-center gap-2 hover:border-emerald-300 hover:text-emerald-600 transition-all"
            >
               <Plus size={18} /> New Savings Goal
            </button>

            <div className="space-y-4">
               {settings.savingsGoals.map(goal => {
                 const progress = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
                 
                 return (
                   <div key={goal.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                      <div className="flex justify-between items-start mb-3">
                         <div onClick={() => setEditingGoal(goal)} className="cursor-pointer">
                            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                               {goal.name}
                               <Edit3 size={14} className="text-slate-300" />
                            </h3>
                            {goal.deadline && <div className="text-xs text-slate-400">Target: {goal.deadline}</div>}
                         </div>
                         <button 
                           onClick={() => setDepositGoalId(goal.id)}
                           className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-100 flex items-center gap-1"
                         >
                            <Plus size={12} /> Deposit
                         </button>
                      </div>

                      <div className="mb-2 flex items-end justify-between">
                         <div className="text-2xl font-bold text-slate-700">
                            <span className="text-sm text-slate-400 font-normal mr-1">{settings.baseCurrency}</span>
                            {goal.currentAmount.toLocaleString()}
                         </div>
                         <div className="text-xs font-bold text-slate-400 mb-1">
                            of {goal.targetAmount.toLocaleString()}
                         </div>
                      </div>

                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                         <div 
                           className="h-full rounded-full transition-all duration-500"
                           style={{ width: `${progress}%`, backgroundColor: goal.color }}
                         ></div>
                      </div>
                      <div className="mt-1 text-right text-[10px] font-bold" style={{ color: goal.color }}>
                         {progress.toFixed(0)}%
                      </div>
                   </div>
                 );
               })}
            </div>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}

      {/* Edit Rule Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm sm:overflow-hidden">
           <div className="bg-white w-full max-w-md rounded-2xl shadow-xl animate-in slide-in-from-bottom-10 flex flex-col max-h-[85vh]">
              
              <div className="flex justify-between items-center p-4 border-b border-slate-100">
                 <h3 className="font-bold text-lg">{editingRule.id ? 'Edit Bill / Rule' : 'New Recurring Bill'}</h3>
                 <button onClick={() => setEditingRule(null)}><X size={20} className="text-slate-400" /></button>
              </div>

              {/* Scrollable Content with padding at bottom for keyboard safety */}
              <div className="flex-1 overflow-y-auto p-5 pb-32 space-y-4">
                 <div>
                    <label className="text-xs font-bold text-slate-500">Merchant Keyword (SMS Match)</label>
                    <input type="text" className="w-full p-3 bg-slate-50 rounded-xl mt-1 text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none" 
                      value={editingRule.merchantKeyword} 
                      onChange={e => setEditingRule({...editingRule, merchantKeyword: e.target.value})}
                      placeholder="e.g. Netflix"
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                       <label className="text-xs font-bold text-slate-500">Category</label>
                       <select className="w-full p-3 bg-slate-50 rounded-xl mt-1 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                         value={editingRule.category}
                         onChange={e => setEditingRule({...editingRule, category: e.target.value})}
                       >
                         <option value="">Select...</option>
                         {settings.categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="text-xs font-bold text-slate-500">Type</label>
                       <select className="w-full p-3 bg-slate-50 rounded-xl mt-1 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                         value={editingRule.type}
                         onChange={e => setEditingRule({...editingRule, type: e.target.value as TransactionType})}
                       >
                         <option value={TransactionType.EXPENSE}>Expense</option>
                         <option value={TransactionType.INCOME}>Income</option>
                         <option value={TransactionType.TRANSFER}>Transfer</option>
                       </select>
                    </div>
                 </div>
                 
                 <div className="p-3 bg-amber-50 rounded-xl space-y-3 border border-amber-100">
                    <h4 className="text-xs font-bold text-amber-700 uppercase">Alert Settings</h4>
                    <div className="grid grid-cols-2 gap-3">
                       <div>
                          <label className="text-[10px] font-bold text-amber-600">Avg Amount</label>
                          <input type="number" className="w-full p-2 bg-white rounded-lg mt-1 text-sm border border-amber-200" 
                            value={editingRule.avgAmount || ''} 
                            onChange={e => setEditingRule({...editingRule, avgAmount: parseFloat(e.target.value)})}
                            placeholder="0.00"
                          />
                       </div>
                       <div>
                          <label className="text-[10px] font-bold text-amber-600">Day of Month</label>
                          <input type="number" min="1" max="31" className="w-full p-2 bg-white rounded-lg mt-1 text-sm border border-amber-200" 
                            value={editingRule.dueDay || ''} 
                            onChange={e => setEditingRule({...editingRule, dueDay: parseInt(e.target.value)})}
                            placeholder="e.g. 5"
                          />
                       </div>
                    </div>
                 </div>
              </div>

              {/* Fixed Bottom Action Bar */}
              <div className="p-4 border-t border-slate-100 bg-white flex gap-3">
                    {editingRule.id && (
                      <button onClick={() => { handleDeleteRule(editingRule.id!); setEditingRule(null); }} className="p-3 bg-red-50 text-red-500 rounded-xl">
                        <Trash2 size={20} />
                      </button>
                    )}
                    <button onClick={handleSaveRule} className="flex-1 bg-brand-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-500/20">
                       Save Rule
                    </button>
              </div>
           </div>
        </div>
      )}

      {/* Edit Goal Modal */}
      {editingGoal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
           <div className="bg-white w-full max-w-md rounded-2xl p-5 shadow-xl animate-in slide-in-from-bottom-10">
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                 <h3 className="font-bold text-lg">{editingGoal.id ? 'Edit Goal' : 'New Goal'}</h3>
                 <button onClick={() => setEditingGoal(null)}><X size={20} className="text-slate-400" /></button>
              </div>
              <div className="space-y-3">
                 <div>
                    <label className="text-xs font-bold text-slate-500">Goal Name</label>
                    <input type="text" className="w-full p-3 bg-slate-50 rounded-xl mt-1 text-sm font-medium" 
                      value={editingGoal.name} 
                      onChange={e => setEditingGoal({...editingGoal, name: e.target.value})}
                      placeholder="e.g. New Car"
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                       <label className="text-xs font-bold text-slate-500">Target Amount</label>
                       <input type="number" className="w-full p-3 bg-slate-50 rounded-xl mt-1 text-sm" 
                         value={editingGoal.targetAmount || ''} 
                         onChange={e => setEditingGoal({...editingGoal, targetAmount: parseFloat(e.target.value)})}
                       />
                    </div>
                    <div>
                       <label className="text-xs font-bold text-slate-500">Current Saved</label>
                       <input type="number" className="w-full p-3 bg-slate-50 rounded-xl mt-1 text-sm" 
                         value={editingGoal.currentAmount || 0} 
                         onChange={e => setEditingGoal({...editingGoal, currentAmount: parseFloat(e.target.value)})}
                       />
                    </div>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500">Deadline (Optional)</label>
                    <input type="date" className="w-full p-3 bg-slate-50 rounded-xl mt-1 text-sm" 
                      value={editingGoal.deadline || ''} 
                      onChange={e => setEditingGoal({...editingGoal, deadline: e.target.value})}
                    />
                 </div>
                 
                 <div>
                   <label className="text-xs font-bold text-slate-500 mb-2 block">Color</label>
                   <div className="flex gap-2">
                     {['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'].map(c => (
                       <button 
                         key={c}
                         onClick={() => setEditingGoal({...editingGoal, color: c})}
                         className={`w-8 h-8 rounded-full border-2 ${editingGoal.color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                         style={{ backgroundColor: c }}
                       />
                     ))}
                   </div>
                 </div>

                 <div className="flex gap-3 mt-4">
                    {editingGoal.id && (
                      <button onClick={() => { handleDeleteGoal(editingGoal.id!); setEditingGoal(null); }} className="p-3 bg-red-50 text-red-500 rounded-xl">
                        <Trash2 size={20} />
                      </button>
                    )}
                    <button onClick={handleSaveGoal} className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/20">
                       Save Goal
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Deposit Modal */}
      {depositGoalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xs rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
             <h3 className="text-center font-bold text-slate-800 mb-4">Add to Savings</h3>
             <div className="relative mb-6">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl">$</span>
                <input 
                  type="number" 
                  autoFocus
                  className="w-full pl-8 pr-4 py-3 bg-slate-50 rounded-xl text-2xl font-bold text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                />
             </div>
             <div className="flex gap-2">
                <button onClick={() => setDepositGoalId(null)} className="flex-1 py-3 text-slate-500 font-semibold hover:bg-slate-50 rounded-xl">Cancel</button>
                <button onClick={handleDeposit} className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20">Deposit</button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PlanningView;