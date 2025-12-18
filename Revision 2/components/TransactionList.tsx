import React, { useMemo, useState } from 'react';
import { Transaction, TransactionType, Account } from '../types';
import { Search, TrendingDown, TrendingUp, Filter, Pencil, CreditCard, Clock, X, Split } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  accounts?: Account[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  initialFilterAccountId?: string | null;
  onClearAccountFilter?: () => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ 
  transactions, 
  accounts = [], 
  onDelete, 
  onEdit, 
  initialFilterAccountId,
  onClearAccountFilter
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        const matchesSearch = t.merchant.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              t.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'ALL' || t.type === filter;
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
    <div className="h-full flex flex-col pb-24">
      <div className="mb-6 sticky top-0 bg-slate-50/95 backdrop-blur z-10 py-2">
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
          <button 
            onClick={() => setFilter(prev => prev === 'ALL' ? 'EXPENSE' : prev === 'EXPENSE' ? 'INCOME' : 'ALL')}
            className={`px-3 py-2 rounded-xl border border-slate-200 bg-white flex items-center gap-2 text-sm font-medium transition-colors ${filter !== 'ALL' ? 'text-brand-600 border-brand-200 bg-brand-50' : 'text-slate-600'}`}
          >
            <Filter size={16} />
            {filter === 'ALL' ? 'All' : filter === 'EXPENSE' ? 'Expense' : 'Income'}
          </button>
        </div>
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
                  const isSplit = !!t.splitParent || (t.tags && t.tags.includes('Receipt Split'));
                  
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
                          {isSplit ? <Split size={18} /> : (t.type === TransactionType.EXPENSE ? <TrendingDown size={18} /> : <TrendingUp size={18} />)}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="font-semibold text-slate-800 truncate" title={t.merchant}>{t.merchant}</div>
                          
                          {/* Split Parent Line (Grayed Out) */}
                          {isSplit && t.splitParent && (
                            <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                               <span>Split from {t.splitParent.merchant}</span>
                               <span className="font-mono opacity-80">({t.currency}{t.splitParent.totalAmount.toFixed(2)})</span>
                            </div>
                          )}
                          {!isSplit && t.rawText && t.rawText.startsWith('Split from') && (
                             <div className="text-[10px] text-slate-400 truncate">{t.rawText}</div>
                          )}

                          <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">
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
    </div>
  );
};

export default TransactionList;