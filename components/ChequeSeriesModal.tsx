import React from 'react';
import { X, Edit2, CheckCircle } from 'lucide-react';
import { ScheduledTransaction } from '../types';

interface ChequeSeriesModalProps {
  cheques: ScheduledTransaction[];
  onClose: () => void;
  onEditCheque: (cheque: ScheduledTransaction) => void;
}

const ChequeSeriesModal: React.FC<ChequeSeriesModalProps> = ({
  cheques,
  onClose,
  onEditCheque,
}) => {
  // Calculate totals
  const totalAmount = cheques.reduce((sum, ch) => sum + ch.amount, 0);
  const cashedAmount = cheques
    .filter(ch => ch.status === 'PAID')
    .reduce((sum, ch) => sum + ch.amount, 0);
  const cashedCount = cheques.filter(ch => ch.status === 'PAID').length;

  // Sort by due date
  const sortedCheques = [...cheques].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">✓ Paid</span>;
      case 'OVERDUE':
        return <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-semibold">! Overdue</span>;
      case 'SKIPPED':
        return <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full font-semibold">Skipped</span>;
      default:
        return <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-semibold">Pending</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{cheques[0]?.merchant}</h2>
            <p className="text-sm text-gray-600 mt-1">Cheque Series ({cheques.length} cheques)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="p-6 bg-purple-50 border-b">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border border-purple-200">
              <div className="text-xs text-gray-600 uppercase font-semibold mb-1">Total Amount</div>
              <div className="text-2xl font-bold text-gray-900">
                {totalAmount.toFixed(2)} <span className="text-sm text-gray-500">{cheques[0]?.currency}</span>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-green-200">
              <div className="text-xs text-gray-600 uppercase font-semibold mb-1">Cashed</div>
              <div className="text-2xl font-bold text-green-700">
                {cashedAmount.toFixed(2)} <span className="text-sm text-gray-500">{cheques[0]?.currency}</span>
              </div>
              <div className="text-xs text-gray-600 mt-1">{cashedCount}/{cheques.length} cheques</div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-orange-200">
              <div className="text-xs text-gray-600 uppercase font-semibold mb-1">Remaining</div>
              <div className="text-2xl font-bold text-orange-700">
                {(totalAmount - cashedAmount).toFixed(2)} <span className="text-sm text-gray-500">{cheques[0]?.currency}</span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Progress</span>
              <span>{((cashedCount / cheques.length) * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-purple-200 rounded-full h-3">
              <div
                className="bg-purple-600 h-3 rounded-full transition-all"
                style={{ width: `${Math.min(100, (cashedCount / cheques.length) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Cheques List */}
        <div className="p-6 space-y-3">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Individual Cheques</h3>
          {sortedCheques.map((cheque, index) => (
            <div
              key={cheque.id}
              className={`border rounded-lg p-4 transition-all ${
                cheque.status === 'PAID'
                  ? 'bg-green-50 border-green-200'
                  : cheque.status === 'OVERDUE'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-white border-gray-200 hover:shadow-md cursor-pointer'
              }`}
              onClick={() => cheque.status !== 'PAID' && onEditCheque(cheque)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  {/* Cheque Number Badge */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    #{cheque.chequeNumber || index + 1}
                  </div>

                  {/* Cheque Details */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">
                        {new Date(cheque.dueDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                      {getStatusBadge(cheque.status)}
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {cheque.amount.toFixed(2)} <span className="text-sm text-gray-500">{cheque.currency}</span>
                    </div>
                    {cheque.notes && (
                      <div className="text-xs text-gray-500 mt-1">{cheque.notes}</div>
                    )}
                  </div>
                </div>

                {/* Edit Button */}
                {cheque.status !== 'PAID' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditCheque(cheque);
                    }}
                    className="flex-shrink-0 p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                  >
                    <Edit2 size={20} />
                  </button>
                )}

                {cheque.status === 'PAID' && (
                  <div className="flex-shrink-0 text-green-600">
                    <CheckCircle size={24} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChequeSeriesModal;
