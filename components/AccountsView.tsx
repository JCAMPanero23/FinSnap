import React, { useMemo } from 'react';
import { Account, Transaction, TransactionType } from '../types';
import { CreditCard, Wallet, Building2, Banknote, AlertTriangle, CheckCircle2, ChevronRight, Calendar } from 'lucide-react';

interface AccountsViewProps {
  accounts: Account[];
  transactions: Transaction[];
  onSelectAccount: (accountId: string) => void;
}

const AccountsView: React.FC<AccountsViewProps> = ({ accounts, transactions, onSelectAccount }) => {
  
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const getAccountStats = (accountId: string) => {
    const accountTxns = transactions.filter(t => t.accountId === accountId);
    
    const monthExpenses = accountTxns
      .filter(t => t.type === TransactionType.EXPENSE && new Date(t.date) >= currentMonthStart)
      .reduce((sum, t) => sum + t.amount, 0);
      
    const monthIncome = accountTxns
      .filter(t => t.type === TransactionType.INCOME && new Date(t.date) >= currentMonthStart)
      .reduce((sum, t) => sum + t.amount, 0);

    return { monthExpenses, monthIncome };
  };

  const renderAccountIcon = (type: string) => {
    switch (type) {
      case 'Credit Card': return <CreditCard size={20} className="text-white" />;
      case 'Bank': return <Building2 size={20} className="text-white" />;
      case 'Cash': return <Banknote size={20} className="text-white" />;
      default: return <Wallet size={20} className="text-white" />;
    }
  };

  const getPaymentAlert = (account: Account) => {
    if (account.type !== 'Credit Card' || !account.paymentDueDay) return null;
    
    const today = new Date();
    const currentDay = today.getDate();
    const dueDay = account.paymentDueDay;
    
    // If balance is negative (debt) and close to due date (within 5 days)
    if (account.balance < 0) {
      let daysLeft = dueDay - currentDay;
      if (daysLeft < 0) daysLeft += 30; // Rough wrap around logic
      
      if (daysLeft <= 5) {
        return {
          level: daysLeft <= 2 ? 'critical' : 'warning',
          message: daysLeft === 0 ? 'Payment due today!' : `Payment due in ${daysLeft} days`
        };
      }
    }
    return null;
  };

  const totalNetWorth = accounts.reduce((acc, curr) => acc + (curr.balance || 0), 0);

  return (
    <div className="space-y-6 pb-24">
      {/* Net Worth Header */}
      <div className="bg-slate-800 rounded-2xl p-6 text-white shadow-lg">
        <h2 className="text-slate-400 text-sm font-medium mb-1">Total Net Worth</h2>
        <div className={`text-3xl font-bold ${totalNetWorth >= 0 ? 'text-white' : 'text-red-300'}`}>
          {totalNetWorth < 0 ? '-' : ''}${Math.abs(totalNetWorth).toFixed(2)}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 px-1">Your Accounts</h3>
        
        {accounts.length === 0 && (
          <div className="text-center py-8 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
            No accounts configured. Go to Settings to add accounts.
          </div>
        )}

        {accounts.map(acc => {
          const stats = getAccountStats(acc.id);
          const paymentAlert = getPaymentAlert(acc);
          
          // Budget Calculation
          const budgetPercent = acc.monthlySpendingLimit 
            ? Math.min(100, (stats.monthExpenses / acc.monthlySpendingLimit) * 100) 
            : 0;
            
          const isOverBudget = acc.monthlySpendingLimit && stats.monthExpenses > acc.monthlySpendingLimit;

          return (
            <div 
              key={acc.id}
              onClick={() => onSelectAccount(acc.id)} 
              className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 active:scale-[0.99] transition-transform cursor-pointer relative overflow-hidden group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md" style={{ backgroundColor: acc.color }}>
                    {renderAccountIcon(acc.type)}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">{acc.name}</div>
                    <div className="text-xs text-slate-400 font-mono">
                      {acc.type} •••• {acc.last4Digits || '####'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${acc.balance >= 0 ? 'text-slate-800' : 'text-red-500'}`}>
                    {acc.balance < 0 ? '-' : ''}${Math.abs(acc.balance).toFixed(2)}
                  </div>
                  {acc.type === 'Credit Card' && acc.totalCreditLimit && (
                    <div className="text-[10px] text-slate-400">
                      of ${acc.totalCreditLimit.toLocaleString()} Limit
                    </div>
                  )}
                </div>
              </div>

              {/* Warnings & Alerts */}
              {paymentAlert && (
                 <div className={`mb-3 flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg ${
                   paymentAlert.level === 'critical' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                 }`}>
                   <Calendar size={14} />
                   {paymentAlert.message}
                 </div>
              )}

              {/* Progress Bars */}
              <div className="space-y-3">
                {/* Budget Progress */}
                {acc.monthlySpendingLimit && (
                  <div>
                    <div className="flex justify-between text-[10px] font-medium text-slate-500 mb-1">
                      <span>Monthly Budget</span>
                      <span className={isOverBudget ? 'text-red-500' : ''}>
                        ${stats.monthExpenses.toFixed(0)} / ${acc.monthlySpendingLimit}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${isOverBudget ? 'bg-red-500' : budgetPercent > 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${budgetPercent}%` }}
                      ></div>
                    </div>
                    {isOverBudget && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-red-500 font-medium">
                        <AlertTriangle size={10} /> Over budget by ${(stats.monthExpenses - acc.monthlySpendingLimit).toFixed(0)}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Income vs Expense Mini Bar */}
                {(!acc.monthlySpendingLimit) && (
                   <div className="flex gap-1 h-1.5 mt-2 rounded-full overflow-hidden">
                      <div className="bg-green-500" style={{ flex: stats.monthIncome || 1 }}></div>
                      <div className="bg-slate-200 w-px"></div>
                      <div className="bg-red-500" style={{ flex: stats.monthExpenses || 0.1 }}></div>
                   </div>
                )}
              </div>
              
              <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300">
                <ChevronRight size={24} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AccountsView;