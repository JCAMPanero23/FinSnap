import React, { useState, useMemo } from 'react';
import { X, Edit2, CheckCircle, Plus, AlertTriangle, AlertCircle } from 'lucide-react';
import { ScheduledTransaction } from '../types';
import { validateChequeSeries, suggestNextChequeNumber, suggestNextDueDate } from '../services/chequeValidationService';

interface ChequeSeriesModalProps {
  cheques: ScheduledTransaction[];
  onClose: () => void;
  onEditCheque: (cheque: ScheduledTransaction) => void;
  onAddCheque: (data: { dueDate: string; amount: number; chequeNumber?: string }) => Promise<void>;
}

const ChequeSeriesModal: React.FC<ChequeSeriesModalProps> = ({
  cheques,
  onClose,
  onEditCheque,
  onAddCheque,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newChequeDate, setNewChequeDate] = useState('');
  const [newChequeAmount, setNewChequeAmount] = useState('');
  const [newChequeNumber, setNewChequeNumber] = useState('');
  const [addingCheque, setAddingCheque] = useState(false);

  // Validate cheques
  const validation = useMemo(() => validateChequeSeries(cheques), [cheques]);
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

  const handleAddCheque = async () => {
    if (!newChequeDate || !newChequeAmount) {
      alert('Please fill in date and amount');
      return;
    }

    setAddingCheque(true);
    try {
      await onAddCheque({
        dueDate: newChequeDate,
        amount: parseFloat(newChequeAmount),
        chequeNumber: newChequeNumber || undefined,
      });

      // Reset form
      setNewChequeDate('');
      setNewChequeAmount('');
      setNewChequeNumber('');
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding cheque:', error);
      alert('Failed to add cheque');
    } finally {
      setAddingCheque(false);
    }
  };

  const handleShowAddForm = () => {
    // Pre-fill with suggested values
    const suggestedDate = suggestNextDueDate(cheques);
    const suggestedNumber = suggestNextChequeNumber(cheques);
    const defaultAmount = cheques.length > 0 ? cheques[cheques.length - 1].amount : 0;

    setNewChequeDate(suggestedDate || '');
    setNewChequeNumber(suggestedNumber || '');
    setNewChequeAmount(defaultAmount.toString());
    setShowAddForm(true);
  };

  // Helper to get responsive text size based on number length
  const getAmountTextSize = (amount: number): string => {
    const formatted = amount.toFixed(2);
    if (formatted.length > 10) return 'text-lg'; // Very large numbers
    if (formatted.length > 8) return 'text-xl';  // Large numbers
    return 'text-2xl'; // Normal numbers
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{cheques[0]?.merchant}</h2>
              <p className="text-sm text-gray-600 mt-1">Cheque Series ({cheques.length} cheques)</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          {/* Validation Warnings */}
          {validation.issues.length > 0 && (
            <div className="mt-4 space-y-2">
              {validation.issues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                    issue.type === 'ERROR'
                      ? 'bg-red-50 border border-red-200 text-red-800'
                      : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                  }`}
                >
                  {issue.type === 'ERROR' ? (
                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-semibold">{issue.type === 'ERROR' ? 'Error' : 'Warning'}:</span>{' '}
                    {issue.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="p-6 bg-purple-50 border-b">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-3 border border-purple-200">
              <div className="text-xs text-gray-600 uppercase font-semibold mb-1">Total Amount</div>
              <div className={`${getAmountTextSize(totalAmount)} font-bold text-gray-900 break-words`}>
                <div className="flex flex-col">
                  <span className="leading-tight">{totalAmount.toFixed(2)}</span>
                  <span className="text-xs text-gray-500 font-normal">{cheques[0]?.currency}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 border border-green-200">
              <div className="text-xs text-gray-600 uppercase font-semibold mb-1">Cashed</div>
              <div className={`${getAmountTextSize(cashedAmount)} font-bold text-green-700 break-words`}>
                <div className="flex flex-col">
                  <span className="leading-tight">{cashedAmount.toFixed(2)}</span>
                  <span className="text-xs text-gray-500 font-normal">{cheques[0]?.currency}</span>
                </div>
              </div>
              <div className="text-xs text-gray-600 mt-1">{cashedCount}/{cheques.length} cheques</div>
            </div>

            <div className="bg-white rounded-lg p-3 border border-orange-200">
              <div className="text-xs text-gray-600 uppercase font-semibold mb-1">Remaining</div>
              <div className={`${getAmountTextSize(totalAmount - cashedAmount)} font-bold text-orange-700 break-words`}>
                <div className="flex flex-col">
                  <span className="leading-tight">{(totalAmount - cashedAmount).toFixed(2)}</span>
                  <span className="text-xs text-gray-500 font-normal">{cheques[0]?.currency}</span>
                </div>
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
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Individual Cheques</h3>
            <button
              onClick={handleShowAddForm}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors"
            >
              <Plus size={16} />
              Add Cheque
            </button>
          </div>

          {/* Add Cheque Form */}
          {showAddForm && (
            <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4 mb-3">
              <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                <Plus size={18} />
                Add New Cheque to Series
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
                  <input
                    type="date"
                    value={newChequeDate}
                    onChange={e => setNewChequeDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newChequeAmount}
                    onChange={e => setNewChequeAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Number (optional)</label>
                  <input
                    type="text"
                    value={newChequeNumber}
                    onChange={e => setNewChequeNumber(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="e.g., 10007"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                    disabled={addingCheque}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCheque}
                    className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 disabled:opacity-50"
                    disabled={addingCheque}
                  >
                    {addingCheque ? 'Adding...' : 'Add Cheque'}
                  </button>
                </div>
              </div>
            </div>
          )}
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-gray-900">
                        {new Date(cheque.dueDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                      {getStatusBadge(cheque.status)}
                    </div>
                    <div className={`${getAmountTextSize(cheque.amount)} font-bold text-gray-900 break-words`}>
                      {cheque.amount.toFixed(2)} <span className="text-sm text-gray-500">{cheque.currency}</span>
                    </div>
                    {cheque.notes && (
                      <div className="text-xs text-gray-500 mt-1 truncate">{cheque.notes}</div>
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
