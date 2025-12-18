import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Transaction, TransactionType, Account } from '../types';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
  accounts: Account[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

const Dashboard: React.FC<DashboardProps> = ({ transactions, accounts }) => {
  
  // Use currency from settings (approx via transactions or default)
  const displayCurrency = transactions.length > 0 ? transactions[0].currency : 'USD';

  // Calculate Net Worth from Accounts
  const totalNetWorth = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  }, [accounts]);

  // Calculate Cash Flow (Income vs Expense) for general stats
  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    
    transactions.forEach(t => {
      if (t.type === TransactionType.INCOME) income += t.amount;
      else expense += t.amount;
    });

    return {
      income,
      expense
    };
  }, [transactions]);

  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    transactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
      });
    
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); // Sort desc
  }, [transactions]);

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
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-brand-900 to-brand-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-1 opacity-80">
          <Wallet size={16} />
          <h2 className="text-sm font-medium">Total Net Worth</h2>
        </div>
        <div className={`text-3xl font-bold mb-6 ${totalNetWorth < 0 ? 'text-red-100' : 'text-white'}`}>
          {totalNetWorth < 0 ? '-' : ''}{displayCurrency} {Math.abs(totalNetWorth).toFixed(2)}
        </div>
        
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
      </div>

      {/* Monthly Trends Chart */}
      {monthlyData.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
           <h3 className="text-lg font-bold text-slate-800 mb-4">Monthly Trends</h3>
           <div className="h-[220px] w-full text-xs">
             <ResponsiveContainer width="100%" height="100%">
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
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Spending Breakdown</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
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
    </div>
  );
};

export default Dashboard;