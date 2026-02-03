// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
const MAX_VISIBLE_TOASTS = 5;
let listeners = new Set();
let toasts = [];
let nextId = 0;
function notifyListeners() {
    listeners.forEach((listener) => listener(toasts));
}
export const toastStore = {
    get toasts() {
        return toasts;
    },
    add(toast) {
        const id = `toast-${nextId++}`;
        const newToast = {
            ...toast,
            id,
            createdAt: Date.now(),
        };
        toasts = [newToast, ...toasts].slice(0, MAX_VISIBLE_TOASTS);
        notifyListeners();
        // Auto-dismiss if duration is set
        if (toast.duration) {
            setTimeout(() => {
                toastStore.remove(id);
            }, toast.duration);
        }
        return id;
    },
    remove(id) {
        toasts = toasts.filter((t) => t.id !== id);
        notifyListeners();
    },
    clear() {
        toasts = [];
        notifyListeners();
    },
};
export function subscribeToToasts(listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
