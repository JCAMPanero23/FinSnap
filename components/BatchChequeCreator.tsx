import React, { useState, useRef } from 'react';
import { X, Camera, Upload, Image } from 'lucide-react';
import { Account, Category } from '../types';
import { previewChequeDates } from '../services/batchChequeService';
import LiveScanner from './LiveScanner';

interface BatchChequeCreatorProps {
  onClose: () => void;
  onSave: (data: {
    merchant: string;
    amount: number;
    currency: string;
    category: string;
    accountId: string;
    firstChequeDate: string;
    frequency: 'MONTHLY' | 'WEEKLY' | 'CUSTOM';
    intervalValue: number;
    numberOfCheques: number;
    startingChequeNumber?: number;
    chequeImages?: string[];
  }) => Promise<void>;
  accounts: Account[];
  categories: Category[];
}

const BatchChequeCreator: React.FC<BatchChequeCreatorProps> = ({
  onClose,
  onSave,
  accounts,
  categories,
}) => {
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0]?.name || '');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [firstChequeDate, setFirstChequeDate] = useState('');
  const [frequency, setFrequency] = useState<'MONTHLY' | 'WEEKLY' | 'CUSTOM'>('MONTHLY');
  const [intervalValue, setIntervalValue] = useState(1);
  const [numberOfCheques, setNumberOfCheques] = useState(6);
  const [startingChequeNumber, setStartingChequeNumber] = useState('');
  const [chequeImages, setChequeImages] = useState<string[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [scanningIndex, setScanningIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview dates
  const previewDates = firstChequeDate
    ? previewChequeDates(firstChequeDate, frequency, intervalValue, numberOfCheques)
    : [];

  const handleScanCheque = (imageData: string) => {
    setChequeImages(prev => {
      const newImages = [...prev];
      // Find next empty slot or use scanningIndex
      let targetIndex = scanningIndex;
      if (newImages[targetIndex]) {
        // If current slot is filled, find next empty slot
        targetIndex = newImages.findIndex((img, idx) => !img && idx < numberOfCheques);
        if (targetIndex === -1) targetIndex = scanningIndex;
      }
      newImages[targetIndex] = imageData;
      return newImages;
    });
    setShowScanner(false);

    // Auto-advance to next empty slot
    const nextIndex = scanningIndex + 1;
    if (nextIndex < numberOfCheques) {
      setScanningIndex(nextIndex);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages = [...chequeImages];
    let currentIndex = 0;

    for (let i = 0; i < Math.min(files.length, numberOfCheques); i++) {
      const file = files[i];

      // Convert to base64
      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          // Find next empty slot
          while (currentIndex < numberOfCheques && newImages[currentIndex]) {
            currentIndex++;
          }
          if (currentIndex < numberOfCheques) {
            newImages[currentIndex] = base64;
            currentIndex++;
          }
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }

    setChequeImages(newImages);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant || !amount || !firstChequeDate || !accountId) return;

    setSaving(true);
    try {
      await onSave({
        merchant,
        amount: parseFloat(amount),
        currency: accounts.find(a => a.id === accountId)?.currency || 'USD',
        category,
        accountId,
        firstChequeDate,
        frequency,
        intervalValue,
        numberOfCheques,
        startingChequeNumber: startingChequeNumber ? parseInt(startingChequeNumber) : undefined,
        chequeImages: chequeImages.filter(img => img), // Only include scanned images
      });
      onClose();
    } catch (error) {
      console.error('Error creating batch cheques:', error);
      alert('Failed to create batch cheques');
    } finally {
      setSaving(false);
    }
  };

  if (showScanner) {
    return (
      <LiveScanner
        onCapture={handleScanCheque}
        onClose={() => setShowScanner(false)}
        title={`Scan Cheque #${scanningIndex + 1} of ${numberOfCheques}`}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Create Cheque Series</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Merchant *</label>
            <input
              type="text"
              value={merchant}
              onChange={e => setMerchant(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="e.g., Rent - Landlord Name"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Cheque Date *
            </label>
            <input
              type="date"
              value={firstChequeDate}
              onChange={e => setFirstChequeDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="MONTHLY"
                  checked={frequency === 'MONTHLY'}
                  onChange={e => setFrequency(e.target.value as any)}
                />
                <span>Monthly</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="WEEKLY"
                  checked={frequency === 'WEEKLY'}
                  onChange={e => setFrequency(e.target.value as any)}
                />
                <span>Weekly</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="CUSTOM"
                  checked={frequency === 'CUSTOM'}
                  onChange={e => setFrequency(e.target.value as any)}
                />
                <span>Every</span>
                <input
                  type="number"
                  min="1"
                  value={intervalValue}
                  onChange={e => setIntervalValue(parseInt(e.target.value) || 1)}
                  className="w-16 border border-gray-300 rounded px-2 py-1"
                />
                <span>{frequency === 'MONTHLY' ? 'months' : frequency === 'WEEKLY' ? 'weeks' : 'days'}</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Cheques *
            </label>
            <input
              type="number"
              min="1"
              max="24"
              value={numberOfCheques}
              onChange={e => setNumberOfCheques(parseInt(e.target.value) || 1)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            />
          </div>

          {/* Preview */}
          {previewDates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preview:</label>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
                {previewDates.map((date, idx) => (
                  <div key={idx} className="text-sm text-gray-700">
                    ✓ {new Date(date).toLocaleDateString()} - {amount || '0.00'} {accounts.find(a => a.id === accountId)?.currency || 'USD'}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cheque Numbers (optional)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Starting from:</span>
              <input
                type="number"
                value={startingChequeNumber}
                onChange={e => setStartingChequeNumber(e.target.value)}
                className="w-32 border border-gray-300 rounded-lg px-3 py-2"
                placeholder="10001"
              />
            </div>
          </div>

          {/* Cheque Images */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cheque Images (optional) - {chequeImages.filter(img => img).length}/{numberOfCheques} uploaded
            </label>

            <div className="grid grid-cols-2 gap-2">
              {/* Take Photo Button */}
              <button
                type="button"
                onClick={() => {
                  // Find first empty slot
                  const emptyIndex = chequeImages.findIndex((img, idx) => !img && idx < numberOfCheques);
                  setScanningIndex(emptyIndex !== -1 ? emptyIndex : 0);
                  setShowScanner(true);
                }}
                className="bg-purple-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-600 flex items-center justify-center gap-2"
              >
                <Camera size={18} />
                Take Photo
              </button>

              {/* Upload Files Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 flex items-center justify-center gap-2"
              >
                <Image size={18} />
                Upload Files
              </button>
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Upload Status */}
            {chequeImages.filter(img => img).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {Array.from({ length: numberOfCheques }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-8 h-8 rounded border-2 flex items-center justify-center text-xs font-bold ${
                      chequeImages[idx]
                        ? 'bg-green-100 border-green-500 text-green-700'
                        : 'bg-gray-100 border-gray-300 text-gray-400'
                    }`}
                  >
                    {idx + 1}
                  </div>
                ))}
              </div>
            )}
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
              {saving ? 'Creating...' : `Create ${numberOfCheques} Cheques`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BatchChequeCreator;
