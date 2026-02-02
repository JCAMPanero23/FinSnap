import React, { useState, useEffect } from 'react';
import { Transaction, RecurrencePattern } from '../types';
import { X, Calendar, Repeat, AlertCircle, CheckCircle } from 'lucide-react';
import {
  RecurringBillFormData,
  getDefaultRecurringData,
  validateRecurringBillData,
  canConvertToRecurring,
  previewDueDates
} from '../services/transactionToScheduledService';

interface RecurringBillFormModalProps {
  transaction: Transaction;
  onSave: (data: RecurringBillFormData) => void;
  onCancel: () => void;
}

const RECURRENCE_PATTERNS: { value: RecurrencePattern; label: string }[] = [
  { value: 'ONCE', label: 'One-time' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'CUSTOM', label: 'Custom (days)' }
];

const RecurringBillFormModal: React.FC<RecurringBillFormModalProps> = ({
  transaction,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState<RecurringBillFormData>(
    getDefaultRecurringData(transaction)
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // Check if transaction can be converted
  const { canConvert, reason } = canConvertToRecurring(transaction);

  useEffect(() => {
    // Re-validate whenever form data changes
    if (errors.length > 0) {
      const validation = validateRecurringBillData(formData);
      setErrors(validation.errors);
    }
  }, [formData]);

  const handleSubmit = () => {
    const validation = validateRecurringBillData(formData);

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    onSave(formData);
  };

  const previewDates = formData.recurrencePattern !== 'ONCE'
    ? previewDueDates(formData.firstDueDate, formData.recurrencePattern, formData.recurrenceInterval, 5)
    : [formData.firstDueDate];

  const getIntervalLabel = () => {
    if (formData.recurrencePattern === 'MONTHLY') return 'months';
    if (formData.recurrencePattern === 'WEEKLY') return 'weeks';
    if (formData.recurrencePattern === 'CUSTOM') return 'days';
    return '';
  };

  if (!canConvert) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Cannot Create Recurring Bill</h2>
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start">
            <AlertCircle size={18} className="text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{reason}</p>
          </div>
          <button
            onClick={onCancel}
            className="w-full mt-4 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Create Recurring Bill</h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Transaction Preview */}
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-brand-700 uppercase mb-2">From Transaction</p>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-slate-900">{transaction.merchant}</p>
                <p className="text-sm text-slate-600">{transaction.category}</p>
                <p className="text-xs text-slate-500 mt-1">{transaction.date}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-900">
                  {transaction.currency} {transaction.amount.toFixed(2)}
                </p>
                <p className="text-xs text-slate-500">{transaction.type}</p>
              </div>
            </div>
          </div>

          {/* Recurrence Pattern */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Recurrence Pattern *
            </label>
            <select
              value={formData.recurrencePattern}
              onChange={(e) => setFormData({ ...formData, recurrencePattern: e.target.value as RecurrencePattern })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              {RECURRENCE_PATTERNS.map(pattern => (
                <option key={pattern.value} value={pattern.value}>
                  {pattern.label}
                </option>
              ))}
            </select>
          </div>

          {/* Recurrence Interval (hidden for ONCE) */}
          {formData.recurrencePattern !== 'ONCE' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Repeat Every * <span className="text-slate-500 text-xs">({getIntervalLabel()})</span>
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={formData.recurrenceInterval}
                onChange={(e) => setFormData({ ...formData, recurrenceInterval: parseInt(e.target.value) || 1 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          )}

          {/* First Due Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {formData.recurrencePattern === 'ONCE' ? 'Due Date *' : 'First Due Date *'}
            </label>
            <input
              type="date"
              value={formData.firstDueDate}
              onChange={(e) => setFormData({ ...formData, firstDueDate: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {/* End Date (hidden for ONCE) */}
          {formData.recurrencePattern !== 'ONCE' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={formData.recurrenceEndDate || ''}
                onChange={(e) => setFormData({ ...formData, recurrenceEndDate: e.target.value || undefined })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Leave empty for no end date</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any additional notes..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Preview Dates Button */}
          {formData.recurrencePattern !== 'ONCE' && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-xl transition-colors"
            >
              <Calendar size={16} />
              {showPreview ? 'Hide' : 'Show'} Preview of Next 5 Due Dates
            </button>
          )}

          {/* Preview Dates */}
          {showPreview && previewDates.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-700 uppercase mb-2 flex items-center gap-2">
                <Repeat size={12} />
                Upcoming Due Dates
              </p>
              <ul className="space-y-1">
                {previewDates.map((date, idx) => (
                  <li key={idx} className="text-sm text-slate-600 flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-500" />
                    {new Date(date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start">
                <AlertCircle size={18} className="text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium mb-1">Please fix the following errors:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
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
            className="flex-1 px-4 py-3 bg-brand-500 text-white rounded-xl hover:bg-brand-600 transition-colors font-medium"
          >
            Create Bill
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecurringBillFormModal;
