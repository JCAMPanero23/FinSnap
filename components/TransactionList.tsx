import React, { useMemo, useState } from 'react';
import { Transaction, TransactionType, Account } from '../types';
import { Search, TrendingDown, TrendingUp, Filter, Pencil, CreditCard, Clock, X } from 'lucide-react';

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
      <div className="mb-6 sticky top-0 bg-white/95 backdrop-blur z-10 py-2 border-b-3 border-black">
        <div className="flex justify-between items-end mb-4">
           <div className="flex items-center gap-3">
             <div className="w-1 h-10 bg-electric-cyan"></div>
             <h2 className="text-2xl font-display font-bold text-black uppercase tracking-tight">History</h2>
           </div>
           {activeAccount && (
             <button
               onClick={onClearAccountFilter}
               className="flex items-center gap-2 text-xs bg-hot-pink text-white border-2 border-black px-3 py-1.5 hover:shadow-brutal-sm hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-150 font-display font-bold uppercase"
             >
               {activeAccount.name} <X size={14} strokeWidth={3} />
             </button>
           )}
        </div>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black" size={18} strokeWidth={2.5} />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border-3 border-black text-sm font-body focus:outline-none focus:shadow-[0_0_0_3px_#BFFF00]"
            />
          </div>
          <button
            onClick={() => setFilter(prev => prev === 'ALL' ? 'EXPENSE' : prev === 'EXPENSE' ? 'INCOME' : 'ALL')}
            className={`px-4 py-3 border-3 border-black flex items-center gap-2 text-xs font-display font-bold transition-all duration-150 uppercase tracking-wide ${
              filter !== 'ALL'
                ? 'bg-lime text-black shadow-brutal-sm'
                : 'bg-white text-black hover:bg-near-white hover:shadow-brutal-sm hover:translate-x-[-2px] hover:translate-y-[-2px]'
            }`}
          >
            <Filter size={16} strokeWidth={2.5} />
            {filter === 'ALL' ? 'All' : filter === 'EXPENSE' ? 'Out' : 'In'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {Object.keys(groupedTransactions).length === 0 ? (
          <div className="text-center py-16 bg-white border-3 border-black border-dashed">
            <div className="font-display font-bold text-black uppercase text-base">No Transactions</div>
            <div className="font-body text-sm text-mid-gray mt-2">Add one to get started</div>
          </div>
        ) : (
          Object.keys(groupedTransactions).sort((a,b) => new Date(b).getTime() - new Date(a).getTime()).map((date, dateIdx) => (
            <div key={date} className="animate-slide-up" style={{ animationDelay: `${dateIdx * 50}ms` }}>
              <div className="flex items-center gap-3 mb-3 px-1">
                <div className="h-[2px] flex-1 bg-black"></div>
                <h3 className="text-[10px] font-mono font-bold text-black uppercase tracking-widest px-2 py-1 border-2 border-black bg-white">{date}</h3>
                <div className="h-[2px] flex-1 bg-black"></div>
              </div>
              <div className="space-y-2">
                {groupedTransactions[date].map((t, idx) => {
                  const accountDisplay = getAccountName(t);
                  return (
                    <div
                      key={t.id}
                      onClick={() => onEdit(t)}
                      className="bg-white p-4 border-3 border-black shadow-brutal-sm flex items-center justify-between group cursor-pointer hover:shadow-brutal-md hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-150 active:shadow-brutal-sm active:translate-x-[1px] active:translate-y-[1px] animate-slide-up"
                      style={{ animationDelay: `${(dateIdx * 50) + (idx * 30)}ms` }}
                    >
                      {/* Left Side: Icon + Text */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-11 h-11 border-2 border-black flex items-center justify-center shrink-0 ${
                          t.type === TransactionType.EXPENSE ? 'bg-hot-pink' : 'bg-lime'
                        }`}>
                          {t.type === TransactionType.EXPENSE ? <TrendingDown size={20} className="text-white" strokeWidth={3} /> : <TrendingUp size={20} className="text-black" strokeWidth={3} />}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="font-display font-bold text-sm text-black truncate" title={t.merchant}>{t.merchant}</div>
                          <div className="text-[10px] font-mono text-mid-gray flex items-center gap-2 flex-wrap uppercase">
                            <span className="truncate">{t.category}</span>

                            {t.time && (
                              <span className="flex items-center gap-1 whitespace-nowrap">
                                <Clock size={10} strokeWidth={2.5} /> {t.time}
                              </span>
                            )}

                            {accountDisplay && (
                              <div className="flex items-center gap-1 bg-near-white px-1.5 py-0.5 border border-black max-w-full">
                                <CreditCard size={10} className="shrink-0" strokeWidth={2.5} />
                                <span className="font-bold text-[9px] text-black truncate">{accountDisplay}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Amount */}
                      <div className="flex items-center gap-3 pl-2 shrink-0">
                        <div className="text-right">
                           <div className={`font-mono font-bold text-lg whitespace-nowrap number-display ${
                             t.type === TransactionType.EXPENSE ? 'text-black' : 'text-black'
                           }`}>
                             {t.type === TransactionType.EXPENSE ? '-' : '+'}{t.amount.toFixed(2)}
                           </div>
                           <div className="text-[9px] text-mid-gray font-mono font-bold uppercase tracking-wider">{t.currency}</div>
                        </div>
                        <div className="text-black opacity-40 group-hover:opacity-100 transition-opacity">
                          <Pencil size={16} strokeWidth={2.5} />
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