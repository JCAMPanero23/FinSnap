import React, { useMemo, useState } from 'react';
import { Transaction, TransactionType, Account } from '../types';
import { Search, TrendingDown, TrendingUp, Filter, Pencil, CreditCard, Clock, X, ChevronLeft, ChevronRight } from 'lucide-react';
import SplitTransactionsModal from './SplitTransactionsModal';

interface TransactionListProps {
  transactions: Transaction[];
  accounts?: Account[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  initialFilterAccountId?: string | null;
  onClearAccountFilter?: () => void;
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

const DATE_FILTER_TYPES: Array<'month' | 'year' | 'week' | 'custom' | 'all'> =
  ['month', 'year', 'week', 'custom', 'all'];

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  accounts = [],
  onDelete,
  onEdit,
  initialFilterAccountId,
  onClearAccountFilter,
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'INCOME' | 'CASH' | 'CREDIT'>('ALL');
  const [viewingSplitGroup, setViewingSplitGroup] = useState<string | null>(null);

  // Date Filter Type Navigation
  const handlePreviousFilterType = () => {
    const currentIndex = DATE_FILTER_TYPES.indexOf(dateFilter);
    const previousIndex = currentIndex === 0 ? DATE_FILTER_TYPES.length - 1 : currentIndex - 1;
    onDateFilterChange(DATE_FILTER_TYPES[previousIndex]);
  };

  const handleNextFilterType = () => {
    const currentIndex = DATE_FILTER_TYPES.indexOf(dateFilter);
    const nextIndex = (currentIndex + 1) % DATE_FILTER_TYPES.length;
    onDateFilterChange(DATE_FILTER_TYPES[nextIndex]);
  };

  const getFilterTypeLabel = () => {
    const labels: Record<typeof dateFilter, string> = {
      month: 'Month',
      year: 'Year',
      week: 'Week',
      custom: 'Custom',
      all: 'All Time'
    };
    return labels[dateFilter] || 'Month';
  };

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        const matchesSearch = t.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              t.category.toLowerCase().includes(searchTerm.toLowerCase());

        // Filter logic
        let matchesFilter = true;
        if (filter === 'INCOME') {
          matchesFilter = t.type === TransactionType.INCOME;
        } else if (filter === 'CASH') {
          // Cash payments: expenses from non-credit card accounts
          const account = accounts.find(a => a.id === t.accountId);
          matchesFilter = t.type === TransactionType.EXPENSE && account?.type !== 'Credit Card';
        } else if (filter === 'CREDIT') {
          // Credit card payments: expenses from credit card accounts
          const account = accounts.find(a => a.id === t.accountId);
          matchesFilter = t.type === TransactionType.EXPENSE && account?.type === 'Credit Card';
        }

        const matchesAccount = !initialFilterAccountId || t.accountId === initialFilterAccountId;

        return matchesSearch && matchesFilter && matchesAccount;
      })
      .sort((a, b) => {
        // Sort by date then time
        const dateA = new Date(`${a.date}T${a.time || '00:00'}`);
        const dateB = new Date(`${b.date}T${b.time || '00:00'}`);
        return dateB.getTime() - dateA.getTime();
      });
  }, [transactions, searchTerm, filter, initialFilterAccountId]);

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredTransactions.forEach(t => {
      if (!groups[t.date]) groups[t.date] = [];
      groups[t.date].push(t);
    });
    return groups;
  }, [filteredTransactions]);

  const getAccountName = (t: Transaction) => {
    if (t.accountId) {
      const acc = accounts.find(a => a.id === t.accountId);
      if (acc) return acc.name;
    }
    return t.account ? t.account.replace(/.*(?=\d{4})/, '...') : null;
  };

  const activeAccount = initialFilterAccountId ? accounts.find(a => a.id === initialFilterAccountId) : null;

  return (
    <div className="h-full flex flex-col pb-24 space-y-6 px-6 pt-6">
      {/* Compact Month Selector Pill */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-500 rounded-full px-4 py-3 text-white shadow-md">
        <div className="flex items-center justify-between">
          {dateFilter !== 'all' ? (
            <>
              <button
                onClick={onPreviousPeriod}
                className="p-1 hover:bg-white/20 rounded-full transition-all active:scale-95"
                title="Previous period"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="text-center flex-1 px-3">
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={handlePreviousFilterType}
                    className="p-0.5 hover:bg-white/20 rounded transition-all active:scale-95"
                    title="Previous filter type"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <div className="text-xs font-bold uppercase tracking-wide opacity-90 min-w-[60px] text-center">
                    {getFilterTypeLabel()}
                  </div>
                  <button
                    onClick={handleNextFilterType}
                    className="p-0.5 hover:bg-white/20 rounded transition-all active:scale-95"
                    title="Next filter type"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
                <div className="font-semibold text-sm mt-1.5">{currentPeriodLabel}</div>
              </div>
              <button
                onClick={onNextPeriod}
                className="p-1 hover:bg-white/20 rounded-full transition-all active:scale-95"
                title="Next period"
              >
                <ChevronRight size={18} />
              </button>
            </>
          ) : (
            <div className="text-center flex-1 px-3">
              <div className="flex items-center justify-center gap-1">
                <button
                  onClick={handlePreviousFilterType}
                  className="p-0.5 hover:bg-white/20 rounded transition-all active:scale-95"
                  title="Previous filter type"
                >
                  <ChevronLeft size={12} />
                </button>
                <div className="text-xs font-bold uppercase tracking-wide opacity-90 min-w-[60px] text-center">
                  {getFilterTypeLabel()}
                </div>
                <button
                  onClick={handleNextFilterType}
                  className="p-0.5 hover:bg-white/20 rounded transition-all active:scale-95"
                  title="Next filter type"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
              <div className="font-semibold text-sm mt-1.5">All Transactions</div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Date Range Inputs */}
      {dateFilter === 'custom' && (
        <div className="bg-white rounded-xl p-4 shadow-md border border-slate-100">
          <div className="flex gap-3 text-sm">
            <div className="flex-1">
              <label className="text-slate-600 text-xs font-medium mb-1.5 block">From Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => onCustomStartDateChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="text-slate-600 text-xs font-medium mb-1.5 block">To Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => onCustomEndDateChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors"
              />
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-0 bg-slate-50/95 backdrop-blur z-10 py-2">
        <div className="flex justify-between items-end mb-4">
           <h2 className="text-2xl font-bold text-slate-800">History</h2>
           {activeAccount && (
             <button 
               onClick={onClearAccountFilter}
               className="flex items-center gap-1 text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded-full hover:bg-slate-300"
             >
               {activeAccount.name} <X size={12} />
             </button>
           )}
        </div>
        
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-slate-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'ALL' | 'INCOME' | 'CASH' | 'CREDIT')}
            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none"
          >
            <option value="ALL">All Transactions</option>
            <option value="CASH">Cash Payments</option>
            <option value="CREDIT">Credit Card</option>
            <option value="INCOME">Income Only</option>
          </select>
        </div>

        {filteredTransactions.length > 0 && filteredTransactions.length !== transactions.length && (
          <div className="text-xs text-slate-500 text-center mb-2">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </div>
        )}
      </div>

      <div className="space-y-6">
        {Object.keys(groupedTransactions).length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p>No transactions found</p>
          </div>
        ) : (
          Object.keys(groupedTransactions).sort((a,b) => new Date(b).getTime() - new Date(a).getTime()).map(date => (
            <div key={date}>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">{date}</h3>
              <div className="space-y-3">
                {groupedTransactions[date].map(t => {
                  const accountDisplay = getAccountName(t);
                  return (
                    <div 
                      key={t.id} 
                      onClick={() => onEdit(t)}
                      className="bg-white p-4 rounded-xl shadow-sm border border-slate-50 flex items-center justify-between group cursor-pointer hover:border-brand-200 transition-all active:scale-[0.99]"
                    >
                      {/* Left Side: Icon + Text (Allows shrinking) */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          t.type === TransactionType.EXPENSE ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'
                        }`}>
                          {t.type === TransactionType.EXPENSE ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="font-semibold text-slate-800 truncate" title={t.merchant}>{t.merchant}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                            <span className="truncate">{t.category}</span>

                            {t.time && (
                              <span className="flex items-center gap-0.5 text-slate-400 whitespace-nowrap">
                                <Clock size={10} /> {t.time}
                              </span>
                            )}

                            {accountDisplay && (
                              <div className="flex items-center gap-1 bg-slate-50 px-1.5 rounded-md border border-slate-100 max-w-full">
                                <CreditCard size={10} className="text-slate-400 shrink-0" />
                                <span className="font-medium text-[10px] text-slate-600 truncate">{accountDisplay}</span>
                              </div>
                            )}

                            {t.groupId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingSplitGroup(t.groupId);
                                }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-brand-50 text-brand-600 rounded text-[10px] font-medium hover:bg-brand-100 transition-colors"
                              >
                                🔗 Split ({transactions.filter(tx => tx.groupId === t.groupId).length})
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Amount (Fixed width, no shrink) */}
                      <div className="flex items-center gap-3 pl-2 shrink-0">
                        <div className="text-right">
                           <div className={`font-bold whitespace-nowrap ${
                             t.type === TransactionType.EXPENSE ? 'text-slate-800' : 'text-green-600'
                           }`}>
                             {t.type === TransactionType.EXPENSE ? '-' : '+'}{t.amount.toFixed(2)}
                           </div>
                           <div className="text-[10px] text-slate-400 font-medium uppercase">{t.currency}</div>
                        </div>
                        <div className="text-slate-300">
                          <Pencil size={14} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Split Transactions Modal */}
      {viewingSplitGroup && (
        <SplitTransactionsModal
          transactions={transactions.filter(t => t.groupId === viewingSplitGroup)}
          baseCurrency={transactions.find(t => t.groupId === viewingSplitGroup)?.currency || 'USD'}
          onClose={() => setViewingSplitGroup(null)}
        />
      )}
    </div>
  );
};

export default TransactionList;