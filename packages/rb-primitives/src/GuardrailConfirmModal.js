import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useMemo } from 'react';
import { Modal } from './Modal';
export const GuardrailConfirmModal = ({ isOpen, title, message, lossItems = [], confirmLabel = 'Confirm', cancelLabel = 'Cancel', exportLabel = 'Export First', confirmTone = 'danger', onConfirm, onCancel, onExport, }) => {
    const lossList = useMemo(() => lossItems.filter(Boolean), [lossItems]);
    const confirmClass = confirmTone === 'warning'
        ? 'bg-amber-600 hover:bg-amber-500'
        : 'bg-red-600 hover:bg-red-500';
    return (_jsx(Modal, { isOpen: isOpen, onClose: onCancel, title: title, size: "md", closeOnEsc: true, closeOnBackdrop: true, footer: _jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: onCancel, className: "px-3 py-1.5 rounded text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100", children: cancelLabel }), onExport && (_jsx("button", { type: "button", onClick: onExport, className: "px-3 py-1.5 rounded text-xs font-semibold bg-cyan-700 hover:bg-cyan-600 text-white", children: exportLabel })), _jsx("button", { type: "button", onClick: onConfirm, className: `px-3 py-1.5 rounded text-xs font-semibold text-white ${confirmClass}`, children: confirmLabel })] }), children: _jsxs("div", { className: "space-y-3 text-sm", children: [_jsx("p", { className: "text-slate-200", children: message }), lossList.length > 0 && (_jsxs("div", { className: "rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2", children: [_jsx("div", { className: "text-[11px] font-semibold uppercase tracking-wide text-amber-200", children: "This action will remove:" }), _jsx("ul", { className: "mt-1 list-disc list-inside text-xs text-amber-100 space-y-1", children: lossList.map((item) => (_jsx("li", { children: item }, item))) })] })), _jsx("div", { className: "text-[11px] text-slate-400", children: "Tip: Export your work first to avoid data loss." })] }) }));
};
