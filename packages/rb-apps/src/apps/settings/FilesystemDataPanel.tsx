// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useRef, useEffect } from 'react';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { useFileAssociationsStore } from '../../stores/fileAssociationsStore';

interface FilesystemDataPanelProps {
  onShowToast?: (message: string) => void;
}

type ModalType = 'export' | 'import' | 'reset-confirm' | 'factory-reset';

interface ModalState {
  type: ModalType;
}

export const FilesystemDataPanel: React.FC<FilesystemDataPanelProps> = ({ onShowToast }) => {
  const { exportJson, importJson, resetAll } = useFileSystemStore();

  const [modal, setModal] = useState<ModalState | null>(null);
  const [importValue, setImportValue] = useState('');
  const [factoryResetInput, setFactoryResetInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const factoryResetInputRef = useRef<HTMLInputElement>(null);

  // Autofocus factory reset input when modal opens
  useEffect(() => {
    if (modal?.type === 'factory-reset') {
      requestAnimationFrame(() => {
        factoryResetInputRef.current?.focus();
      });
    }
  }, [modal]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Guard: ignore if typing in textarea or input
    const target = event.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      return;
    }

    if (modal) return; // Modals handle their own keys

    if (event.key === 'e' || event.key === 'E') {
      event.preventDefault();
      setModal({ type: 'export' });
    } else if (event.key === 'i' || event.key === 'I') {
      event.preventDefault();
      setModal({ type: 'import' });
      setImportValue('');
    } else if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      setModal({ type: 'reset-confirm' });
    } else if (event.key === 'f' || event.key === 'F') {
      event.preventDefault();
      setModal({ type: 'factory-reset' });
      setFactoryResetInput('');
    }
  };

  const handleModalKeyDown = (event: React.KeyboardEvent, modalType: ModalType) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setModal(null);
      requestAnimationFrame(() => {
        containerRef.current?.focus();
      });
    } else if (modalType === 'import') {
      // Guard: only handle Enter when not typing in textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'TEXTAREA') return;

      if (event.key === 'Enter') {
        event.preventDefault();
        try {
          importJson(importValue);
          onShowToast?.('Filesystem imported successfully');
          setModal(null);
          requestAnimationFrame(() => {
            containerRef.current?.focus();
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          onShowToast?.(`Import failed: ${message}`);
        }
      }
    } else if (modalType === 'reset-confirm') {
      if (event.key === 'Enter') {
        event.preventDefault();
        resetAll();
        onShowToast?.('Filesystem reset to default');
        setModal(null);
        requestAnimationFrame(() => {
          containerRef.current?.focus();
        });
      }
    } else if (modalType === 'factory-reset') {
      // Guard: only handle Enter when not typing in input
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT') return;

      if (event.key === 'Enter' && factoryResetInput === 'RESET') {
        event.preventDefault();
        handleFactoryReset();
      }
    }
  };

  const handleFactoryReset = () => {
    try {
      // Reset in deterministic order
      useFileAssociationsStore.getState().resetAll();
      useFileSystemStore.getState().resetAll();

      // Explicitly clear localStorage keys (stores may persist empty objects)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('rb:file-associations');
        localStorage.removeItem('rb:file-system');
        localStorage.removeItem('rb:window-layout');
      }

      // Verify all keys cleared
      if (typeof window !== 'undefined') {
        const fsKey = localStorage.getItem('rb:file-system');
        const assocKey = localStorage.getItem('rb:file-associations');
        const layoutKey = localStorage.getItem('rb:window-layout');
        if (fsKey || assocKey || layoutKey) {
          throw new Error('Factory reset incomplete - localStorage keys not cleared');
        }
      }

      onShowToast?.('Factory reset complete - all data cleared');
      setModal(null);
      requestAnimationFrame(() => {
        containerRef.current?.focus();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      onShowToast?.(`Factory reset failed: ${message}`);
    }
  };

  return (
    <div ref={containerRef} tabIndex={0} onKeyDown={handleKeyDown} className="h-full flex flex-col" style={{ outline: 'none' }}>
      {/* Info section */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Filesystem Persistence</h3>
            <p className="text-xs text-slate-400 mb-4">
              Your filesystem state is automatically persisted to browser storage. Use the actions below to export, import, or reset your filesystem data.
            </p>
          </div>

          <div className="bg-slate-900 rounded p-4 space-y-3">
            <div className="flex items-start gap-3">
              <kbd className="px-2 py-1 bg-slate-800 rounded text-cyan-400 font-mono text-xs shrink-0">E</kbd>
              <div>
                <div className="text-sm font-medium text-white">Export Filesystem</div>
                <div className="text-xs text-slate-400 mt-1">View canonical JSON snapshot of your filesystem state</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <kbd className="px-2 py-1 bg-slate-800 rounded text-cyan-400 font-mono text-xs shrink-0">I</kbd>
              <div>
                <div className="text-sm font-medium text-white">Import Filesystem</div>
                <div className="text-xs text-slate-400 mt-1">Restore filesystem from JSON snapshot</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <kbd className="px-2 py-1 bg-slate-800 rounded text-red-400 font-mono text-xs shrink-0">R</kbd>
              <div>
                <div className="text-sm font-medium text-white">Reset Filesystem</div>
                <div className="text-xs text-slate-400 mt-1">Clear all data and restore default filesystem</div>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3 mt-3 flex items-start gap-3">
              <kbd className="px-2 py-1 bg-slate-800 rounded text-red-600 font-mono text-xs shrink-0">F</kbd>
              <div>
                <div className="text-sm font-medium text-white">Factory Reset</div>
                <div className="text-xs text-slate-400 mt-1">Clear ALL data: filesystem + file associations (requires typing RESET)</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-yellow-900/30 rounded p-3">
            <div className="text-xs text-yellow-400/90">
              <strong>Warning:</strong> Import and Reset operations will replace your current filesystem. Factory Reset will permanently delete all files, folders, and file associations. Export your data first to create a backup.
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800 text-xs text-slate-500 text-center space-y-1">
        <div>
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">E</kbd> Export{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">I</kbd> Import{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">R</kbd> Reset
        </div>
        <div>
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-red-400">F</kbd> Factory Reset (filesystem + associations)
        </div>
      </div>

      {/* Export Modal */}
      {modal && modal.type === 'export' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div
            className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-[600px] p-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => handleModalKeyDown(e, 'export')}
            tabIndex={0}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Export Filesystem</h3>
            <p className="text-sm text-slate-400 mb-4">Copy JSON below to save your filesystem state:</p>

            <textarea
              readOnly
              value={exportJson()}
              className="w-full p-3 font-mono text-xs bg-slate-800 border border-slate-600 rounded text-white h-96"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />

            <div className="mt-3 text-xs text-slate-500 text-center">
              Click to select all · <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd> Close
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {modal && modal.type === 'import' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div
            className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-[600px] p-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => handleModalKeyDown(e, 'import')}
            tabIndex={0}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Import Filesystem</h3>
            <p className="text-sm text-slate-400 mb-4">Paste JSON to restore your filesystem state:</p>

            <textarea
              value={importValue}
              onChange={(e) => setImportValue(e.target.value)}
              placeholder='{"version":1,"state":{"folders":{...},"roots":[...],"nextId":...}}'
              className="w-full p-3 font-mono text-xs bg-slate-800 border border-slate-600 rounded text-white h-96"
              autoFocus
            />

            <div className="mt-3 text-xs text-slate-500 text-center">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Enter</kbd> Apply{' '}
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd> Cancel
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {modal && modal.type === 'reset-confirm' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div
            className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-96 p-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => handleModalKeyDown(e, 'reset-confirm')}
            tabIndex={0}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Reset Filesystem?</h3>
            <p className="text-slate-300 text-sm mb-6">
              This will clear all your files and folders and restore the default filesystem. This action cannot be undone.
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
                onClick={() => {
                  resetAll();
                  onShowToast?.('Filesystem reset to default');
                  setModal(null);
                  requestAnimationFrame(() => {
                    containerRef.current?.focus();
                  });
                }}
                className="px-4 py-2 text-sm rounded bg-red-600 hover:bg-red-500 text-white"
              >
                Reset Filesystem
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-500 text-center">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Enter</kbd> Confirm{' '}
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd> Cancel
            </div>
          </div>
        </div>
      )}

      {/* Factory Reset Modal */}
      {modal && modal.type === 'factory-reset' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div
            className="bg-slate-900 border border-red-700 rounded-lg shadow-xl w-96 p-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => handleModalKeyDown(e, 'factory-reset')}
            tabIndex={0}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Factory Reset?</h3>
            <p className="text-slate-300 text-sm mb-4">
              This will permanently delete all files, folders, and file associations. This action cannot be undone.
            </p>

            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">
                Type <strong className="text-white">RESET</strong> to confirm:
              </label>
              <input
                ref={factoryResetInputRef}
                value={factoryResetInput}
                onChange={(e) => setFactoryResetInput(e.target.value)}
                placeholder="Type RESET"
                className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white"
              />
            </div>

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
                disabled={factoryResetInput !== 'RESET'}
                onClick={handleFactoryReset}
                className={`px-4 py-2 text-sm rounded text-white transition-opacity ${
                  factoryResetInput === 'RESET'
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-slate-700 opacity-50 cursor-not-allowed'
                }`}
              >
                Factory Reset
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-500 text-center">
              {factoryResetInput === 'RESET' && (
                <>
                  <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Enter</kbd> Confirm{' '}
                </>
              )}
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd> Cancel
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
