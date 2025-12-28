// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Toast, ToastStore } from './toastTypes';

const MAX_VISIBLE_TOASTS = 5;

let listeners: Set<(toasts: Toast[]) => void> = new Set();
let toasts: Toast[] = [];
let nextId = 0;

function notifyListeners() {
  listeners.forEach((listener) => listener(toasts));
}

export const toastStore: ToastStore = {
  get toasts() {
    return toasts;
  },

  add(toast) {
    const id = `toast-${nextId++}`;
    const newToast: Toast = {
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

export function subscribeToToasts(listener: (toasts: Toast[]) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
