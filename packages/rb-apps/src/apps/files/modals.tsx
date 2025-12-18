// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useRef, useState } from 'react';
import type { FileActionTarget } from './fileActionTargets';
import { useFileAssociationsStore } from '../../stores/fileAssociationsStore';

interface TextInputModalProps {
  title: string;
  label: string;
  value: string;
  error: string | null;
  onValueChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
}

export const TextInputModal: React.FC<TextInputModalProps> = ({
  title,
  label,
  value,
  error,
  onValueChange,
  onConfirm,
  onCancel,
  confirmDisabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    } else if (event.key === 'Enter' && !confirmDisabled) {
      event.preventDefault();
      onConfirm();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-96 p-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>

        <div className="mb-4">
          <label className="block text-sm text-slate-300 mb-2">{label}</label>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-cyan-500"
          />
          {error && (
            <p className="text-red-400 text-sm mt-2">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="px-4 py-2 text-sm rounded bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}) => {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      onConfirm();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-96 p-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>

        <p className="text-slate-300 text-sm mb-6">{message}</p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

interface OpenWithModalProps {
  targets: FileActionTarget[];
  resourceType: 'file' | 'folder';
  extension: string; // File extension (e.g., "rblogic", "txt")
  onSelect: (target: FileActionTarget) => void;
  onCancel: () => void;
}

export const OpenWithModal: React.FC<OpenWithModalProps> = ({
  targets,
  resourceType,
  extension,
  onSelect,
  onCancel,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { getDefaultTarget, setDefaultTarget, clearDefaultTarget } = useFileAssociationsStore();

  // Get current default target for this file type
  const defaultTargetId = getDefaultTarget(resourceType, extension);

  useEffect(() => {
    // Clamp selection if targets change
    if (selectedIndex >= targets.length) {
      setSelectedIndex(Math.max(0, targets.length - 1));
    }
  }, [targets.length, selectedIndex]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Guard: ignore if event target is input/textarea (for future search functionality)
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (targets[selectedIndex]) {
        onSelect(targets[selectedIndex]);
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, targets.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'D' && event.shiftKey) {
      // Shift+D: Clear default
      event.preventDefault();
      clearDefaultTarget(resourceType, extension);
      // Don't close modal (user can still select a target)
    } else if (event.key === 'd' && !event.shiftKey) {
      // D: Set default (case-insensitive, check lowercase)
      event.preventDefault();
      const selectedTarget = targets[selectedIndex];
      if (selectedTarget) {
        setDefaultTarget(resourceType, extension, selectedTarget.id);
        // Close modal and open with this target (same as Enter)
        onSelect(selectedTarget);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-96 p-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <h3 className="text-lg font-semibold text-white mb-4">Open With...</h3>

        {targets.length === 0 ? (
          <p className="text-slate-400 text-sm mb-4">No available targets</p>
        ) : (
          <div className="mb-4 max-h-64 overflow-y-auto">
            {targets.map((target, index) => {
              const isDefault = target.id === defaultTargetId;
              return (
                <button
                  key={target.id}
                  onClick={() => onSelect(target)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    index === selectedIndex
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {target.name}
                  {isDefault && (
                    <span className="ml-2 text-xs font-semibold opacity-70">[DEFAULT]</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="mt-3 text-xs text-slate-500 text-center">
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">D</kbd> Set Default{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Shift+D</kbd> Clear Default{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Enter</kbd> Open{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd> Cancel
        </div>
      </div>
    </div>
  );
};
