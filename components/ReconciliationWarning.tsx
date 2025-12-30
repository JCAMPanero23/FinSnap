import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Account, Transaction } from '../types';
import { ReconciliationResult } from '../services/reconciliationService';

interface ReconciliationWarningProps {
  account: Account;
  result: ReconciliationResult;
  onAcceptCalculated: () => void;
  onManualAdjust: () => void;
  onReviewTransactions: () => void;
  onDismiss: () => void;
}

const ReconciliationWarning: React.FC<ReconciliationWarningProps> = ({
  account,
  result,
  onAcceptCalculated,
  onManualAdjust,
  onReviewTransactions,
  onDismiss,
}) => {
  const { currentBalance, expectedBalance, difference, lastSnapshot, severity } = result;

  // Severity colors
  const severityColors = {
    minor: 'bg-yellow-50 border-yellow-300 text-yellow-800',
    major: 'bg-orange-50 border-orange-300 text-orange-800',
    critical: 'bg-red-50 border-red-300 text-red-800',
    none: 'bg-gray-50 border-gray-300 text-gray-800',
  };

  const severityIcons = {
    minor: '⚠️',
    major: '⚠️',
    critical: '🚨',
    none: 'ℹ️',
  };

  return (
    <div className={`border-2 rounded-lg p-4 ${severityColors[severity]}`}>
      <div className="flex items-start gap-3">
        <div className="text-2xl">{severityIcons[severity]}</div>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <h3 className="font-bold text-lg">Balance Mismatch Detected</h3>
            {severity === 'minor' && (
              <button onClick={onDismiss} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            )}
          </div>

          <div className="mt-2 space-y-2">
            <div>
              <div className="font-semibold">Account: {account.name}</div>
              {account.last4Digits && (
                <div className="text-sm">({account.last4Digits})</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium">Current Balance:</div>
                <div className="text-lg font-bold">
                  {currentBalance.toFixed(2)} {account.currency}
                </div>
              </div>
              <div>
                <div className="font-medium">Expected Balance:</div>
                <div className="text-lg font-bold">
                  {expectedBalance.toFixed(2)} {account.currency}
                </div>
              </div>
            </div>

            <div className="bg-white bg-opacity-50 rounded p-2">
              <div className="font-semibold">
                {severity === 'critical' ? '🚨' : '⚠️'} Difference: {difference.toFixed(2)} {account.currency}
              </div>
              {lastSnapshot && (
                <div className="text-sm mt-1">
                  Last verified: {new Date(lastSnapshot.date).toLocaleDateString()}
                </div>
              )}
            </div>

            <div className="text-sm">
              <div className="font-medium mb-1">Possible Causes:</div>
              <ul className="list-disc list-inside space-y-1">
                <li>Missing transaction since {lastSnapshot ? new Date(lastSnapshot.date).toLocaleDateString() : 'last update'}</li>
                <li>Edited or deleted transaction</li>
                <li>Bank fee not recorded</li>
                <li>Manual balance adjustment needed</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={onReviewTransactions}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Review Transactions
            </button>
            <button
              onClick={onAcceptCalculated}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
            >
              Accept Calculated ({expectedBalance.toFixed(2)})
            </button>
            <button
              onClick={onManualAdjust}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
            >
              Manually Adjust Balance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReconciliationWarning;
