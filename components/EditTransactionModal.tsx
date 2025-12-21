import React, { useState, useEffect, useRef } from 'react';
import { Transaction, TransactionType, Category, Account } from '../types';
import { X, Save, Trash2, RefreshCw, BookmarkPlus, Loader2 } from 'lucide-react';
import { parseReceiptLineItems, ReceiptLineItem } from '../services/receiptSplitService';
import SplitEditorModal, { ItemGroup } from './SplitEditorModal';
import { v4 as uuidv4 } from 'uuid';

interface EditTransactionModalProps {
  transaction: Transaction;
  categories: Category[];
  accounts: Account[];
  onSave: (updated: Transaction) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onAddRule?: (merchant: string, category: string, type: TransactionType) => void;
}

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  categories,
  accounts,
  onSave,
  onDelete,
  onClose,
  onAddRule
}) => {
  const [formData, setFormData] = useState<Transaction>({ ...transaction });

  // Initialize conversion mode if data exists
  const [isConverting, setIsConverting] = useState(() => {
    return !!(transaction.originalAmount && transaction.originalAmount !== transaction.amount);
  });

  const [receiptImage, setReceiptImage] = useState<string | undefined>(transaction?.receiptImage);
  const [keepReceipt, setKeepReceipt] = useState<boolean>(transaction?.keepReceipt || false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Split transaction state
  const [showSplitEditor, setShowSplitEditor] = useState(false);
  const [splitLineItems, setSplitLineItems] = useState<ReceiptLineItem[] | null>(null);
  const [isSplitLoading, setIsSplitLoading] = useState(false);

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Account Selection Logic
  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'OTHER_MANUAL') {
       // Keep ID null, let user type name
       setFormData(prev => ({ ...prev, accountId: undefined, account: '' }));
    } else {
       // Selected a known account
       const selectedAcc = accounts.find(a => a.id === value);
       if (selectedAcc) {
         setFormData(prev => ({ ...prev, accountId: selectedAcc.id, account: selectedAcc.name }));
       }
    }
  };

  const handleChange = (field: keyof Transaction, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // --- Currency Conversion Handlers ---
  const handleBaseAmountChange = (val: number) => {
    setFormData(prev => {
      // If converting, update Rate = Base / Original
      let newRate = prev.exchangeRate;
      if (isConverting && prev.originalAmount && prev.originalAmount !== 0) {
        newRate = Number((val / prev.originalAmount).toFixed(6));
      }
      return { ...prev, amount: val, exchangeRate: newRate };
    });
  };

  const handleOriginalAmountChange = (val: number) => {
    setFormData(prev => {
      // Update Base = Original * Rate
      const newBase = Number((val * (prev.exchangeRate || 1)).toFixed(2));
      return { ...prev, originalAmount: val, amount: newBase };
    });
  };

  const handleRateChange = (val: number) => {
     setFormData(prev => {
      // Update Base = Original * Rate
      const newBase = Number(((prev.originalAmount || 0) * val).toFixed(2));
      return { ...prev, exchangeRate: val, amount: newBase };
    });
  };
  // ------------------------------------

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedTransaction: Transaction = {
      ...formData,
      receiptImage,
      keepReceipt,
    };
    onSave(updatedTransaction);
  };

  const toggleConversion = () => {
    if (!isConverting) {
      // Initialize conversion fields if missing
      setFormData(prev => ({
        ...prev,
        originalAmount: prev.originalAmount || prev.amount,
        originalCurrency: prev.originalCurrency || 'USD',
        exchangeRate: prev.exchangeRate || 1
      }));
    }
    setIsConverting(!isConverting);
  };

  const handleSaveAsRule = () => {
    if (onAddRule && formData.merchant) {
      onAddRule(formData.merchant, formData.category, formData.type);
      alert(`Added parsing rule for "${formData.merchant}"`);
    }
  };

  const handleSplitTransaction = async () => {
    if (!receiptImage) {
      alert('Please upload a receipt image first');
      return;
    }

    setIsSplitLoading(true);

    try {
      const [mimeType, base64Data] = receiptImage.split(',');
      const cleanMimeType = mimeType.match(/:(.*?);/)?.[1] || 'image/jpeg';

      // Create a minimal AppSettings object from available data
      const settings = {
        baseCurrency: formData.currency,
        categories: categories,
        accounts: accounts,
        recurringRules: [],
        savingsGoals: [],
        warranties: [],
      };

      const result = await parseReceiptLineItems(
        base64Data,
        cleanMimeType,
        settings
      );

      setSplitLineItems(result.lineItems);
      setShowSplitEditor(true);
    } catch (error) {
      console.error('Split parse error:', error);
      alert('Failed to parse receipt. Please try again.');
    } finally {
      setIsSplitLoading(false);
    }
  };

  const handleConfirmSplit = (groups: ItemGroup[]) => {
    const groupId = uuidv4();
    const splitTransactions: Transaction[] = [];

    groups.forEach((group) => {
      const groupAmount = group.items.reduce((sum, item) => sum + item.amount, 0);
      const groupDescription = group.items.map((i) => i.description).join(', ');

      splitTransactions.push({
        ...formData,
        id: uuidv4(),
        groupId,
        amount: groupAmount,
        merchant: `${formData.merchant} - ${groupDescription}`,
        category: group.category,
        receiptImage: receiptImage,
      });
    });

    // Delete original transaction
    onDelete(transaction.id);

    // Save each split transaction
    splitTransactions.forEach((tx) => {
      onSave(tx);
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">Edit Transaction</h3>
          <button onClick={onClose} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-600 shadow-sm border border-slate-100">
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Amount Section */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center mb-2">
               <label className="text-xs font-semibold text-slate-500">Amount ({formData.currency})</label>
               <button 
                 type="button" 
                 onClick={toggleConversion}
                 className="text-xs text-brand-600 flex items-center gap-1 font-medium"
               >
                 <RefreshCw size={12} />
                 {isConverting ? 'Simple Mode' : 'Convert Currency'}
               </button>
            </div>
            
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">{formData.currency}</span>
              <input 
                type="number" 
                step="0.01"
                required
                value={formData.amount}
                onChange={(e) => handleBaseAmountChange(parseFloat(e.target.value))}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl font-bold text-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              />
            </div>

            {/* Conversion Fields */}
            {isConverting && (
              <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-3 gap-2 animate-in slide-in-from-top-2">
                <div>
                   <label className="text-[10px] text-slate-400 font-semibold">Orig. Amount</label>
                   <input 
                     type="number" step="0.01"
                     value={formData.originalAmount || 0}
                     onChange={(e) => handleOriginalAmountChange(parseFloat(e.target.value))}
                     className="w-full p-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 focus:ring-1 focus:ring-brand-500"
                   />
                </div>
                <div>
                   <label className="text-[10px] text-slate-400 font-semibold">Orig. Curr</label>
                   <input 
                     type="text"
                     value={formData.originalCurrency || ''}
                     onChange={(e) => handleChange('originalCurrency', e.target.value.toUpperCase())}
                     className="w-full p-2 text-sm border border-slate-200 rounded-lg uppercase bg-white text-slate-800 focus:ring-1 focus:ring-brand-500"
                   />
                </div>
                <div>
                   <label className="text-[10px] text-slate-400 font-semibold">Ex. Rate</label>
                   <input 
                     type="number" step="0.0001"
                     value={formData.exchangeRate || 1}
                     onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                     className="w-full p-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 focus:ring-1 focus:ring-brand-500"
                   />
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
               <label className="block text-xs font-semibold text-slate-500">Merchant / Title</label>
               {onAddRule && (
                 <button 
                   type="button" 
                   onClick={handleSaveAsRule}
                   className="text-[10px] flex items-center gap-1 text-brand-600 bg-brand-50 px-2 py-0.5 rounded hover:bg-brand-100"
                   title="Always categorize this merchant like this in future imports"
                 >
                   <BookmarkPlus size={12} /> Remember Rule
                 </button>
               )}
            </div>
            <input 
              type="text" 
              required
              value={formData.merchant}
              onChange={(e) => handleChange('merchant', e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
              <input 
                type="date" 
                required
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Time (Optional)</label>
              <input 
                type="time" 
                value={formData.time || ''}
                onChange={(e) => handleChange('time', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          
           <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Type</label>
              <select 
                value={formData.type}
                onChange={(e) => handleChange('type', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none"
              >
                <option value={TransactionType.EXPENSE}>Expense</option>
                <option value={TransactionType.INCOME}>Income</option>
                <option value={TransactionType.TRANSFER}>Transfer</option>
              </select>
            </div>
             <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Category</label>
              <select 
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Account</label>
            <div className="space-y-2">
              <select
                value={formData.accountId || 'OTHER_MANUAL'}
                onChange={handleAccountChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none"
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} (...{acc.last4Digits || '?'})</option>
                ))}
                <option value="OTHER_MANUAL">Other (Type Custom Name)</option>
              </select>

              {(!formData.accountId) && (
                 <input
                    type="text"
                    placeholder="e.g. Visa ...1234"
                    value={formData.account || ''}
                    onChange={(e) => handleChange('account', e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 animate-in fade-in slide-in-from-top-1"
                  />
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Receipt</label>

            {receiptImage ? (
              <div className="relative">
                <img
                  src={receiptImage}
                  alt="Receipt"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setReceiptImage(undefined)}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-teal-500 transition text-gray-600"
              >
                Upload Receipt
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleReceiptUpload}
              className="hidden"
            />

            <label className="flex items-center gap-2 mt-3 text-sm">
              <input
                type="checkbox"
                checked={keepReceipt}
                onChange={(e) => setKeepReceipt(e.target.checked)}
                className="rounded"
              />
              <span className="text-gray-700">Keep receipt permanently</span>
            </label>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => { onDelete(transaction.id); onClose(); }}
              className="p-4 rounded-xl font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
            >
              <Trash2 size={20} />
            </button>
            <button
              type="button"
              onClick={handleSplitTransaction}
              disabled={isSplitLoading || !receiptImage}
              className="px-4 py-3 rounded-xl font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSplitLoading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Analyzing...
                </>
              ) : (
                <>
                  📄 Split
                </>
              )}
            </button>
            <button
              type="submit"
              className="flex-1 p-4 rounded-xl font-bold text-white bg-brand-600 shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
            >
              <Save size={20} /> Save Changes
            </button>
          </div>
        </form>
      </div>

      {/* Split Editor Modal */}
      {showSplitEditor && splitLineItems && (
        <SplitEditorModal
          originalAmount={formData.amount}
          merchant={formData.merchant}
          date={formData.date}
          accountId={formData.accountId}
          lineItems={splitLineItems}
          settings={{
            baseCurrency: formData.currency,
            categories: categories,
            accounts: accounts,
            recurringRules: [],
            savingsGoals: [],
            warranties: [],
          }}
          baseCurrency={formData.currency}
          onConfirm={handleConfirmSplit}
          onCancel={() => {
            setShowSplitEditor(false);
            setSplitLineItems(null);
          }}
        />
      )}
    </div>
  );
};

export default EditTransactionModal;