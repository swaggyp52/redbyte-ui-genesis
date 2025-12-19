// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useRef, useEffect } from 'react';

interface SessionPanelProps {
  onShowToast?: (message: string) => void;
}

type ModalType = 'reset-confirm';

interface ModalState {
  type: ModalType;
}

export const SessionPanel: React.FC<SessionPanelProps> = ({ onShowToast }) => {
  const [modal, setModal] = useState<ModalState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Guard: ignore if typing in textarea or input
    const target = event.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      return;
    }

    if (modal) return; // Modals handle their own keys

    if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      setModal({ type: 'reset-confirm' });
    }
  };

  const handleModalKeyDown = (event: React.KeyboardEvent, modalType: ModalType) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setModal(null);
      requestAnimationFrame(() => {
        containerRef.current?.focus();
      });
    } else if (modalType === 'reset-confirm') {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleResetSession();
      }
    }
  };

  const handleResetSession = () => {
    try {
      // Clear window layout from localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('rb:window-layout');
      }

      // Verify key cleared
      if (typeof window !== 'undefined') {
        const layoutKey = localStorage.getItem('rb:window-layout');
        if (layoutKey) {
          throw new Error('Session reset incomplete - localStorage key not cleared');
        }
      }

      onShowToast?.('Session reset complete - window layout cleared. Reload to apply.');
      setModal(null);
      requestAnimationFrame(() => {
        containerRef.current?.focus();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      onShowToast?.(`Session reset failed: ${message}`);
    }
  };

  return (
    <div ref={containerRef} tabIndex={0} onKeyDown={handleKeyDown} className="h-full flex flex-col" style={{ outline: 'none' }}>
      {/* Info section */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Session Management</h3>
            <p className="text-xs text-slate-400 mb-4">
              Your window layout (open windows, positions, sizes, z-order) is automatically persisted to browser storage. Use the action below to reset your session layout.
            </p>
          </div>

          <div className="bg-slate-900 rounded p-4 space-y-3">
            <div className="flex items-start gap-3">
              <kbd className="px-2 py-1 bg-slate-800 rounded text-red-400 font-mono text-xs shrink-0">R</kbd>
              <div>
                <div className="text-sm font-medium text-white">Reset Session Layout</div>
                <div className="text-xs text-slate-400 mt-1">Clear all open windows and layout state (requires page reload)</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-yellow-900/30 rounded p-3">
            <div className="text-xs text-yellow-400/90">
              <strong>Note:</strong> After resetting your session layout, you must reload the page for changes to take effect. On next boot, the system will start with a clean window layout.
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800 text-xs text-slate-500 text-center">
        <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">R</kbd> Reset Session Layout
      </div>

      {/* Reset Confirmation Modal */}
      {modal && modal.type === 'reset-confirm' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div
            className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-96 p-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => handleModalKeyDown(e, 'reset-confirm')}
            tabIndex={0}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Reset Session Layout?</h3>
            <p className="text-slate-300 text-sm mb-6">
              This will clear your window layout state. All open windows will be closed on next boot, and the system will start fresh. This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setModal(null);
                  requestAnimationFrame(() => {
                    containerRef.current?.focus();
                  });
                }}
                className="px-4 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700 text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleResetSession}
                className="px-4 py-2 text-sm rounded bg-red-600 hover:bg-red-500 text-white"
              >
                Reset Session
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-500 text-center">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Enter</kbd> Confirm{' '}
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd> Cancel
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
