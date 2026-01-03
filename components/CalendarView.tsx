import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, ScheduledTransaction } from '../types';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Calendar as CalendarIcon, Receipt } from 'lucide-react';

interface CalendarViewProps {
  transactions: Transaction[];
  scheduledTransactions: ScheduledTransaction[];
  onSelectTransaction: (t: Transaction) => void;
  onSelectScheduledTransaction: (st: ScheduledTransaction) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  transactions,
  scheduledTransactions,
  onSelectTransaction,
  onSelectScheduledTransaction
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const startDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const currentMonthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Group transactions and scheduled transactions by day for current month
  const dayData = useMemo(() => {
    const data: Record<number, {
      income: number;
      expense: number;
      scheduled: number;
      count: number;
      txns: Transaction[];
      scheduledTxns: ScheduledTransaction[];
    }> = {};

    // Add completed transactions
    transactions.forEach(t => {
      const tDate = new Date(t.date);
      if (tDate.getMonth() === currentDate.getMonth() && tDate.getFullYear() === currentDate.getFullYear()) {
        const day = tDate.getDate();
        if (!data[day]) {
          data[day] = { income: 0, expense: 0, scheduled: 0, count: 0, txns: [], scheduledTxns: [] };
        }

        if (t.type === TransactionType.INCOME) {
          data[day].income += t.amount;
        } else {
          data[day].expense += t.amount;
        }
        data[day].count++;
        data[day].txns.push(t);
      }
    });

    // Add scheduled transactions (only PENDING ones)
    scheduledTransactions.forEach(st => {
      if (st.status !== 'PENDING') return; // Skip paid/skipped

      const stDate = new Date(st.dueDate);
      if (stDate.getMonth() === currentDate.getMonth() && stDate.getFullYear() === currentDate.getFullYear()) {
        const day = stDate.getDate();
        if (!data[day]) {
          data[day] = { income: 0, expense: 0, scheduled: 0, count: 0, txns: [], scheduledTxns: [] };
        }

        data[day].scheduled += st.amount;
        data[day].scheduledTxns.push(st);
      }
    });

    return data;
  }, [transactions, scheduledTransactions, currentDate]);

  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const renderCalendar = () => {
    const totalDays = daysInMonth(currentDate);
    const startDay = startDayOfMonth(currentDate);
    const days = [];

    // Empty cells for prev month
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-20 bg-slate-50/50 border border-slate-100/50"></div>);
    }

    // Days
    for (let d = 1; d <= totalDays; d++) {
      const info = dayData[d];
      const isSelected = selectedDay === d;
      
      days.push(
        <div 
          key={d} 
          onClick={() => setSelectedDay(d)}
          className={`h-20 border border-slate-100 p-1 relative cursor-pointer transition-colors ${isSelected ? 'bg-brand-50 border-brand-200 ring-1 ring-brand-300 z-10' : 'bg-white hover:bg-slate-50'}`}
        >
          <span className={`text-xs font-semibold block mb-1 ${isSelected ? 'text-brand-700' : 'text-slate-400'}`}>{d}</span>
          
          {info && (
            <div className="flex flex-col gap-0.5">
               {info.expense > 0 && (
                 <div className="text-[9px] font-bold text-red-500 bg-red-50 px-1 rounded truncate">
                   -{info.expense.toFixed(0)}
                 </div>
               )}
               {info.income > 0 && (
                 <div className="text-[9px] font-bold text-green-500 bg-green-50 px-1 rounded truncate">
                   +{info.income.toFixed(0)}
                 </div>
               )}
               {info.scheduled > 0 && (
                 <div className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1 rounded truncate">
                   📅 {info.scheduled.toFixed(0)}
                 </div>
               )}
            </div>
          )}
        </div>
      );
    }

    return days;
  };

  return (
    <div className="h-full flex flex-col pb-24">
       <div className="mb-4 bg-white sticky top-0 z-10 pb-2">
         <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft size={20} className="text-slate-600" /></button>
            <h2 className="text-lg font-bold text-slate-800">{currentMonthName}</h2>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight size={20} className="text-slate-600" /></button>
         </div>
         
         <div className="grid grid-cols-7 text-center mb-1">
           {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
             <div key={d} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d}</div>
           ))}
         </div>
       </div>

       <div className="grid grid-cols-7 bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200">
          {renderCalendar()}
       </div>

       {/* Selected Day Details */}
       {selectedDay && dayData[selectedDay] && (
         <div className="mt-4 animate-in slide-in-from-bottom-2">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
              {currentDate.toLocaleString('default', { month: 'short' })} {selectedDay}
            </h3>
            <div className="space-y-2">
              {/* Completed Transactions */}
              {dayData[selectedDay].txns.map(t => (
                <div key={t.id} onClick={() => onSelectTransaction(t)} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between shadow-sm cursor-pointer active:scale-[0.99] transition-transform">
                   <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        t.type === TransactionType.INCOME ? 'bg-green-50 text-green-500' :
                        t.type === TransactionType.OBLIGATION ? 'bg-orange-50 text-orange-500' :
                        'bg-red-50 text-red-500'
                      }`}>
                        {t.type === TransactionType.INCOME ? <TrendingUp size={14} /> :
                         t.type === TransactionType.OBLIGATION ? <Receipt size={14} /> :
                         <TrendingDown size={14} />}
                      </div>
                      <div className="overflow-hidden">
                        <div className="font-semibold text-slate-800 text-sm truncate w-40">{t.merchant}</div>
                        <div className="text-[10px] text-slate-400">{t.category}</div>
                      </div>
                   </div>
                   <div className={`font-bold text-sm ${
                     t.type === TransactionType.INCOME ? 'text-green-600' :
                     t.type === TransactionType.OBLIGATION ? 'text-orange-600' :
                     'text-slate-700'
                   }`}>
                     {t.type === TransactionType.INCOME ? '+' : '-'}{t.amount.toFixed(2)}
                   </div>
                </div>
              ))}

              {/* Scheduled Transactions */}
              {dayData[selectedDay].scheduledTxns.map(st => (
                <div key={st.id} onClick={() => onSelectScheduledTransaction(st)} className="bg-purple-50 p-3 rounded-xl border border-purple-200 flex items-center justify-between shadow-sm cursor-pointer active:scale-[0.99] transition-transform">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-purple-100 text-purple-600">
                        <CalendarIcon size={14} />
                      </div>
                      <div className="overflow-hidden">
                        <div className="font-semibold text-slate-800 text-sm truncate w-40">{st.merchant}</div>
                        <div className="text-[10px] text-purple-600 font-medium">
                          {st.isCheque ? `Cheque ${st.chequeNumber ? `#${st.chequeNumber}` : ''}` : 'Scheduled'} • {st.category}
                        </div>
                      </div>
                   </div>
                   <div className="font-bold text-sm text-purple-700">
                     -{st.amount.toFixed(2)}
                   </div>
                </div>
              ))}
            </div>
         </div>
       )}
    </div>
  );
};

export default CalendarView;