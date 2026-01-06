import React, { useState, useRef } from 'react';
import { parseTransactions } from '../services/geminiService';
import { Transaction, TransactionType, AppSettings } from '../types';
import { Sparkles, ArrowRight, X, Check, Loader2, MessageSquareText, Clipboard, Info, Image as ImageIcon, Banknote, BrainCircuit, Calendar, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { parseReceiptLineItems, ReceiptLineItem } from '../services/receiptSplitService';
import SplitEditorModal, { ItemGroup } from './SplitEditorModal';
import { batchMatchCheques, getChequeMatchSummary, ChequeMatchResult } from '../services/chequeMatchingService';

interface AddTransactionProps {
  onAdd: (transactions: Transaction[]) => void;
  onCancel: () => void;
  settings: AppSettings;
  existingTransactions: Transaction[];
  onAddRule?: (merchantKeyword: string, category: string, type: TransactionType) => void;
}

const AddTransaction: React.FC<AddTransactionProps> = ({ onAdd, onCancel, settings, existingTransactions, onAddRule }) => {
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  
  // AI Mode State
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{data: string, mimeType: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Review Mode State
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [transactionReceipts, setTransactionReceipts] = useState<Map<string, {data: string, keep: boolean}>>(new Map());
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Cheque Matching State
  const [chequeMatchResults, setChequeMatchResults] = useState<Map<string, ChequeMatchResult>>(new Map());

  // Split State
  const [splittingTransaction, setSplittingTransaction] = useState<Transaction | null>(null);
  const [splitLineItems, setSplitLineItems] = useState<ReceiptLineItem[] | null>(null);
  const [isSplitLoading, setIsSplitLoading] = useState(false);

  // Manual Mode State
  const [manualType, setManualType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [manualAmount, setManualAmount] = useState('');
  const [manualMerchant, setManualMerchant] = useState('Cash');
  const [manualCategory, setManualCategory] = useState(settings.categories[0]?.name || 'Other');
  const [manualAccount, setManualAccount] = useState(() => {
    // Try to find a Cash or Wallet account first
    const cashAcc = settings.accounts.find(a => a.type === 'Cash' || a.type === 'Wallet');
    return cashAcc ? cashAcc.id : '';
  });
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualTime, setManualTime] = useState(new Date().toTimeString().split(' ')[0].substring(0, 5));

  const isDuplicate = (tx: Partial<Transaction>) => {
    // Strict duplicate check based on Financial constraints:
    // Same Amount, Same Date, Same Time (if present), Same Type.
    // We ignore Merchant name to handle parsing variations (e.g., "Starbucks" vs "Starbucks Coffee").
    return existingTransactions.some(existing => 
      Math.abs(existing.amount - (tx.amount || 0)) < 0.01 &&
      existing.type === tx.type &&
      existing.date === tx.date &&
      (existing.time || '') === (tx.time || '')
    );
  };

  // --- AI HANDLERS ---
  const handleAnalyze = async () => {
    if (!inputText.trim() && !selectedImage) return;
    
    setIsProcessing(true);
    setError(null);
    try {
      const results = await parseTransactions(
        inputText, 
        settings,
        selectedImage?.data, 
        selectedImage?.mimeType
      );
      
      const uniqueResults: Transaction[] = [];
      let duplicateCount = 0;

      // Step 1: Match cheques before creating transaction objects
      const chequeMatches = batchMatchCheques(results, settings.scheduledTransactions || []);
      const chequeMatchMap = new Map<string, ChequeMatchResult>();

      results.forEach((r, index) => {
        if (!isDuplicate(r)) {
          // Map accountId: If Gemini returned last4digits, find the actual account UUID
          let mappedAccountId = r.accountId;
          if (mappedAccountId && !mappedAccountId.includes('-')) {
            // It's likely last4digits, not a UUID (UUIDs contain hyphens)
            const matchedAccount = settings.accounts.find(a =>
              a.last4Digits === mappedAccountId || a.id === mappedAccountId
            );
            mappedAccountId = matchedAccount?.id;
          }

          const txId = uuidv4();
          const transaction: Transaction = {
            ...r,
            id: txId,
            accountId: mappedAccountId
          };

          // Step 2: If this is a cheque, check for match and update status
          const matchResult = chequeMatches.get(index);
          if (matchResult && matchResult.matchedScheduledTransaction) {
            // Auto-link the matched scheduled transaction ID
            transaction.chequeStatus = 'CLEARED';
            chequeMatchMap.set(txId, matchResult);
          } else if (r.isCheque) {
            // No match found - keep as PENDING
            transaction.chequeStatus = 'PENDING';
            if (matchResult) {
              chequeMatchMap.set(txId, matchResult);
            }
          }

          uniqueResults.push(transaction);
        } else {
          duplicateCount++;
        }
      });

      // Step 3: Set match results for display
      setChequeMatchResults(chequeMatchMap);

      // Step 4: Display summary
      const matchSummary = getChequeMatchSummary(chequeMatches);
      let statusMessage = '';

      if (matchSummary.total > 0) {
        statusMessage = `Cheques: ${matchSummary.highConfidence} matched, ${matchSummary.mediumConfidence} partial, ${matchSummary.noMatch} unmatched`;
        if (matchSummary.hasIssues && matchSummary.warnings.length > 0) {
          statusMessage += '\n⚠️ ' + matchSummary.warnings[0];
        }
      }

      if (duplicateCount > 0) {
        statusMessage = statusMessage
          ? `${statusMessage}\nSkipped ${duplicateCount} duplicate(s)`
          : `Skipped ${duplicateCount} duplicate transaction(s).`;
      }

      setPreviewData(uniqueResults);
      if (statusMessage) {
        setError(statusMessage);
      }
    } catch (err) {
      setError("We couldn't parse that. Try pasting clearer text or a better image.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputText(text);
        setError(null);
      } else {
        setError("Clipboard is empty.");
      }
    } catch (err) {
      console.error("Clipboard error:", err);
      setError("Please allow clipboard permissions or paste manually.");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        setSelectedImage({
          data: base64Data,
          mimeType: file.type
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmPreview = () => {
    if (previewData) {
      // Merge receipt images into transactions before submitting
      const transactionsWithReceipts = previewData.map(tx => {
        const receipt = transactionReceipts.get(tx.id);
        if (receipt) {
          return { ...tx, receiptImage: receipt.data, keepReceipt: receipt.keep };
        }
        return tx;
      });
      onAdd(transactionsWithReceipts);
      setTransactionReceipts(new Map());
    }
  };

  const handleRemovePreviewItem = (id: string) => {
    if (previewData) {
      setPreviewData(previewData.filter(t => t.id !== id));
    }
  };

  // --- MANUAL HANDLERS ---
  const handleManualSubmit = () => {
    if (!manualAmount) return;

    const accName = settings.accounts.find(a => a.id === manualAccount)?.name || 'Cash';

    const newTxn: Transaction = {
      id: uuidv4(),
      amount: parseFloat(manualAmount),
      currency: settings.baseCurrency,
      merchant: manualMerchant,
      category: manualCategory,
      date: manualDate,
      time: manualTime,
      type: manualType,
      accountId: manualAccount || undefined,
      account: accName,
      rawText: 'Manual Entry'
    };

    if (isDuplicate(newTxn)) {
       setError("This transaction already exists (Duplicate).");
       return;
    }

    onAdd([newTxn]);
  };

  // --- SPLIT HANDLERS ---
  const handleSplitTransaction = async (transaction: Transaction) => {
    // Check if receipt image exists (from map or already attached)
    const receipt = transactionReceipts.get(transaction.id);
    if (!transaction.receiptImage && !receipt) {
      alert('Please upload a receipt image first');
      return;
    }

    setSplittingTransaction(transaction);
    setIsSplitLoading(true);

    try {
      const imageToUse = transaction.receiptImage || receipt?.data;
      const [mimeType, base64Data] = imageToUse!.split(',');
      const cleanMimeType = mimeType.match(/:(.*?);/)?.[1] || 'image/jpeg';

      const result = await parseReceiptLineItems(
        base64Data,
        cleanMimeType,
        settings
      );

      setSplitLineItems(result.lineItems);
    } catch (error) {
      console.error('Split parse error:', error);
      alert('Failed to parse receipt. Please try again.');
      setSplittingTransaction(null);
    } finally {
      setIsSplitLoading(false);
    }
  };

  const handleConfirmSplit = (groups: ItemGroup[]) => {
    if (!splittingTransaction) return;

    const groupId = uuidv4();
    const splitTransactions: Transaction[] = [];
    const receipt = transactionReceipts.get(splittingTransaction.id);

    groups.forEach((group) => {
      const groupAmount = group.items.reduce((sum, item) => sum + item.amount, 0);
      const groupDescription = group.items.map((i) => i.description).join(', ');

      splitTransactions.push({
        ...splittingTransaction,
        id: uuidv4(),
        groupId,
        amount: groupAmount,
        merchant: `${splittingTransaction.merchant} - ${groupDescription}`,
        category: group.category,
        receiptImage: splittingTransaction.receiptImage || receipt?.data,
      });
    });

    // Replace original transaction with split transactions in preview
    if (previewData) {
      const updated = previewData.filter((t) => t.id !== splittingTransaction.id);
      setPreviewData([...updated, ...splitTransactions]);
    }

    setSplittingTransaction(null);
    setSplitLineItems(null);
  };

  // --- REVIEW MODE HANDLERS ---
  const handleEditTransaction = (transaction: Transaction) => {
    if (editingTransactionId === transaction.id) {
      // If already editing, save changes
      handleSaveInlineEdit();
    } else {
      // Start editing this transaction
      setEditingTransactionId(transaction.id);
      setEditingTransaction({ ...transaction });
    }
  };

  const handleSaveInlineEdit = () => {
    if (editingTransaction && editingTransactionId && previewData) {
      const updated = previewData.map(tx =>
        tx.id === editingTransactionId ? editingTransaction : tx
      );
      setPreviewData(updated);
      setEditingTransactionId(null);
      setEditingTransaction(null);
    }
  };

  const handleCancelInlineEdit = () => {
    setEditingTransactionId(null);
    setEditingTransaction(null);
  };

  const handleInlineFieldChange = (field: keyof Transaction, value: any) => {
    if (editingTransaction) {
      setEditingTransaction({ ...editingTransaction, [field]: value });
    }
  };

  const handleReceiptUploadForTransaction = (transactionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newReceipts = new Map(transactionReceipts);
        newReceipts.set(transactionId, { data: reader.result as string, keep: false });
        setTransactionReceipts(newReceipts);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleKeepReceipt = (transactionId: string) => {
    const receipt = transactionReceipts.get(transactionId);
    if (receipt) {
      const newReceipts = new Map(transactionReceipts);
      newReceipts.set(transactionId, { ...receipt, keep: !receipt.keep });
      setTransactionReceipts(newReceipts);
    }
  };

  const handleRemoveReceipt = (transactionId: string) => {
    const newReceipts = new Map(transactionReceipts);
    newReceipts.delete(transactionId);
    setTransactionReceipts(newReceipts);
  };

  const handleCreateRule = (transaction: Transaction) => {
    if (window.confirm(`Create recurring rule for "${transaction.merchant}"?\n\nCategory: ${transaction.category}\nType: ${transaction.type}`)) {
      if (onAddRule) {
        onAddRule(transaction.merchant, transaction.category, transaction.type);
        alert(`Rule created successfully! Future transactions from "${transaction.merchant}" will be categorized as ${transaction.category}.`);
      } else {
        alert('Rule creation not available. Please update from Settings.');
      }
    }
  };

  const handleOpenFullEdit = (transaction: Transaction) => {
    // Save any pending inline edits first
    if (editingTransactionId === transaction.id) {
      handleSaveInlineEdit();
    }
    // Open EditTransactionModal (will implement modal integration next)
    setEditingTransaction(transaction);
  };

  if (previewData) {
    return (
      <div className="h-full flex flex-col pb-24">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Review Transactions</h2>
          <p className="text-slate-500">We found {previewData.length} transaction{previewData.length !== 1 ? 's' : ''}.</p>
          {error && <p className="text-xs text-amber-600 mt-2 font-medium bg-amber-50 p-2 rounded-lg inline-block">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
           {previewData.length === 0 && (
             <div className="text-center py-10 text-slate-400">
               No transactions left to import.
               <button onClick={() => setPreviewData(null)} className="block mx-auto mt-4 text-brand-600 font-medium">Try again</button>
             </div>
           )}
           {previewData.map((t) => {
             const isEditing = editingTransactionId === t.id;
             const txData = isEditing && editingTransaction ? editingTransaction : t;
             const receipt = transactionReceipts.get(t.id);

             return (
            <div
              key={t.id}
              onClick={() => !isEditing && handleEditTransaction(t)}
              className={`bg-white p-4 rounded-xl shadow-sm border-2 relative group transition-all cursor-pointer ${
                isEditing ? 'border-brand-500 ring-2 ring-brand-200' : 'border-slate-200 hover:border-brand-300'
              }`}
            >
              <button
                onClick={(e) => { e.stopPropagation(); handleRemovePreviewItem(t.id); }}
                className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 transition-colors z-10"
              >
                <X size={18} />
              </button>

              {/* EDIT MODE */}
              {isEditing ? (
                <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                  {/* Amount */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Amount</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        step="0.01"
                        value={txData.amount}
                        onChange={(e) => handleInlineFieldChange('amount', parseFloat(e.target.value) || 0)}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-lg font-bold focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      />
                      <span className="text-slate-600 font-semibold">{txData.currency}</span>
                    </div>
                  </div>

                  {/* Merchant */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Merchant</label>
                    <input
                      type="text"
                      value={txData.merchant}
                      onChange={(e) => handleInlineFieldChange('merchant', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>

                  {/* Category & Account */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Category</label>
                      <select
                        value={txData.category}
                        onChange={(e) => handleInlineFieldChange('category', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      >
                        {settings.categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Account</label>
                      <select
                        value={txData.accountId || ''}
                        onChange={(e) => {
                          const acc = settings.accounts.find(a => a.id === e.target.value);
                          handleInlineFieldChange('accountId', e.target.value);
                          handleInlineFieldChange('account', acc?.name || '');
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      >
                        <option value="">None</option>
                        {settings.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Date</label>
                    <input
                      type="date"
                      value={txData.date}
                      onChange={(e) => handleInlineFieldChange('date', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>

                  {/* Cheque Number (if cheque) */}
                  {txData.isCheque && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">📝 Cheque Number</label>
                      <input
                        type="text"
                        value={txData.chequeNumber || ''}
                        onChange={(e) => handleInlineFieldChange('chequeNumber', e.target.value)}
                        className="w-full px-3 py-2 bg-purple-50 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Enter cheque number"
                      />
                    </div>
                  )}

                  {/* Receipt Upload Section */}
                  <div className="pt-3 border-t border-slate-200">
                    {!receipt && !txData.receiptImage ? (
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleReceiptUploadForTransaction(t.id, e)}
                          className="hidden"
                        />
                        <div className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2">
                          📎 Upload Receipt
                        </div>
                      </label>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative h-24 bg-slate-100 rounded-lg overflow-hidden">
                          <img
                            src={receipt?.data || txData.receiptImage}
                            alt="Receipt"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex gap-2 items-center">
                          <label className="flex-1">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleReceiptUploadForTransaction(t.id, e)}
                              className="hidden"
                            />
                            <div className="w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors cursor-pointer text-center">
                              Change
                            </div>
                          </label>
                          <button
                            onClick={() => handleRemoveReceipt(t.id)}
                            className="flex-1 py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium transition-colors"
                          >
                            Remove
                          </button>
                          <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={receipt?.keep || false}
                              onChange={() => handleToggleKeepReceipt(t.id)}
                              className="rounded"
                            />
                            Keep
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSaveInlineEdit}
                      className="flex-1 py-2 px-3 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <Save size={14} />
                      Save
                    </button>
                    <button
                      onClick={handleCancelInlineEdit}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* VIEW MODE */
                <>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-slate-800 text-lg">{t.merchant}</div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold mt-1">{t.category}</div>
                    </div>
                    <div className={`font-bold text-lg ${
                      t.type === TransactionType.INCOME ? 'text-green-600' :
                      t.type === TransactionType.OBLIGATION ? 'text-orange-600' :
                      'text-slate-800'
                    }`}>
                      {t.type === TransactionType.INCOME ? '+' : '-'}{t.currency} {t.amount.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span>{t.date}</span>
                      {t.account && <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono">{t.account}</span>}
                    </div>
                    {t.isTransfer && <span className="text-brand-600 font-bold">Transfer</span>}
                    {t.originalAmount && t.originalAmount !== t.amount && (
                      <div className="text-slate-500 italic">
                        Converted from {t.originalCurrency} {t.originalAmount.toFixed(2)}
                      </div>
                    )}
                    {t.rawText && <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500 truncate max-w-[250px]">Src: "{t.rawText}"</span>}
                    {receipt && <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded font-medium">📎 Receipt Attached</span>}

                    {/* Cheque Status Indicator */}
                    {t.isCheque && (
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-md font-semibold flex items-center gap-1.5">
                            📝 Cheque #{t.chequeNumber}
                          </span>
                          {t.chequeStatus === 'CLEARED' ? (
                            <span className="bg-green-50 text-green-700 px-2 py-1 rounded-md font-semibold flex items-center gap-1.5">
                              <CheckCircle2 size={14} />
                              Matched
                            </span>
                          ) : (
                            <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-md font-semibold flex items-center gap-1.5">
                              <AlertCircle size={14} />
                              Pending
                            </span>
                          )}

                          {/* Match Confidence Badge */}
                          {chequeMatchResults.has(t.id) && (() => {
                            const matchResult = chequeMatchResults.get(t.id)!;
                            if (matchResult.confidence === 'HIGH') {
                              return (
                                <span className="text-green-700 text-xs font-medium flex items-center gap-1">
                                  <CheckCircle2 size={12} />
                                  High Confidence
                                </span>
                              );
                            } else if (matchResult.confidence === 'MEDIUM') {
                              return (
                                <span className="text-amber-700 text-xs font-medium flex items-center gap-1">
                                  <AlertTriangle size={12} />
                                  Partial Match
                                </span>
                              );
                            } else if (matchResult.confidence === 'LOW') {
                              return (
                                <span className="text-red-700 text-xs font-medium flex items-center gap-1">
                                  <AlertCircle size={12} />
                                  Low Confidence
                                </span>
                              );
                            } else if (matchResult.confidence === 'NONE') {
                              return (
                                <span className="text-slate-600 text-xs font-medium flex items-center gap-1">
                                  <AlertCircle size={12} />
                                  No Match
                                </span>
                              );
                            }
                          })()}
                        </div>

                        {/* Match Details */}
                        {chequeMatchResults.has(t.id) && chequeMatchResults.get(t.id)!.matchReason && (
                          <div className="text-xs text-slate-600 mt-1 bg-slate-50 px-2 py-1 rounded">
                            {chequeMatchResults.get(t.id)!.matchReason}
                          </div>
                        )}

                        {/* Mismatch Warning */}
                        {chequeMatchResults.has(t.id) && chequeMatchResults.get(t.id)!.mismatchWarning && (
                          <div className="text-xs text-amber-700 mt-1 bg-amber-50 px-2 py-1 rounded flex items-start gap-1">
                            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                            <span>{chequeMatchResults.get(t.id)!.mismatchWarning}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons - View Mode */}
                  <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCreateRule(t)}
                        className="flex-1 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                      >
                        <BookmarkPlus size={14} />
                        Remember
                      </button>
                      <button
                        onClick={() => handleEditTransaction(t)}
                        className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                      >
                        ⋯ More Options
                      </button>
                    </div>

                    {/* Split with Receipt - Only show if receipt exists */}
                    {(receipt || t.receiptImage) && (
                      <button
                        onClick={() => handleSplitTransaction(t)}
                        disabled={isSplitLoading && splittingTransaction?.id === t.id}
                        className="w-full py-2 px-3 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 text-purple-700 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        {isSplitLoading && splittingTransaction?.id === t.id ? (
                          <>
                            <Loader2 className="animate-spin" size={14} />
                            Analyzing Receipt...
                          </>
                        ) : (
                          <>
                            📄 Split with Receipt
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
           );
           })}
        </div>

        <div className="mt-6 flex gap-3 pt-4 border-t border-slate-100 bg-slate-50/50 backdrop-blur-sm sticky bottom-0">
          <button 
            onClick={() => setPreviewData(null)}
            className="flex-1 py-3.5 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 shadow-sm active:scale-95 transition-transform"
          >
            Back
          </button>
          <button 
            onClick={handleConfirmPreview}
            disabled={previewData.length === 0}
            className="flex-1 py-3.5 rounded-xl font-semibold text-white bg-brand-600 shadow-lg shadow-brand-500/30 flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50 disabled:shadow-none"
          >
            <Check size={20} />
            Import All
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col pb-24">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Add Transaction</h2>
        
        {/* Toggle Mode */}
        <div className="bg-slate-100 p-1 rounded-xl flex mb-6">
           <button 
             onClick={() => setMode('ai')}
             className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${mode === 'ai' ? 'bg-white shadow text-brand-600' : 'text-slate-500'}`}
           >
             <BrainCircuit size={16} /> AI Parse
           </button>
           <button 
             onClick={() => setMode('manual')}
             className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${mode === 'manual' ? 'bg-white shadow text-brand-600' : 'text-slate-500'}`}
           >
             <Banknote size={16} /> Manual Entry
           </button>
        </div>
      </div>

      {mode === 'ai' && (
        <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
           <div className="flex items-start gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-xs mb-4">
               <Info className="shrink-0 mt-0.5" size={14} />
               <p>Parsing optimized for {settings.baseCurrency}. Amounts in other currencies will be converted automatically.</p>
           </div>
           
           <div className="relative flex-1 mb-6 group flex flex-col gap-4">
              <textarea
                className="w-full flex-1 min-h-[180px] p-5 bg-white rounded-2xl border-0 shadow-sm text-slate-700 text-lg placeholder:text-slate-300 focus:ring-2 focus:ring-brand-500 resize-none font-medium leading-relaxed"
                placeholder={`Paste SMS or text here...\n\nOr upload a screenshot.`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              
              {selectedImage && (
                <div className="relative h-32 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                   <img 
                     src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} 
                     alt="Preview" 
                     className="w-full h-full object-cover opacity-80"
                   />
                   <button 
                    onClick={() => setSelectedImage(null)}
                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors"
                   >
                     <X size={16} />
                   </button>
                   <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded">Image Attached</div>
                </div>
              )}
              
              <div className="flex justify-end gap-2">
                 <button
                   onClick={handlePaste}
                   className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors shadow-sm border border-slate-100"
                   title="Paste from clipboard"
                 >
                   <Clipboard size={16} /> Paste Text
                 </button>

                 <button
                   onClick={() => fileInputRef.current?.click()}
                   className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors shadow-sm border border-slate-100"
                   title="Upload Image"
                 >
                   <ImageIcon size={16} /> Upload Image
                 </button>
                 <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                 />
              </div>
           </div>

           {error && (
             <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2 animate-pulse">
               <X size={16} /> {error}
             </div>
           )}

           <div className="flex gap-3">
             <button onClick={onCancel} className="py-4 px-6 rounded-xl font-semibold text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
             <button 
               onClick={handleAnalyze}
               disabled={(!inputText.trim() && !selectedImage) || isProcessing}
               className="flex-1 py-4 rounded-xl font-bold text-white bg-gradient-to-r from-brand-600 to-brand-500 shadow-xl shadow-brand-500/20 flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-70 disabled:shadow-none"
             >
               {isProcessing ? <><Loader2 className="animate-spin" size={20} /> Analyzing...</> : <><Sparkles size={20} /> Analyze</>}
             </button>
           </div>
        </div>
      )}

      {mode === 'manual' && (
        <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-left-4 duration-300">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
             {/* Transaction Type Toggle */}
             <div className="flex gap-2 mb-2">
               <button
                 onClick={() => setManualType(TransactionType.EXPENSE)}
                 className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${
                   manualType === TransactionType.EXPENSE
                     ? 'bg-brand-600 text-white shadow-md'
                     : 'bg-slate-100 text-slate-500'
                 }`}
               >
                 Expense
               </button>
               <button
                 onClick={() => setManualType(TransactionType.INCOME)}
                 className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${
                   manualType === TransactionType.INCOME
                     ? 'bg-green-600 text-white shadow-md'
                     : 'bg-slate-100 text-slate-500'
                 }`}
               >
                 Income
               </button>
             </div>

             <div>
               <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Amount</label>
               <div className="relative">
                 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">{settings.baseCurrency}</span>
                 <input 
                   type="number"
                   autoFocus
                   value={manualAmount}
                   onChange={(e) => setManualAmount(e.target.value)}
                   className="w-full pl-16 pr-4 py-4 bg-slate-50 rounded-xl text-3xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                   placeholder="0.00"
                 />
               </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Date</label>
                  <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl text-sm" />
               </div>
               <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Time</label>
                  <input type="time" value={manualTime} onChange={e => setManualTime(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl text-sm" />
               </div>
             </div>

             <div>
               <label className="text-xs font-bold text-slate-500 mb-1 block">Description</label>
               <input 
                 type="text" 
                 value={manualMerchant}
                 onChange={(e) => setManualMerchant(e.target.value)}
                 className="w-full p-3 bg-slate-50 rounded-xl text-sm border-0 focus:ring-2 focus:ring-brand-500" 
                 placeholder="e.g. Lunch"
               />
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-xs font-bold text-slate-500 mb-1 block">Category</label>
                   <select 
                     value={manualCategory}
                     onChange={(e) => setManualCategory(e.target.value)}
                     className="w-full p-3 bg-slate-50 rounded-xl text-sm appearance-none"
                   >
                     {settings.categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                   </select>
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 mb-1 block">Account</label>
                   <select 
                     value={manualAccount}
                     onChange={(e) => setManualAccount(e.target.value)}
                     className="w-full p-3 bg-slate-50 rounded-xl text-sm appearance-none"
                   >
                     {settings.accounts.length === 0 && <option value="">No Accounts</option>}
                     {settings.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                     <option value="">None (Cash)</option>
                   </select>
                </div>
             </div>
             
             {error && (
               <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                 <X size={16} /> {error}
               </div>
             )}
          </div>

          <div className="flex gap-3 mt-6">
             <button onClick={onCancel} className="py-4 px-6 rounded-xl font-semibold text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
             <button
               onClick={handleManualSubmit}
               disabled={!manualAmount}
               className={`flex-1 py-4 rounded-xl font-bold text-white shadow-lg active:scale-95 transition-transform disabled:opacity-50 ${
                 manualType === TransactionType.INCOME
                   ? 'bg-green-600 shadow-green-500/20'
                   : 'bg-brand-600 shadow-brand-500/20'
               }`}
             >
               {manualType === TransactionType.INCOME ? 'Add Income' : 'Add Expense'}
             </button>
          </div>
        </div>
      )}

      {/* Split Editor Modal */}
      {splittingTransaction && splitLineItems && (
        <SplitEditorModal
          originalAmount={splittingTransaction.amount}
          merchant={splittingTransaction.merchant}
          date={splittingTransaction.date}
          accountId={splittingTransaction.accountId}
          lineItems={splitLineItems}
          settings={settings}
          baseCurrency={settings.baseCurrency}
          onConfirm={handleConfirmSplit}
          onCancel={() => {
            setSplittingTransaction(null);
            setSplitLineItems(null);
          }}
        />
      )}
    </div>
  );
};

export default AddTransaction;