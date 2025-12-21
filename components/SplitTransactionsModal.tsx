import React from 'react';
import { X } from 'lucide-react';
import { Transaction } from '../types';

interface SplitTransactionsModalProps {
  transactions: Transaction[];
  baseCurrency: string;
  onClose: () => void;
}

const SplitTransactionsModal: React.FC<SplitTransactionsModalProps> = ({
  transactions,
  baseCurrency,
  onClose,
}) => {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col pointer-events-auto">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Split Transactions</h2>
              <p className="text-sm text-slate-500">{transactions.length} linked transactions</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {transactions.map((t, index) => (
              <div key={t.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400">
                    {index + 1}/{transactions.length}
                  </span>
                  <span className="font-bold text-slate-800">
                    {baseCurrency} {t.amount.toFixed(2)}
                  </span>
                </div>
                <div className="font-medium text-slate-800">{t.merchant}</div>
                <div className="text-sm text-slate-500 mt-1">
                  {t.category} • {t.date}
                </div>
              </div>
            ))}
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between font-bold">
              <span className="text-slate-700">Total:</span>
              <span className="text-slate-800">{baseCurrency} {total.toFixed(2)}</span>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200">
            <button
              onClick={onClose}
              className="w-full py-2 px-4 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SplitTransactionsModal;
