import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ScheduledTransaction, TransactionType, Account, Category, RecurrencePattern } from '../types';

interface ScheduledTransactionFormProps {
  onClose: () => void;
  onSave: (data: Partial<ScheduledTransaction>) => Promise<void>;
  accounts: Account[];
  categories: Category[];
  initialData?: ScheduledTransaction;
}

const ScheduledTransactionForm: React.FC<ScheduledTransactionFormProps> = ({
  onClose,
  onSave,
  accounts,
  categories,
  initialData,
}) => {
  const [merchant, setMerchant] = useState(initialData?.merchant || '');
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
  const [category, setCategory] = useState(initialData?.category || categories[0]?.name || '');
  const [type, setType] = useState<TransactionType>(initialData?.type || TransactionType.EXPENSE);
  const [accountId, setAccountId] = useState(initialData?.accountId || accounts[0]?.id || '');
  const [dueDate, setDueDate] = useState(initialData?.dueDate || '');
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>(
    initialData?.recurrencePattern || 'ONCE'
  );
  const [recurrenceInterval, setRecurrenceInterval] = useState(initialData?.recurrenceInterval || 1);
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant || !amount || !dueDate || !accountId) return;

    setSaving(true);
    try {
      await onSave({
        merchant,
        amount: parseFloat(amount),
        currency: accounts.find(a => a.id === accountId)?.currency || 'USD',
        category,
        type,
        accountId,
        dueDate,
        recurrencePattern,
        recurrenceInterval: recurrencePattern !== 'ONCE' ? recurrenceInterval : undefined,
        status: 'PENDING',
        notes,
      });
      onClose();
    } catch (error) {
      console.error('Error saving scheduled transaction:', error);
      alert('Failed to save scheduled transaction');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">
            {initialData ? 'Edit' : 'Create'} Scheduled Transaction
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Merchant/Description *
            </label>
            <input
              type="text"
              value={merchant}
              onChange={e => setMerchant(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="e.g., Electricity Bill"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as TransactionType)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value={TransactionType.EXPENSE}>Expense</option>
              <option value={TransactionType.INCOME}>Income</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account *</label>
            <select
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recurrence</label>
            <select
              value={recurrencePattern}
              onChange={e => setRecurrencePattern(e.target.value as RecurrencePattern)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="ONCE">One-time</option>
              <option value="MONTHLY">Monthly</option>
              <option value="WEEKLY">Weekly</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>

          {recurrencePattern !== 'ONCE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Interval (Every N {recurrencePattern === 'MONTHLY' ? 'months' : recurrencePattern === 'WEEKLY' ? 'weeks' : 'days'})
              </label>
              <input
                type="number"
                min="1"
                value={recurrenceInterval}
                onChange={e => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              rows={3}
              placeholder="Optional notes"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Saving...' : initialData ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduledTransactionForm;
