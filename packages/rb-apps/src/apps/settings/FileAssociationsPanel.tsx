// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useRef, useEffect } from 'react';
import { useFileAssociationsStore, type AssociationEntry } from '../../stores/fileAssociationsStore';
import { FILE_ACTION_TARGETS } from '../files/fileActionTargets';

interface FileAssociationsPanelProps {
  onShowToast?: (message: string) => void;
}

type ModalType = 'target-picker' | 'reset-confirm' | 'export' | 'import';

interface ModalState {
  type: ModalType;
  extension?: string;
  resourceType?: 'file' | 'folder';
}

export const FileAssociationsPanel: React.FC<FileAssociationsPanelProps> = ({ onShowToast }) => {
  const { listAssociations, setDefaultTarget, clearDefaultTarget, resetAll, exportJson, importJson } =
    useFileAssociationsStore();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [targetPickerIndex, setTargetPickerIndex] = useState(0);
  const [importValue, setImportValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const associations = listAssociations();

  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, associations.length - 1)));
  }, [associations.length]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Guard: ignore if typing in input/textarea
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

    if (modal) return; // Modals handle their own keys

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, associations.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'Enter' && associations.length > 0) {
      event.preventDefault();
      const selected = associations[selectedIndex];
      setModal({ type: 'target-picker', extension: selected.extension, resourceType: selected.resourceType });
      setTargetPickerIndex(0);
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && associations.length > 0) {
      event.preventDefault();
      const selected = associations[selectedIndex];
      clearDefaultTarget(selected.resourceType, selected.extension);
    } else if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      setModal({ type: 'reset-confirm' });
    } else if (event.key === 'e' || event.key === 'E') {
      event.preventDefault();
      setModal({ type: 'export' });
    } else if (event.key === 'i' || event.key === 'I') {
      event.preventDefault();
      setModal({ type: 'import' });
      setImportValue('');
    }
  };

  const handleModalKeyDown = (event: React.KeyboardEvent, modalType: ModalType) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setModal(null);
      containerRef.current?.focus();
    } else if (modalType === 'target-picker') {
      const eligible = getEligibleTargets(modal!.extension!, modal!.resourceType!);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setTargetPickerIndex((prev) => Math.min(prev + 1, eligible.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setTargetPickerIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.key === 'Enter' && eligible.length > 0) {
        event.preventDefault();
        const selected = eligible[targetPickerIndex];
        setDefaultTarget(modal!.resourceType!, modal!.extension!, selected.id);
        setModal(null);
        containerRef.current?.focus();
      }
    } else if (modalType === 'reset-confirm') {
      if (event.key === 'Enter') {
        event.preventDefault();
        resetAll();
        setModal(null);
        setSelectedIndex(0);
        containerRef.current?.focus();
      }
    } else if (modalType === 'import') {
      // Guard: only handle Enter when not typing
      const target = event.target as HTMLElement;
      if (target.tagName === 'TEXTAREA') return;

      if (event.key === 'Enter') {
        event.preventDefault();
        const result = importJson(importValue);
        if (result.success) {
          if (result.unknownTargets && result.unknownTargets.length > 0) {
            onShowToast?.(`Filtered unknown apps: ${result.unknownTargets.join(', ')}`);
          }
          setModal(null);
          containerRef.current?.focus();
        } else {
          onShowToast?.('Invalid JSON format');
        }
      }
    }
  };

  const getEligibleTargets = (extension: string, resourceType: 'file' | 'folder') => {
    // Simulate filename with extension to test eligibility
    const testName = `test.${extension}`;
    return FILE_ACTION_TARGETS.filter((target) => target.isEligible(resourceType, testName));
  };

  const getTargetName = (targetId: string): string => {
    const target = FILE_ACTION_TARGETS.find((t) => t.id === targetId);
    return target ? target.name : targetId;
  };

  return (
    <div ref={containerRef} tabIndex={0} onKeyDown={handleKeyDown} className="h-full flex flex-col" style={{ outline: 'none' }}>
      {/* Associations list */}
      <div className="flex-1 overflow-y-auto p-4">
        {associations.length === 0 ? (
          <p className="text-slate-400 text-sm">No file associations configured</p>
        ) : (
          <div className="space-y-2">
            {associations.map((assoc, index) => (
              <div
                key={`${assoc.resourceType}-${assoc.extension}`}
                className={`p-3 rounded ${
                  index === selectedIndex ? 'bg-slate-800 ring-1 ring-cyan-400' : 'bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-sm text-cyan-300">.{assoc.extension}</span>
                    <span className="text-xs text-slate-500 ml-2">({assoc.resourceType})</span>
                  </div>
                  <div className="text-sm text-slate-300">
                    {getTargetName(assoc.targetId)}
                    <span className="ml-2 text-xs text-slate-500">[DEFAULT]</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800 text-xs text-slate-500 text-center space-y-1">
        <div>
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Enter</kbd> Edit{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Del</kbd> Clear{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">R</kbd> Reset All
        </div>
        <div>
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">E</kbd> Export{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">I</kbd> Import
        </div>
      </div>

      {/* Modals */}
      {modal && modal.type === 'target-picker' && modal.extension && modal.resourceType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div
            className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-96 p-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => handleModalKeyDown(e, 'target-picker')}
            tabIndex={0}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Select Default Target</h3>
            <p className="text-sm text-slate-400 mb-4">For .{modal.extension} files:</p>

            {(() => {
              const eligible = getEligibleTargets(modal.extension, modal.resourceType);
              return eligible.length === 0 ? (
                <p className="text-slate-400 text-sm">No available targets</p>
              ) : (
                <div className="mb-4 max-h-64 overflow-y-auto">
                  {eligible.map((target, index) => (
                    <button
                      key={target.id}
                      onClick={() => {
                        setDefaultTarget(modal.resourceType!, modal.extension!, target.id);
                        setModal(null);
                        containerRef.current?.focus();
                      }}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        index === targetPickerIndex ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {target.name}
                    </button>
                  ))}
                </div>
              );
            })()}

            <div className="mt-3 text-xs text-slate-500 text-center">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">↑↓</kbd> Navigate{' '}
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Enter</kbd> Select{' '}
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd> Cancel
            </div>
          </div>
        </div>
      )}

      {modal && modal.type === 'reset-confirm' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div
            className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-96 p-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => handleModalKeyDown(e, 'reset-confirm')}
            tabIndex={0}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Reset All Associations?</h3>
            <p className="text-slate-300 text-sm mb-6">This will clear all default targets for all file types.</p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700 text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  resetAll();
                  setModal(null);
                  setSelectedIndex(0);
                  containerRef.current?.focus();
                }}
                className="px-4 py-2 text-sm rounded bg-red-600 hover:bg-red-500 text-white"
              >
                Reset All
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-500 text-center">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Enter</kbd> Confirm{' '}
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd> Cancel
            </div>
          </div>
        </div>
      )}

      {modal && modal.type === 'export' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div
            className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-96 p-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => handleModalKeyDown(e, 'export')}
            tabIndex={0}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Export File Associations</h3>
            <p className="text-sm text-slate-400 mb-4">Copy JSON below to save file associations:</p>

            <textarea
              readOnly
              value={exportJson()}
              className="w-full p-3 font-mono text-xs bg-slate-800 border border-slate-600 rounded text-white h-48"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />

            <div className="mt-3 text-xs text-slate-500 text-center">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd> Close
            </div>
          </div>
        </div>
      )}

      {modal && modal.type === 'import' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div
            className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-96 p-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => handleModalKeyDown(e, 'import')}
            tabIndex={0}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Import File Associations</h3>
            <p className="text-sm text-slate-400 mb-4">Paste JSON to import file associations:</p>

            <textarea
              value={importValue}
              onChange={(e) => setImportValue(e.target.value)}
              placeholder='{"associations":{"file":{"txt":"text-viewer"}}}'
              className="w-full p-3 font-mono text-xs bg-slate-800 border border-slate-600 rounded text-white h-48"
              autoFocus
            />

            <div className="mt-3 text-xs text-slate-500 text-center">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Enter</kbd> Apply{' '}
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd> Cancel
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
