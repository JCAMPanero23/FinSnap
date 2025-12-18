import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Transaction, TransactionType, Account } from '../types';
import { TrendingUp, TrendingDown, Wallet, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

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

// Neo-Brutalist Color Palette for Charts
const COLORS = ['#BFFF00', '#FF006E', '#00F5FF', '#FFD600', '#000000', '#808080', '#FFFFFF'];

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

  // Use base currency from settings
  const displayCurrency = baseCurrency;

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
    <div className="space-y-6 pb-24 animate-slide-up">
      {/* Date Filter - Brutalist Style */}
      <div className="bg-white border-3 border-black shadow-brutal-md p-4 animate-slide-up stagger-1">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-lime border-2 border-black">
            <Calendar size={18} className="text-black" />
          </div>
          <h3 className="text-sm font-display font-bold text-black uppercase tracking-wider">Period</h3>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {(['all', 'month', 'year', 'week', 'custom'] as const).map((filter, idx) => (
            <button
              key={filter}
              onClick={() => onDateFilterChange(filter)}
              className={`px-4 py-2 border-3 border-black font-display font-bold text-xs uppercase tracking-wide transition-all duration-150 ${
                dateFilter === filter
                  ? 'bg-lime text-black shadow-brutal-sm translate-x-0 translate-y-0'
                  : 'bg-white text-black hover:bg-near-white hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-sm'
              }`}
            >
              {filter === 'all' ? 'All' : filter}
            </button>
          ))}
        </div>

        {/* Navigation Controls for Month/Year/Week */}
        {(dateFilter === 'month' || dateFilter === 'year' || dateFilter === 'week') && (
          <div className="flex items-center justify-between pt-3 border-t-3 border-black mt-3">
            <button
              onClick={onPreviousPeriod}
              className="p-2 border-2 border-black hover:bg-lime hover:shadow-brutal-sm hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-150"
              title="Previous"
            >
              <ChevronLeft size={20} className="text-black" />
            </button>
            <div className="text-sm font-mono font-bold text-black text-center flex-1 uppercase tracking-wider">
              {currentPeriodLabel}
            </div>
            <button
              onClick={onNextPeriod}
              className="p-2 border-2 border-black hover:bg-lime hover:shadow-brutal-sm hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-150"
              title="Next"
            >
              <ChevronRight size={20} className="text-black" />
            </button>
          </div>
        )}

        {dateFilter === 'custom' && (
          <div className="flex gap-2 items-center pt-3 border-t-3 border-black mt-3">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => onCustomStartDateChange(e.target.value)}
              className="flex-1 px-3 py-2 bg-white border-3 border-black text-xs font-mono focus:outline-none focus:shadow-[0_0_0_3px_#BFFF00]"
            />
            <span className="text-black text-xs font-bold">→</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => onCustomEndDateChange(e.target.value)}
              className="flex-1 px-3 py-2 bg-white border-3 border-black text-xs font-mono focus:outline-none focus:shadow-[0_0_0_3px_#BFFF00]"
            />
          </div>
        )}
      </div>

      {/* Balance Card - Hero Section */}
      <div className="bg-black border-3 border-black shadow-brutal-lg p-6 animate-slide-up stagger-2 relative overflow-hidden">
        {/* Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-lime via-hot-pink to-electric-cyan"></div>

        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-lime">
            <Wallet size={20} className="text-black" />
          </div>
          <h2 className="text-xs font-display font-bold text-white uppercase tracking-widest">Net Worth</h2>
        </div>
        <div className={`text-5xl font-mono font-bold mb-8 number-display ${totalNetWorth < 0 ? 'text-hot-pink' : 'text-lime'}`}>
          {totalNetWorth < 0 ? '-' : ''}{displayCurrency} {Math.abs(totalNetWorth).toFixed(2)}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border-3 border-lime p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-black" strokeWidth={3} />
              <div className="text-[10px] font-display font-bold text-black uppercase tracking-wider">Income</div>
            </div>
            <div className="font-mono font-bold text-2xl text-black number-display">+{summary.income.toFixed(0)}</div>
          </div>

          <div className="bg-white border-3 border-hot-pink p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-5 h-5 text-black" strokeWidth={3} />
              <div className="text-[10px] font-display font-bold text-black uppercase tracking-wider">Spent</div>
            </div>
            <div className="font-mono font-bold text-2xl text-black number-display">-{summary.expense.toFixed(0)}</div>
          </div>
        </div>
      </div>

      {/* Monthly Trends Chart */}
      {monthlyData.length > 0 && (
        <div className="bg-white border-3 border-black shadow-brutal-md p-6 animate-slide-up stagger-3">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b-3 border-black">
            <div className="w-1 h-8 bg-lime"></div>
            <h3 className="text-base font-display font-bold text-black uppercase tracking-wider">Cash Flow</h3>
          </div>
           <div className="h-[220px] w-full text-xs">
             <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={220}>
               <BarChart data={monthlyData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="0" vertical={false} stroke="#000000" strokeWidth={1} />
                 <XAxis dataKey="name" axisLine={{stroke: '#000', strokeWidth: 2}} tickLine={false} tick={{fill: '#000', fontFamily: 'JetBrains Mono', fontWeight: 600}} />
                 <YAxis axisLine={{stroke: '#000', strokeWidth: 2}} tickLine={false} tick={{fill: '#000', fontFamily: 'JetBrains Mono', fontWeight: 600}} />
                 <Tooltip
                   cursor={{fill: '#F5F5F5'}}
                   formatter={(value: number) => `${displayCurrency} ${value.toFixed(2)}`}
                   contentStyle={{ border: '3px solid #000', boxShadow: '4px 4px 0 #000', fontFamily: 'JetBrains Mono' }}
                 />
                 <Legend iconType="square" wrapperStyle={{fontFamily: 'Outfit', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px'}} />
                 <Bar name="Income" dataKey="income" fill="#BFFF00" radius={[0, 0, 0, 0]} maxBarSize={40} stroke="#000" strokeWidth={2} />
                 <Bar name="Expense" dataKey="expense" fill="#FF006E" radius={[0, 0, 0, 0]} maxBarSize={40} stroke="#000" strokeWidth={2} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      )}

      {/* Spending Breakdown */}
      {categoryData.length > 0 && (
        <div className="bg-white border-3 border-black shadow-brutal-md p-6 animate-slide-up stagger-4">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b-3 border-black">
            <div className="w-1 h-8 bg-hot-pink"></div>
            <h3 className="text-base font-display font-bold text-black uppercase tracking-wider">Categories</h3>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={0}
                  dataKey="value"
                  stroke="#000"
                  strokeWidth={2}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `${displayCurrency} ${value.toFixed(2)}`}
                  contentStyle={{ border: '3px solid #000', boxShadow: '4px 4px 0 #000', fontFamily: 'JetBrains Mono' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2">
            {categoryData.slice(0, 5).map((cat, i) => (
              <div key={cat.name} className="flex items-center gap-3 border-2 border-black p-2 hover:shadow-brutal-sm hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-150">
                <div className="w-6 h-6 border-2 border-black" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                <span className="truncate font-display font-bold text-xs uppercase text-black">{cat.name}</span>
                <span className="ml-auto font-mono font-bold text-sm text-black">{displayCurrency} {cat.value.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="space-y-3 animate-slide-up stagger-5">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-electric-cyan"></div>
          <h3 className="text-base font-display font-bold text-black uppercase tracking-wider">Recent</h3>
        </div>
        {recentActivity.length === 0 ? (
          <div className="text-center py-12 bg-white border-3 border-black border-dashed">
            <div className="font-display font-bold text-black uppercase text-sm">No Data</div>
          </div>
        ) : (
          recentActivity.map((t, idx) => (
            <div
              key={t.id}
              className="bg-white border-3 border-black p-4 flex items-center justify-between hover:shadow-brutal-md hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-150 animate-slide-up"
              style={{ animationDelay: `${(idx + 6) * 100}ms` }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 border-2 border-black flex items-center justify-center ${
                  t.type === TransactionType.EXPENSE ? 'bg-hot-pink' : 'bg-lime'
                }`}>
                  {t.type === TransactionType.EXPENSE ? <TrendingDown size={18} className="text-white" strokeWidth={3} /> : <TrendingUp size={18} className="text-black" strokeWidth={3} />}
                </div>
                <div>
                  <div className="font-display font-bold text-sm text-black">{t.merchant}</div>
                  <div className="text-[10px] font-mono text-mid-gray uppercase">{t.date} • {t.category}</div>
                </div>
              </div>
              <div className={`font-mono font-bold text-lg number-display ${
                t.type === TransactionType.EXPENSE ? 'text-black' : 'text-black'
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