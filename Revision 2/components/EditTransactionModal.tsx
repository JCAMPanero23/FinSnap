import React, { useState, useRef } from 'react';
import { Transaction, TransactionType, Category, Account } from '../types';
import { X, Save, Trash2, RefreshCw, BookmarkPlus, Split, Camera, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { parseReceiptBreakdown } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';

interface EditTransactionModalProps {
  transaction: Transaction;
  categories: Category[];
  accounts: Account[];
  onSave: (updated: Transaction | Transaction[]) => void;
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
  const [activeTab, setActiveTab] = useState<'details' | 'split'>('details');
  const [formData, setFormData] = useState<Transaction>({ ...transaction });
  
  // Split State
  const [splits, setSplits] = useState<{name: string, amount: number, category: string}[]>([]);
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize conversion mode if data exists
  const [isConverting, setIsConverting] = useState(() => {
    return !!(transaction.originalAmount && transaction.originalAmount !== transaction.amount);
  });

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

  // --- Split / Receipt Handlers ---
  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingReceipt(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          
          // Call AI Service
          const items = await parseReceiptBreakdown(
            base64Data, 
            file.type, 
            formData.amount, 
            formData.currency,
            { 
              baseCurrency: formData.currency, 
              categories, 
              accounts, 
              recurringRules: [], 
              savingsGoals: [],
              warranties: []
            }
          );
          
          setSplits(items.map(i => ({ name: i.item, amount: i.amount, category: i.category })));
        } catch (err) {
          alert("Failed to parse receipt. Please try again or add items manually.");
        } finally {
          setIsProcessingReceipt(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddSplit = () => {
    setSplits(prev => [...prev, { name: '', amount: 0, category: formData.category }]);
  };

  const handleRemoveSplit = (index: number) => {
    setSplits(prev => prev.filter((_, i) => i !== index));
  };

  const updateSplit = (index: number, field: keyof typeof splits[0], value: any) => {
    setSplits(prev => {
       const newSplits = [...prev];
       newSplits[index] = { ...newSplits[index], [field]: value };
       return newSplits;
    });
  };

  const splitTotal = splits.reduce((sum, s) => sum + (s.amount || 0), 0);
  const remaining = formData.amount - splitTotal;
  // ------------------------------------

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (activeTab === 'split' && splits.length > 0) {
      // Create a Group ID to link these splits
      const groupId = uuidv4();
      const splitTags = [...(formData.tags || []), 'Receipt Split'];

      // Create multiple transactions
      const newTransactions: Transaction[] = splits.map((s, idx) => ({
        ...formData,
        id: idx === 0 ? formData.id : uuidv4(), // Keep original ID for first item to replace, others new
        groupId: groupId, 
        
        // Change: Item Name is now the main merchant name
        merchant: s.name, 
        
        category: s.category,
        amount: s.amount,
        rawText: `Split from ${formData.merchant}`,
        parsedMeta: undefined,
        tags: splitTags,
        
        // Save parent details for the "grayed out" line 2
        splitParent: {
          merchant: formData.merchant,
          totalAmount: formData.amount
        }
      }));
      onSave(newTransactions);
    } else {
      // Save as single
      onSave(formData);
    }
  };

  const toggleConversion = () => {
    if (!isConverting) {
      // Initialize conversion fields if missing
      setFormData(prev => ({
        ...prev,
        originalAmount: prev.originalAmount || prev.amount, // Default to current amount
        originalCurrency: prev.originalCurrency || 'EUR', // Default prompt
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">Edit Transaction</h3>
          <button onClick={onClose} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-600 shadow-sm border border-slate-100">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 gap-2 bg-white border-b border-slate-100">
           <button 
             onClick={() => setActiveTab('details')}
             className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'details' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:bg-slate-50'}`}
           >
             Details
           </button>
           <button 
             onClick={() => setActiveTab('split')}
             className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'split' ? 'bg-brand-50 text-brand-700' : 'text-slate-400 hover:bg-slate-50'}`}
           >
             <Split size={14} /> Split / Receipt
           </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
          {activeTab === 'details' && (
            <div className="p-6 space-y-4">
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
            </div>
          )}

          {activeTab === 'split' && (
            <div className="flex-1 flex flex-col p-6 animate-in slide-in-from-right-4">
              <div className="bg-brand-50 rounded-xl p-4 text-center border border-brand-100 mb-4">
                 <div className="text-brand-600 font-bold text-lg">{formData.currency} {formData.amount}</div>
                 <div className="text-xs text-brand-400">Total Transaction</div>
              </div>

              {/* Upload Button */}
              <div className="mb-4">
                 <button 
                   type="button"
                   onClick={() => fileInputRef.current?.click()}
                   disabled={isProcessingReceipt}
                   className="w-full py-3 bg-white border border-slate-200 shadow-sm rounded-xl text-sm font-semibold text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                 >
                   {isProcessingReceipt ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                   {isProcessingReceipt ? 'Analyzing Receipt...' : 'Scan Receipt to Split'}
                 </button>
                 <input 
                   type="file" 
                   ref={fileInputRef} 
                   className="hidden" 
                   accept="image/*" 
                   onChange={handleReceiptUpload}
                 />
              </div>

              {/* Split List */}
              <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                 {splits.length === 0 && (
                   <div className="text-center text-slate-400 text-sm py-4">
                     No items yet. Upload a receipt or add manual splits.
                   </div>
                 )}
                 {splits.map((split, i) => (
                   <div key={i} className="flex gap-2 items-start animate-in slide-in-from-bottom-2">
                      <div className="flex-1 space-y-2">
                         <div className="flex gap-2">
                           <input 
                             type="text" 
                             placeholder="Item Name"
                             className="flex-[2] p-2 bg-slate-50 rounded-lg text-sm border border-slate-200"
                             value={split.name}
                             onChange={(e) => updateSplit(i, 'name', e.target.value)}
                           />
                           <input 
                             type="number"
                             placeholder="0.00"
                             className="flex-1 p-2 bg-slate-50 rounded-lg text-sm font-semibold border border-slate-200"
                             value={split.amount}
                             onChange={(e) => updateSplit(i, 'amount', parseFloat(e.target.value))}
                           />
                         </div>
                         <select 
                           className="w-full p-2 bg-slate-50 rounded-lg text-xs border border-slate-200"
                           value={split.category}
                           onChange={(e) => updateSplit(i, 'category', e.target.value)}
                         >
                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                         </select>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveSplit(i)}
                        className="mt-2 text-slate-300 hover:text-red-500"
                      >
                         <Trash2 size={18} />
                      </button>
                   </div>
                 ))}
                 
                 <button 
                   type="button" 
                   onClick={handleAddSplit}
                   className="text-xs font-bold text-brand-600 flex items-center gap-1 hover:underline mt-2"
                 >
                   <Plus size={14} /> Add Item
                 </button>
              </div>

              {/* Remaining Balance */}
              <div className={`p-3 rounded-xl border flex justify-between items-center text-sm font-bold ${
                 Math.abs(remaining) < 0.05 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                 <span>Remaining to allocate:</span>
                 <span>{formData.currency} {remaining.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="p-6 pt-2 flex gap-3 border-t border-slate-50">
            {activeTab === 'details' && (
              <button 
                type="button"
                onClick={() => { onDelete(transaction.id); onClose(); }}
                className="p-4 rounded-xl font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button 
              type="submit"
              disabled={activeTab === 'split' && Math.abs(remaining) > 0.5}
              className="flex-1 p-4 rounded-xl font-bold text-white bg-brand-600 shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
            >
              <Save size={20} /> {activeTab === 'split' ? 'Save All Splits' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTransactionModal;