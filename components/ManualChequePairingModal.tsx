import React, { useMemo, useState } from 'react';
import { X, TrendingUp, Calendar, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react';
import { ScheduledTransaction, Transaction, Account } from '../types';
import {
  findPairingCandidates,
  getConfidenceLevel,
  getPairingSummary,
  canPairTransaction,
  ChequePairingCandidate
} from '../services/chequePairingService';

interface ManualChequePairingModalProps {
  scheduledCheque: ScheduledTransaction;
  allTransactions: Transaction[];
  allScheduledTransactions: ScheduledTransaction[];
  accounts: Account[];
  onClose: () => void;
  onConfirmPairing: (transactionId: string) => void;
}

const ManualChequePairingModal: React.FC<ManualChequePairingModalProps> = ({
  scheduledCheque,
  allTransactions,
  allScheduledTransactions,
  accounts,
  onClose,
  onConfirmPairing
}) => {
  const [selectedCandidate, setSelectedCandidate] = useState<ChequePairingCandidate | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Find pairing candidates
  const candidates = useMemo(() => {
    return findPairingCandidates(scheduledCheque, allTransactions, allScheduledTransactions);
  }, [scheduledCheque, allTransactions, allScheduledTransactions]);

  const summary = useMemo(() => {
    return getPairingSummary(candidates);
  }, [candidates]);

  // Get account info
  const chequeAccount = accounts.find(a => a.id === scheduledCheque.accountId);

  const handleSelectCandidate = (candidate: ChequePairingCandidate) => {
    setSelectedCandidate(candidate);
    setConfirming(false);
  };

  const handleConfirmPairing = () => {
    if (!selectedCandidate) return;

    const validation = canPairTransaction(
      selectedCandidate.transaction,
      scheduledCheque,
      allScheduledTransactions
    );

    if (!validation.canPair) {
      alert(`Cannot pair: ${validation.reason}`);
      return;
    }

    onConfirmPairing(selectedCandidate.transaction.id);
  };

  const getConfidenceColor = (score: number) => {
    const level = getConfidenceLevel(score);
    switch (level) {
      case 'HIGH':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'LOW':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'NONE':
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getConfidenceBadgeColor = (score: number) => {
    const level = getConfidenceLevel(score);
    switch (level) {
      case 'HIGH':
        return 'bg-green-100 text-green-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'LOW':
        return 'bg-orange-100 text-orange-800';
      case 'NONE':
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-purple-600 text-white p-4 flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-2">Pair Cheque with Transaction</h2>
            <div className="text-sm opacity-90">
              <div className="font-semibold">{scheduledCheque.merchant}</div>
              <div>
                {scheduledCheque.amount} {scheduledCheque.currency} • Due {new Date(scheduledCheque.dueDate).toLocaleDateString()}
                {scheduledCheque.chequeNumber && ` • Cheque #${scheduledCheque.chequeNumber}`}
              </div>
              {chequeAccount && (
                <div className="text-xs opacity-75 mt-1">Account: {chequeAccount.name}</div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-purple-700 rounded-full p-1 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Summary Stats */}
        {candidates.length > 0 && (
          <div className="bg-gray-50 p-3 border-b border-gray-200">
            <div className="flex gap-4 text-sm">
              <div className="text-gray-700">
                <span className="font-semibold">{summary.total}</span> candidates
              </div>
              {summary.high > 0 && (
                <div className="text-green-700">
                  <span className="font-semibold">{summary.high}</span> high confidence
                </div>
              )}
              {summary.medium > 0 && (
                <div className="text-yellow-700">
                  <span className="font-semibold">{summary.medium}</span> medium
                </div>
              )}
              {summary.low > 0 && (
                <div className="text-orange-700">
                  <span className="font-semibold">{summary.low}</span> low
                </div>
              )}
            </div>
          </div>
        )}

        {/* Candidates List */}
        <div className="flex-1 overflow-y-auto p-4">
          {candidates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
              <p className="font-semibold">No matching transactions found</p>
              <p className="text-sm mt-2">
                Try adjusting the date range or check if the transaction has already been paired.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {candidates.map((candidate, index) => {
                const isSelected = selectedCandidate?.transaction.id === candidate.transaction.id;
                const confidenceLevel = getConfidenceLevel(candidate.relevanceScore);
                const account = accounts.find(a => a.id === candidate.transaction.accountId);

                return (
                  <div
                    key={candidate.transaction.id}
                    onClick={() => handleSelectCandidate(candidate)}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50 shadow-md'
                        : `border-gray-200 ${getConfidenceColor(candidate.relevanceScore)} hover:shadow-md`
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {candidate.transaction.merchant}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          <Calendar size={14} className="inline mr-1" />
                          {new Date(candidate.transaction.date).toLocaleDateString()}
                          <span className="mx-2">•</span>
                          {candidate.transaction.category}
                        </div>
                        {account && (
                          <div className="text-xs text-gray-500 mt-1">
                            {account.name}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">
                          {candidate.transaction.amount.toFixed(2)} {candidate.transaction.currency}
                        </div>
                        <div className={`text-xs font-semibold px-2 py-1 rounded mt-1 ${getConfidenceBadgeColor(candidate.relevanceScore)}`}>
                          {confidenceLevel} ({candidate.relevanceScore})
                        </div>
                      </div>
                    </div>

                    {/* Matching Reasons */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {candidate.reasons.map((reason, i) => (
                        <span
                          key={i}
                          className="text-xs bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>

                    {/* Selection Indicator */}
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-purple-200 flex items-center gap-2 text-purple-700">
                        <CheckCircle2 size={16} />
                        <span className="text-sm font-semibold">Selected for pairing</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          {selectedCandidate ? (
            <div className="space-y-3">
              {!confirming ? (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="text-blue-600 mt-0.5 shrink-0" />
                      <div className="text-blue-900">
                        <div className="font-semibold mb-1">Confirm Pairing</div>
                        <div>
                          This will mark the cheque as PAID and link it to the transaction "{selectedCandidate.transaction.merchant}".
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirming(true)}
                      className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-600 transition-colors"
                    >
                      Review & Confirm
                    </button>
                    <button
                      onClick={() => setSelectedCandidate(null)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Cancel Selection
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="text-yellow-600 mt-0.5 shrink-0" />
                      <div className="text-yellow-900">
                        <div className="font-semibold mb-1">Are you sure?</div>
                        <div>
                          Pairing cheque <strong>#{scheduledCheque.chequeNumber || 'N/A'}</strong> ({scheduledCheque.amount} {scheduledCheque.currency})
                          with transaction <strong>"{selectedCandidate.transaction.merchant}"</strong> ({selectedCandidate.transaction.amount.toFixed(2)} {selectedCandidate.transaction.currency}).
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleConfirmPairing}
                      className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors"
                    >
                      Confirm Pairing
                    </button>
                    <button
                      onClick={() => setConfirming(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Go Back
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 text-sm py-2">
              Select a transaction above to pair with this cheque
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManualChequePairingModal;
