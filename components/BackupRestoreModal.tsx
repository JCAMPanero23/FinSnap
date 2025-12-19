import React, { useState, useEffect } from 'react';
import { Upload, Download, X, AlertTriangle, CheckCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  exportToCSV,
  exportReceiptsZip,
  uploadBackup,
  listBackups,
  downloadBackup,
  restoreFromBackup,
  BackupInfo,
} from '../services/backupService';

interface BackupRestoreModalProps {
  onClose: () => void;
  onRestoreComplete: () => void;
}

const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({ onClose, onRestoreComplete }) => {
  const [mode, setMode] = useState<'menu' | 'backup' | 'restore'>('menu');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);

  const session = supabase.auth.getSession();

  useEffect(() => {
    if (mode === 'restore') {
      loadBackups();
    }
  }, [mode]);

  const loadBackups = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setError('Please login to access backups');
        return;
      }

      const backupList = await listBackups(session.user.id);
      setBackups(backupList);
    } catch (err: any) {
      setError(err.message || 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setError('Please login to backup');
        return;
      }

      const csv = await exportToCSV();
      const receiptsBlob = await exportReceiptsZip();
      await uploadBackup(session.user.id, csv, receiptsBlob);

      setSuccess('Backup completed successfully!');
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Backup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;

    const confirmed = window.confirm(
      'This will REPLACE all local data with the selected backup. Current data will be lost. Continue?'
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { csv, receiptsBlob } = await downloadBackup(selectedBackup.path);
      await restoreFromBackup(csv, receiptsBlob);

      setSuccess('Restore completed! Reloading app...');
      setTimeout(() => {
        onRestoreComplete();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Restore failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">
            {mode === 'menu' && 'Backup & Restore'}
            {mode === 'backup' && 'Backup to Cloud'}
            {mode === 'restore' && 'Restore from Cloud'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {mode === 'menu' && (
            <div className="space-y-3">
              <button
                onClick={() => setMode('backup')}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition flex items-center gap-3"
              >
                <Upload className="w-6 h-6 text-teal-600" />
                <div className="text-left">
                  <div className="font-medium text-gray-800">Backup to Cloud</div>
                  <div className="text-sm text-gray-600">Export data as CSV to Supabase</div>
                </div>
              </button>

              <button
                onClick={() => setMode('restore')}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition flex items-center gap-3"
              >
                <Download className="w-6 h-6 text-blue-600" />
                <div className="text-left">
                  <div className="font-medium text-gray-800">Restore from Cloud</div>
                  <div className="text-sm text-gray-600">Download and restore a backup</div>
                </div>
              </button>
            </div>
          )}

          {mode === 'backup' && (
            <div className="space-y-4">
              <p className="text-gray-700">
                This will export all your data (transactions, accounts, categories, receipts) to Supabase Storage.
              </p>
              <button
                onClick={handleBackup}
                disabled={loading}
                className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Backing up...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Start Backup
                  </>
                )}
              </button>
            </div>
          )}

          {mode === 'restore' && (
            <div className="space-y-4">
              {loading && backups.length === 0 ? (
                <div className="text-center py-8">
                  <Loader className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                  <p className="text-gray-600 mt-2">Loading backups...</p>
                </div>
              ) : backups.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No backups found</p>
              ) : (
                <>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {backups.map((backup) => (
                      <button
                        key={backup.timestamp}
                        onClick={() => setSelectedBackup(backup)}
                        className={`w-full p-3 border-2 rounded-lg text-left transition ${
                          selectedBackup?.timestamp === backup.timestamp
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-gray-800">{backup.date}</div>
                        {backup.size && (
                          <div className="text-sm text-gray-600">
                            {(backup.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleRestore}
                    disabled={!selectedBackup || loading}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Restoring...
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        Restore Selected
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BackupRestoreModal;
