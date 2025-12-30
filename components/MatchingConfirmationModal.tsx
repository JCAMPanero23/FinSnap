import React from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { Transaction, ScheduledTransaction } from '../types';

interface MatchingConfirmationModalProps {
  transaction: Transaction;
  scheduledTransaction: ScheduledTransaction;
  score: number;
  reasons: string[];
  onConfirm: () => void;
  onReject: () => void;
}

const MatchingConfirmationModal: React.FC<MatchingConfirmationModalProps> = ({
  transaction,
  scheduledTransaction,
  score,
  reasons,
  onConfirm,
  onReject,
}) => {
  // Calculate delay
  const txDate = new Date(transaction.date);
  const dueDate = new Date(scheduledTransaction.dueDate);
  const daysDiff = Math.floor((txDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

  let delayText = '';
  if (daysDiff === 0) {
    delayText = 'On time';
  } else if (daysDiff > 0) {
    delayText = `${daysDiff} day${daysDiff > 1 ? 's' : ''} late`;
  } else {
    delayText = `${Math.abs(daysDiff)} day${Math.abs(daysDiff) > 1 ? 's' : ''} early`;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-4 flex items-center gap-3 rounded-t-lg">
          <AlertCircle size={24} className="text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Possible Match Found</h2>
        </div>

        <div className="p-6 space-y-4">
          {/* Match Score */}
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-sm text-gray-600 mb-1">Match Confidence</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${Math.min((score / 300) * 100, 100)}%` }}
                />
              </div>
              <div className="text-sm font-semibold text-blue-700">
                {Math.min(Math.floor((score / 300) * 100), 100)}%
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {reasons.join(' • ')}
            </div>
          </div>

          {/* Scheduled Transaction */}
          <div>
            <div className="text-sm font-medium text-gray-600 mb-2">Scheduled:</div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="font-semibold text-gray-900">{scheduledTransaction.merchant}</div>
              <div className="text-lg font-bold text-gray-900 mt-1">
                {scheduledTransaction.amount} {scheduledTransaction.currency}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Due: {dueDate.toLocaleDateString()}
              </div>
              {scheduledTransaction.isCheque && scheduledTransaction.chequeNumber && (
                <div className="text-sm text-purple-600 mt-1">
                  Cheque #{scheduledTransaction.chequeNumber}
                </div>
              )}
            </div>
          </div>

          {/* Actual Transaction */}
          <div>
            <div className="text-sm font-medium text-gray-600 mb-2">Actual Transaction:</div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="font-semibold text-gray-900">{transaction.merchant}</div>
              <div className="text-lg font-bold text-gray-900 mt-1">
                {transaction.amount} {transaction.currency}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Paid: {txDate.toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Delay Information */}
          <div className={`p-3 rounded-lg ${daysDiff === 0 ? 'bg-green-50' : daysDiff > 0 ? 'bg-orange-50' : 'bg-blue-50'}`}>
            <div className="text-sm font-medium text-gray-700">
              {daysDiff === 0 ? '✓' : daysDiff > 0 ? '⚠️' : '📅'} {delayText}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onReject}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <X size={18} />
              Different Transaction
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 flex items-center justify-center gap-2"
            >
              <Check size={18} />
              Yes, Match This
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchingConfirmationModal;
