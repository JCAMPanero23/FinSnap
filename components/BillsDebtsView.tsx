import React, { useState, useEffect, useCallback } from 'react';
import { ScheduledTransaction, Account } from '../types';
import { PlusCircle, Calendar } from 'lucide-react';
import { getAllScheduledTransactions } from '../services/indexedDBService';
import { updateOverdueStatus, getByStatus, getUpcoming } from '../services/scheduledTransactionsService';

interface BillsDebtsViewProps {
  accounts: Account[];
  onCreateScheduled: () => void;
  onCreateBatchCheques: () => void;
  onMarkPaid: (scheduledTx: ScheduledTransaction) => void;
  onSkip: (scheduledTx: ScheduledTransaction) => void;
  onViewScheduled: (scheduledTx: ScheduledTransaction) => void;
}

const BillsDebtsView: React.FC<BillsDebtsViewProps> = ({
  accounts,
  onCreateScheduled,
  onCreateBatchCheques,
  onMarkPaid,
  onSkip,
  onViewScheduled,
}) => {
  const [scheduledTransactions, setScheduledTransactions] = useState<ScheduledTransaction[]>([]);
  const [overdueItems, setOverdueItems] = useState<ScheduledTransaction[]>([]);
  const [upcomingItems, setUpcomingItems] = useState<ScheduledTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadScheduledTransactions = useCallback(async () => {
    setLoading(true);
    try {
      // Update overdue status first
      await updateOverdueStatus();

      // Load all scheduled transactions
      const all = await getAllScheduledTransactions();
      setScheduledTransactions(all);

      // Get overdue
      const overdue = await getByStatus('OVERDUE');
      setOverdueItems(overdue);

      // Get upcoming (next 30 days)
      const upcoming = await getUpcoming(30);
      setUpcomingItems(upcoming);
    } catch (error) {
      console.error('Error loading scheduled transactions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScheduledTransactions();
  }, [loadScheduledTransactions]);

  // Group cheques by series
  const chequeSeries = scheduledTransactions
    .filter(st => st.isCheque && st.seriesId)
    .reduce((acc, st) => {
      const key = st.seriesId!;
      if (!acc[key]) acc[key] = [];
      acc[key].push(st);
      return acc;
    }, {} as Record<string, ScheduledTransaction[]>);

  // Get loan accounts
  const loanAccounts = accounts.filter(a => a.type === 'Loan/BNPL');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header Actions */}
      <div className="flex gap-2">
        <button
          onClick={onCreateScheduled}
          className="flex-1 bg-brand-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-600 transition-colors flex items-center justify-center gap-2"
        >
          <PlusCircle size={20} />
          New Scheduled
        </button>
        <button
          onClick={onCreateBatchCheques}
          className="flex-1 bg-purple-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
        >
          <Calendar size={20} />
          Batch Cheques
        </button>
      </div>

      {/* Overdue Section */}
      {overdueItems.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-red-600 mb-3">🚨 Overdue ({overdueItems.length})</h2>
          <div className="space-y-2">
            {overdueItems.map(item => (
              <div
                key={item.id}
                className="bg-red-50 border border-red-200 rounded-lg p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-gray-900">{item.merchant}</div>
                    <div className="text-sm text-red-600">
                      Due: {new Date(item.dueDate).toLocaleDateString()}
                    </div>
                    <div className="text-lg font-bold text-gray-900 mt-1">
                      {item.amount} {item.currency}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onMarkPaid(item)}
                      className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                    >
                      Mark Paid
                    </button>
                    <button
                      onClick={() => onSkip(item)}
                      className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Section */}
      {upcomingItems.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">📅 Upcoming (Next 30 Days)</h2>
          <div className="space-y-2">
            {upcomingItems.slice(0, 10).map(item => (
              <div
                key={item.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onViewScheduled(item)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-gray-900">{item.merchant}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(item.dueDate).toLocaleDateString()}
                      {item.isCheque && item.chequeNumber && (
                        <span className="ml-2 text-purple-600">Cheque #{item.chequeNumber}</span>
                      )}
                    </div>
                    <div className="text-lg font-bold text-gray-900 mt-1">
                      {item.amount} {item.currency}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cheque Series Section */}
      {Object.keys(chequeSeries).length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">📋 Cheque Series</h2>
          <div className="space-y-2">
            {Object.entries(chequeSeries).map(([seriesId, cheques]: [string, ScheduledTransaction[]]) => {
              const paid = cheques.filter(c => c.status === 'PAID').length;
              const total = cheques.length;
              const nextCheque = cheques
                .filter(c => c.status === 'PENDING')
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

              return (
                <div key={seriesId} className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="font-semibold text-gray-900">{cheques[0].merchant}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {paid}/{total} cashed
                  </div>
                  {nextCheque && (
                    <div className="text-sm text-purple-700 mt-1">
                      Next: {new Date(nextCheque.dueDate).toLocaleDateString()} - #{nextCheque.chequeNumber}
                    </div>
                  )}
                  <div className="w-full bg-purple-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (paid / total) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loan Accounts Section */}
      {loanAccounts.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">💰 Loan Accounts</h2>
          <div className="space-y-2">
            {loanAccounts.map(account => {
              const principal = account.loanPrincipal || 0;
              const paid = principal + account.balance; // balance is negative
              const remaining = -account.balance;
              const progress = principal > 0 ? Math.min(100, Math.max(0, (paid / principal) * 100)) : 0;

              // Find next payment
              const nextPayment = upcomingItems.find(
                st => st.accountId === account.id
              );

              return (
                <div key={account.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="font-semibold text-gray-900">{account.name}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Borrowed: {principal} {account.currency}
                  </div>
                  <div className="text-sm text-gray-600">
                    Paid: {paid.toFixed(2)} {account.currency} ({account.loanInstallments ? `${Math.floor((paid / principal) * account.loanInstallments)}/${account.loanInstallments}` : `${progress.toFixed(0)}%`} installments)
                  </div>
                  <div className="text-sm font-semibold text-blue-700">
                    Remaining: {remaining.toFixed(2)} {account.currency}
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {nextPayment && (
                    <div className="text-sm text-blue-700 mt-2">
                      Next: {new Date(nextPayment.dueDate).toLocaleDateString()} - {nextPayment.amount} {nextPayment.currency}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {overdueItems.length === 0 && upcomingItems.length === 0 && loanAccounts.length === 0 && Object.keys(chequeSeries).length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Calendar size={48} className="mx-auto mb-4 opacity-50" />
          <p>No scheduled bills or loans yet</p>
          <p className="text-sm mt-2">Create your first scheduled transaction or loan account</p>
        </div>
      )}
    </div>
  );
};

export default BillsDebtsView;
