import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Transaction, TransactionType, Account } from '../types';
import { TrendingUp, TrendingDown, Wallet, Calendar, ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
  accounts: Account[];
  baseCurrency: string;
  dateFilter: 'month' | 'year' | 'week' | 'custom' | 'all';
  onDateFilterChange: (filter: 'month' | 'year' | 'week' | 'custom' | 'all') => void;
  customStartDate: string;
  customEndDate: string;
  onCustomStartDateChange: (date: string) => void;
  onCustomEndDateChange: (date: string) => void;
  onPreviousPeriod: () => void;
  onNextPeriod: () => void;
  currentPeriodLabel: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

const Dashboard: React.FC<DashboardProps> = ({
  transactions,
  accounts,
  baseCurrency,
  dateFilter,
  onDateFilterChange,
  customStartDate,
  customEndDate,
  onCustomStartDateChange,
  onCustomEndDateChange,
  onPreviousPeriod,
  onNextPeriod,
  currentPeriodLabel
}) => {
  // Dashboard view filter state
  const [viewFilter, setViewFilter] = useState<'all' | 'cash' | 'credit' | 'debt'>('all');

  // Use base currency from settings
  const displayCurrency = baseCurrency;

  // Filter transactions based on view filter
  const filteredByPayment = useMemo(() => {
    if (viewFilter === 'all') return transactions;
    if (viewFilter === 'debt') return []; // Debt overview doesn't show in regular stats

    return transactions.filter(t => {
      const account = accounts.find(a => a.id === t.accountId);
      if (!account) return false;

      if (viewFilter === 'cash') {
        // Cash payments: expenses from non-credit card accounts
        return t.type === TransactionType.EXPENSE && account.type !== 'Credit Card';
      } else if (viewFilter === 'credit') {
        // Credit card payments: expenses from credit card accounts
        return t.type === TransactionType.EXPENSE && account.type === 'Credit Card';
      }
      return true;
    });
  }, [transactions, accounts, viewFilter]);

  // Calculate Net Worth from Accounts
  const totalNetWorth = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  }, [accounts]);

  // Calculate Cash Flow (Income vs Expense) for general stats
  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;

    filteredByPayment.forEach(t => {
      if (t.type === TransactionType.INCOME) income += t.amount;
      else expense += t.amount;
    });

    return {
      income,
      expense
    };
  }, [filteredByPayment]);

  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    filteredByPayment
      .filter(t => t.type === TransactionType.EXPENSE)
      .forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
      });

    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); // Sort desc
  }, [filteredByPayment]);

  // Calculate total debt from credit card accounts
  const totalDebt = useMemo(() => {
    return accounts
      .filter(a => a.type === 'Credit Card' && a.balance < 0)
      .reduce((sum, acc) => sum + Math.abs(acc.balance), 0);
  }, [accounts]);

  // Get credit card accounts for debt overview
  const creditCardAccounts = useMemo(() => {
    return accounts.filter(a => a.type === 'Credit Card');
  }, [accounts]);

  // Get recent credit card transactions
  const recentCreditTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        const account = accounts.find(a => a.id === t.accountId);
        return account?.type === 'Credit Card';
      })
      .slice(0, 10);
  }, [transactions, accounts]);

  const monthlyData = useMemo(() => {
    const months: Record<string, { name: string; income: number; expense: number }> = {};
    
    transactions.forEach(t => {
      // Create key YYYY-MM
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const name = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      if (!months[key]) {
        months[key] = { name, income: 0, expense: 0 };
      }

      if (t.type === TransactionType.INCOME) {
        months[key].income += t.amount;
      } else {
        months[key].expense += t.amount;
      }
    });

    // Sort by date key (YYYY-MM) and return values
    return Object.keys(months)
      .sort()
      .map(key => months[key])
      .slice(-6); // Show last 6 months
  }, [transactions]);

  const recentActivity = transactions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6 pb-24">
      {/* Compact Month Selector Pill */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-500 rounded-full px-4 py-3 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <button
            onClick={onPreviousPeriod}
            className="p-1 hover:bg-white/20 rounded-full transition-all active:scale-95"
            title="Previous"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center flex-1 px-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Month</div>
            <div className="font-bold text-sm">{currentPeriodLabel}</div>
          </div>
          <button
            onClick={onNextPeriod}
            className="p-1 hover:bg-white/20 rounded-full transition-all active:scale-95"
            title="Next"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Debt Overview Section */}
      {viewFilter === 'debt' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-6 text-white shadow-lg">
            <h2 className="text-sm font-bold opacity-90 mb-1">Total Debt</h2>
            <div className="text-3xl font-bold">{displayCurrency} {totalDebt.toFixed(2)}</div>
          </div>

          <div className="space-y-3">
            {creditCardAccounts.map(acc => {
              const balance = Math.abs(acc.balance);
              const available = acc.totalCreditLimit ? acc.totalCreditLimit - balance : 0;
              const utilization = acc.totalCreditLimit ? (balance / acc.totalCreditLimit) * 100 : 0;

              return (
                <div key={acc.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CreditCard size={20} className="text-orange-600" />
                      <div>
                        <div className="font-bold text-slate-800">{acc.name}</div>
                        {acc.last4Digits && (
                          <div className="text-xs text-slate-400">...{acc.last4Digits}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-lg ${acc.balance < 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        {acc.currency} {balance.toFixed(2)}
                      </div>
                      {acc.paymentDueDay && (
                        <div className="text-xs text-slate-500">
                          Due: Day {acc.paymentDueDay}
                        </div>
                      )}
                    </div>
                  </div>

                  {acc.totalCreditLimit && (
                    <div>
                      <div className="flex justify-between text-xs text-slate-600 mb-1">
                        <span>Available: {acc.currency} {available.toFixed(2)}</span>
                        <span>Limit: {acc.currency} {acc.totalCreditLimit.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            utilization > 80 ? 'bg-red-500' : utilization > 50 ? 'bg-orange-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(utilization, 100)}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-500 mt-1 text-center">
                        {utilization.toFixed(1)}% utilization
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {recentCreditTransactions.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-800 mb-3">Recent Credit Card Transactions</h3>
              <div className="space-y-2">
                {recentCreditTransactions.map(t => (
                  <div key={t.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                    <div>
                      <div className="font-medium text-slate-800 text-sm">{t.merchant}</div>
                      <div className="text-xs text-slate-500">{t.date} • {t.category}</div>
                    </div>
                    <div className="font-bold text-slate-800">
                      -{t.currency} {t.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Balance Card with View Filter */}
      <div className="bg-gradient-to-br from-brand-900 to-brand-600 rounded-2xl p-6 text-white shadow-lg">
        {/* Header with Inline Filter Selector */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 opacity-80">
            <Wallet size={16} />
            <h2 className="text-sm font-medium">Total Net Worth</h2>
          </div>
          {/* Filter Dropdown */}
          <div className="relative">
            <select
              value={viewFilter}
              onChange={(e) => setViewFilter(e.target.value as 'all' | 'cash' | 'credit' | 'debt')}
              className="bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/30 cursor-pointer hover:bg-white/30 transition-all appearance-none pr-8"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='white' d='M6 8L2 4h8z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.5rem center'
              }}
            >
              <option value="all" className="bg-brand-800 text-white">All Spending</option>
              <option value="cash" className="bg-brand-800 text-white">Cash Only</option>
              <option value="credit" className="bg-brand-800 text-white">Credit Only</option>
              <option value="debt" className="bg-brand-800 text-white">Debt Overview</option>
            </select>
          </div>
        </div>

        {/* Amount */}
        <div className={`text-3xl font-bold mb-4 ${totalNetWorth < 0 ? 'text-red-100' : 'text-white'}`}>
          {totalNetWorth < 0 ? '-' : ''}{displayCurrency} {Math.abs(totalNetWorth).toFixed(2)}
        </div>

        {/* Income/Expense Stats */}
        {viewFilter !== 'debt' && (
          <div className="flex justify-between items-center bg-white/10 rounded-xl p-3 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-full">
                <TrendingUp className="w-5 h-5 text-green-300" />
              </div>
              <div>
                <div className="text-xs text-brand-100">Total Income</div>
                <div className="font-semibold text-green-300">+{summary.income.toFixed(0)}</div>
              </div>
            </div>
            <div className="w-px h-8 bg-white/20 mx-2"></div>
            <div className="flex items-center gap-3 text-right">
              <div>
                <div className="text-xs text-brand-100">Total Spent</div>
                <div className="font-semibold text-red-300">-{summary.expense.toFixed(0)}</div>
              </div>
              <div className="p-2 bg-red-500/20 rounded-full">
                <TrendingDown className="w-5 h-5 text-red-300" />
              </div>
            </div>
          </div>
        )}
      </div>

      {viewFilter !== 'debt' && (
        <>


      {/* Monthly Trends Chart */}
      {monthlyData.length > 0 && (
        <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-6 shadow-sm border border-slate-100">
           <h3 className="text-lg font-bold text-slate-800 mb-4">Monthly Trends</h3>
           <div className="h-[220px] w-full text-xs">
             <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={220}>
               <BarChart data={monthlyData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                 <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                 <Tooltip 
                   cursor={{fill: '#f8fafc'}}
                   formatter={(value: number) => `${displayCurrency} ${value.toFixed(2)}`}
                   contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                 />
                 <Legend iconType="circle" />
                 <Bar name="Income" dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                 <Bar name="Expense" dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      )}

      {/* Spending Breakdown */}
      {categoryData.length > 0 && (
        <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Spending Breakdown</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => `${displayCurrency} ${value.toFixed(2)}`}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {categoryData.slice(0, 4).map((cat, i) => (
              <div key={cat.name} className="flex items-center gap-2 text-xs text-slate-600">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                <span className="truncate">{cat.name}</span>
                <span className="ml-auto font-medium">{displayCurrency} {cat.value.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-slate-800 px-1">Recent Activity</h3>
        {recentActivity.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
            No transactions yet
          </div>
        ) : (
          recentActivity.map((t) => (
            <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  t.type === TransactionType.EXPENSE ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'
                }`}>
                  {t.type === TransactionType.EXPENSE ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
                </div>
                <div>
                  <div className="font-semibold text-slate-800">{t.merchant}</div>
                  <div className="text-xs text-slate-500">{t.date} • {t.category}</div>
                </div>
              </div>
              <div className={`font-bold ${
                t.type === TransactionType.EXPENSE ? 'text-slate-800' : 'text-green-600'
              }`}>
                {t.type === TransactionType.EXPENSE ? '-' : '+'}{t.amount.toFixed(2)}
              </div>
            </div>
          ))
        )}
      </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;