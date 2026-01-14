// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Recovery banner for abnormal shutdowns

import React from 'react';
import { loadSnapshot, clearFatalMarkers } from '../utils/snapshotSystem';

interface RecoveryBannerProps {
  onRecover: () => void;
  onStartFresh: () => void;
}

export const RecoveryBanner: React.FC<RecoveryBannerProps> = ({ onRecover, onStartFresh }) => {
  const [showDetails, setShowDetails] = React.useState(false);
  const snapshot = loadSnapshot();

  return (
    <div
      className="bg-yellow-900 text-yellow-50 px-4 py-3 border-b border-yellow-700"
      data-testid="recovery-banner"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <div className="font-semibold text-sm">
              RedByte didn't close cleanly last time.
            </div>
            <div className="text-xs text-yellow-200 mt-0.5">
              {snapshot ? 'Recover last session?' : 'No snapshot available.'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {snapshot && (
            <button
              onClick={() => {
                onRecover();
                clearFatalMarkers();
              }}
              className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-xs font-semibold transition-all"
              data-testid="recovery-recover-button"
            >
              Recover
            </button>
          )}
          <button
            onClick={() => {
              onStartFresh();
              clearFatalMarkers();
            }}
            className="px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 text-white rounded text-xs font-semibold transition-all"
            data-testid="recovery-start-fresh-button"
          >
            Start Fresh
          </button>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-3 py-1.5 bg-yellow-800 hover:bg-yellow-700 text-white rounded text-xs transition-all"
            data-testid="recovery-details-button"
          >
            {showDetails ? 'Hide Details' : 'Details'}
          </button>
        </div>
      </div>

      {showDetails && snapshot && (
        <div className="mt-3 pt-3 border-t border-yellow-700 text-xs text-yellow-100 font-mono">
          <div><strong>Timestamp:</strong> {new Date(snapshot.timestamp).toLocaleString()}</div>
          <div><strong>Reason:</strong> {snapshot.reason}</div>
          <div><strong>Schema:</strong> v{snapshot.schemaVersion}</div>
          <div><strong>Safe Mode:</strong> {snapshot.payload.flags.safeMode ? 'Yes' : 'No'}</div>
        </div>
      )}
    </div>
  );
};
