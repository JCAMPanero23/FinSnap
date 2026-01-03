import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { InsufficientFundsWarning as Warning } from '../services/insufficientFundsService';

interface InsufficientFundsWarningProps {
  warnings: Warning[];
  onDismiss?: (accountId: string) => void;
  compact?: boolean;
}

const InsufficientFundsWarning: React.FC<InsufficientFundsWarningProps> = ({
  warnings,
  onDismiss,
  compact = false,
}) => {
  if (warnings.length === 0) return null;

  if (compact) {
    // Compact badge for header/navigation
    return (
      <div className="flex items-center gap-2 bg-orange-100 text-orange-800 px-3 py-2 rounded-lg text-sm font-semibold">
        <AlertTriangle size={16} />
        <span>{warnings.length} Low Fund Alert{warnings.length > 1 ? 's' : ''}</span>
      </div>
    );
  }

  // Full warning cards
  return (
    <div className="space-y-3">
      {warnings.map((warning) => (
        <div
          key={warning.accountId}
          className="bg-orange-50 border-l-4 border-orange-500 rounded-lg p-4 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="flex-shrink-0 w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                <AlertTriangle size={20} className="text-white" />
              </div>

              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-1">
                  Insufficient Funds Warning
                </h3>

                <div className="space-y-2">
                  <div className="text-sm text-gray-700">
                    <span className="font-semibold">{warning.accountName}</span> may not have enough funds
                    for upcoming obligations.
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-white rounded px-3 py-2">
                      <div className="text-xs text-gray-600">Current Balance</div>
                      <div className="font-bold text-gray-900">{warning.currentBalance.toFixed(2)}</div>
                    </div>

                    <div className="bg-white rounded px-3 py-2">
                      <div className="text-xs text-gray-600">Upcoming Obligations</div>
                      <div className="font-bold text-orange-700">{warning.upcomingObligations.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="bg-red-100 border border-red-300 rounded px-3 py-2">
                    <div className="text-xs text-red-600 font-semibold">SHORTAGE</div>
                    <div className="text-lg font-bold text-red-700">{warning.shortage.toFixed(2)}</div>
                  </div>

                  <div className="text-xs text-gray-600">
                    <strong>{warning.affectedCheques.length}</strong> upcoming payment{warning.affectedCheques.length > 1 ? 's' : ''}
                    {warning.daysUntilFirst > 0 && (
                      <span className="ml-1">
                        • First due in <strong>{warning.daysUntilFirst}</strong> day{warning.daysUntilFirst > 1 ? 's' : ''}
                      </span>
                    )}
                    {warning.daysUntilFirst === 0 && (
                      <span className="ml-1 text-red-600 font-semibold">• Due TODAY!</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {onDismiss && (
              <button
                onClick={() => onDismiss(warning.accountId)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 ml-2"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default InsufficientFundsWarning;
