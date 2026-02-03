import { jsx as _jsx } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useEffect, useState } from 'react';
import { Portal } from '../Portal';
import { Toast } from './Toast';
import { subscribeToToasts, toastStore } from './toastStore';
const TOAST_Z_INDEX = 10001; // Above modals
const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};
export function ToastContainer({ position = 'top-right' }) {
    const [toasts, setToasts] = useState([]);
    useEffect(() => {
        const unsubscribe = subscribeToToasts(setToasts);
        return unsubscribe;
    }, []);
    if (toasts.length === 0) {
        return null;
    }
    return (_jsx(Portal, { children: _jsx("div", { className: `fixed ${positionClasses[position]} flex flex-col gap-3`, style: { zIndex: TOAST_Z_INDEX, pointerEvents: 'none' }, role: "region", "aria-label": "Notifications", children: toasts.map((toast) => (_jsx(Toast, { toast: toast, onDismiss: (id) => {
                    toastStore.remove(id);
                } }, toast.id))) }) }));
}
