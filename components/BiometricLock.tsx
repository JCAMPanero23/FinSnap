import React, { useEffect, useState } from 'react';
import { Fingerprint, AlertCircle } from 'lucide-react';
import { authenticate, isBiometricAvailable } from '../services/biometricService';

interface BiometricLockProps {
  onUnlock: () => void;
}

const BiometricLock: React.FC<BiometricLockProps> = ({ onUnlock }) => {
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    checkAndAuthenticate();
  }, []);

  const checkAndAuthenticate = async () => {
    const available = await isBiometricAvailable();
    if (!available) {
      // No biometric available, unlock anyway
      onUnlock();
      return;
    }

    performAuth();
  };

  const performAuth = async () => {
    setIsAuthenticating(true);
    setError(null);

    const result = await authenticate();

    if (result.success) {
      onUnlock();
    } else {
      setError(result.error || 'Authentication failed');
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-6">
          <div className="w-24 h-24 mx-auto bg-teal-100 rounded-full flex items-center justify-center mb-4">
            <Fingerprint className="w-12 h-12 text-teal-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">FinSnap Locked</h1>
          <p className="text-gray-600">
            {isAuthenticating ? 'Authenticating...' : 'Use biometric to unlock'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <p className="text-sm font-medium text-red-800">Authentication Failed</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        )}

        <button
          onClick={performAuth}
          disabled={isAuthenticating}
          className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg font-medium
                   hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAuthenticating ? 'Authenticating...' : 'Retry'}
        </button>

        <p className="text-xs text-gray-500 mt-6">
          Biometric authentication protects access to your financial data
        </p>
      </div>
    </div>
  );
};

export default BiometricLock;
