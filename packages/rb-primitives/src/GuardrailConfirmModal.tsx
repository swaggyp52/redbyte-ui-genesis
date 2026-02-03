// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo } from 'react';
import { Modal } from './Modal';

export interface GuardrailConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  lossItems?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  exportLabel?: string;
  confirmTone?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
  onExport?: () => void;
}

export const GuardrailConfirmModal: React.FC<GuardrailConfirmModalProps> = ({
  isOpen,
  title,
  message,
  lossItems = [],
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  exportLabel = 'Export First',
  confirmTone = 'danger',
  onConfirm,
  onCancel,
  onExport,
}) => {
  const lossList = useMemo(() => lossItems.filter(Boolean), [lossItems]);
  const confirmClass =
    confirmTone === 'warning'
      ? 'bg-amber-600 hover:bg-amber-500'
      : 'bg-red-600 hover:bg-red-500';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="md"
      closeOnEsc
      closeOnBackdrop
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100"
          >
            {cancelLabel}
          </button>
          {onExport && (
            <button
              type="button"
              onClick={onExport}
              className="px-3 py-1.5 rounded text-xs font-semibold bg-cyan-700 hover:bg-cyan-600 text-white"
            >
              {exportLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3 py-1.5 rounded text-xs font-semibold text-white ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-slate-200">{message}</p>
        {lossList.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-200">
              This action will remove:
            </div>
            <ul className="mt-1 list-disc list-inside text-xs text-amber-100 space-y-1">
              {lossList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="text-[11px] text-slate-400">
          Tip: Export your work first to avoid data loss.
        </div>
      </div>
    </Modal>
  );
};
