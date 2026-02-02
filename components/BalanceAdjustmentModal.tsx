import React, { useState, useEffect } from 'react';
import { Account } from '../types';
import { X, AlertTriangle, DollarSign } from 'lucide-react';

interface BalanceAdjustmentModalProps {
  account: Account;
  onAdjust: (accountId: string, newBalance: number) => void;
  onCancel: () => void;
}

const BalanceAdjustmentModal: React.FC<BalanceAdjustmentModalProps> = ({
  account,
  onAdjust,
  onCancel
}) => {
  const [newBalance, setNewBalance] = useState<string>(account.balance.toFixed(2));
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Reset balance when account changes
    setNewBalance(account.balance.toFixed(2));
    setError('');
  }, [account]);

  const handleBalanceChange = (value: string) => {
    setNewBalance(value);
    setError('');
  };

  const calculateDifference = (): number => {
    const newBal = parseFloat(newBalance);
    if (isNaN(newBal)) return 0;
    return newBal - account.balance;
  };

  const getDifferenceType = (): 'income' | 'expense' | 'none' => {
    const diff = calculateDifference();
    if (Math.abs(diff) < 0.01) return 'none';
    return diff > 0 ? 'income' : 'expense';
  };

  const handleSubmit = () => {
    const newBal = parseFloat(newBalance);

    // Validation
    if (isNaN(newBal)) {
      setError('Please enter a valid number');
      return;
    }

    const diff = Math.abs(calculateDifference());
    if (diff < 0.01) {
      setError('Balance is unchanged. No adjustment needed.');
      return;
    }

    onAdjust(account.id, newBal);
  };

  const difference = calculateDifference();
  const diffType = getDifferenceType();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Adjust Balance</h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Account Info */}
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-sm text-slate-600 mb-1">Account</p>
            <p className="font-semibold text-slate-900">{account.name}</p>
            <p className="text-xs text-slate-500 mt-1">
              {account.last4Digits} • {account.currency}
            </p>
          </div>

          {/* Current Balance */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Current Balance
            </label>
            <div className="bg-slate-100 rounded-xl px-4 py-3 flex items-center">
              <span className="text-slate-600 mr-2">{account.currency}</span>
              <span className="text-lg font-semibold text-slate-900">
                {account.balance.toFixed(2)}
              </span>
            </div>
          </div>

          {/* New Balance Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              New Balance *
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={newBalance}
                onChange={(e) => handleBalanceChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pl-12 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="0.00"
                autoFocus
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                {account.currency}
              </span>
            </div>
            {error && (
              <p className="text-sm text-red-600 mt-2 flex items-center">
                <AlertTriangle size={14} className="mr-1" />
                {error}
              </p>
            )}
          </div>

          {/* Difference Display */}
          {diffType !== 'none' && (
            <div className={`rounded-xl p-4 border-2 ${
              diffType === 'income'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <p className="text-sm font-medium text-slate-700 mb-2">
                Difference
              </p>
              <div className="flex items-center">
                <DollarSign size={20} className={diffType === 'income' ? 'text-green-600' : 'text-red-600'} />
                <span className={`text-xl font-bold ml-2 ${
                  diffType === 'income' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {diffType === 'income' ? '+' : '-'}{account.currency} {Math.abs(difference).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Type: <span className="font-semibold">
                  {diffType === 'income' ? 'INCOME' : 'EXPENSE'}
                </span>
              </p>
            </div>
          )}

          {/* Warning Message */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start">
            <AlertTriangle size={18} className="text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Unknown Transaction Will Be Created</p>
              <p className="text-xs text-amber-700">
                An "Unknown" transaction will be automatically created for the difference to keep your records balanced.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 px-6 py-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={diffType === 'none'}
            className="flex-1 px-4 py-3 bg-brand-500 text-white rounded-xl hover:bg-brand-600 transition-colors font-medium disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            Adjust Balance
          </button>
        </div>
      </div>
    </div>
  );
};

export default BalanceAdjustmentModal;
