import React, { useEffect, useRef, useMemo } from 'react';
import { X } from 'lucide-react';
import { Category, Transaction } from '../types';

interface CategorySummaryModalProps {
  category: Category;
  transactions: Transaction[];
  baseCurrency: string;
  onClose: () => void;
}

const CategorySummaryModal: React.FC<CategorySummaryModalProps> = ({
  category,
  transactions,
  baseCurrency,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Focus management
  useEffect(() => {
    modalRef.current?.focus();

    // Close on Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    if (transactions.length === 0) {
      return {
        total: 0,
        count: 0,
        average: 0,
        dateRange: 'No transactions',
      };
    }

    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    const count = transactions.length;
    const average = total / count;

    // Get date range
    const sortedDates = transactions
      .map((t) => new Date(t.date).getTime())
      .sort((a, b) => a - b);
    const startDate = new Date(sortedDates[0]);
    const endDate = new Date(sortedDates[sortedDates.length - 1]);

    const dateRange =
      startDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }) +
      ' - ' +
      endDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

    return { total, count, average, dateRange };
  }, [transactions]);

  // Sort transactions newest first
  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)),
    [transactions]
  );

  // Get icon from category (assuming renderIcon function available)
  const categoryColor = category.color || '#06b6d4';

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={handleBackdropClick}
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="fixed inset-0 z-50 flex items-end"
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="w-full bg-white rounded-t-3xl shadow-2xl max-w-md mx-auto max-h-[80vh] overflow-hidden flex flex-col animate-slide-up"
          style={{ pointerEvents: 'auto' }}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3 flex-1">
              {/* Category Icon */}
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                style={{ backgroundColor: categoryColor }}
              >
                {/* Icon rendering - using first letter as fallback */}
                <span className="font-bold text-lg">
                  {category.name.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Category Info */}
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-slate-800 truncate">
                  {category.name}
                </h2>
                <p className="text-xs text-slate-500">{stats.dateRange}</p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="Close modal"
            >
              <X size={20} className="text-slate-600" />
            </button>
          </div>

          {/* Statistics Panel */}
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
            <div className="grid grid-cols-3 gap-3">
              {/* Total Spent */}
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500 font-medium mb-1">
                  Total Spent
                </p>
                <p className="text-lg font-bold text-slate-800">
                  {baseCurrency}{' '}
                  <span className="block text-sm">
                    {stats.total.toFixed(2)}
                  </span>
                </p>
              </div>

              {/* Transaction Count */}
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500 font-medium mb-1">Count</p>
                <p className="text-2xl font-bold text-slate-800">
                  {stats.count}
                </p>
              </div>

              {/* Average */}
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500 font-medium mb-1">
                  Average
                </p>
                <p className="text-lg font-bold text-slate-800">
                  {baseCurrency}{' '}
                  <span className="block text-sm">
                    {stats.average.toFixed(2)}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Transaction List */}
          <div className="flex-1 overflow-y-auto">
            {sortedTransactions.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-slate-500 text-sm">
                  No transactions in this category for the selected period.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sortedTransactions.map((transaction, index) => (
                  <div
                    key={`${transaction.id}-${index}`}
                    className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">
                        {transaction.description || transaction.type}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(transaction.date).toLocaleDateString(
                          'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          }
                        )}
                      </p>
                    </div>
                    <p
                      className={`font-bold text-right ml-4 flex-shrink-0 ${
                        transaction.type === 'EXPENSE'
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}
                    >
                      {transaction.type === 'EXPENSE' ? '−' : '+'}
                      {baseCurrency} {Math.abs(transaction.amount).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 p-4 bg-white">
            <button
              onClick={onClose}
              className="w-full py-2 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default React.memo(CategorySummaryModal);
