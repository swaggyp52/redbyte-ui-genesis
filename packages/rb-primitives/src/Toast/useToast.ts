// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { toastStore } from './toastStore';
import type { ToastOptions } from './toastTypes';

const DEFAULT_DURATION = 6000;
const ERROR_DURATION = 10000;

type ToastInput = ToastOptions | string;

function normalizeToastOptions(input: ToastInput): ToastOptions {
  return typeof input === 'string' ? { message: input } : input;
}

export interface UseToastReturn {
  success: (options: ToastInput) => string;
  info: (options: ToastInput) => string;
  warning: (options: ToastInput) => string;
  error: (options: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export function useToast(): UseToastReturn {
  return {
    success: (options) => {
      const normalized = normalizeToastOptions(options);
      return toastStore.add({
        kind: 'success',
        duration: normalized.duration ?? DEFAULT_DURATION,
        ...normalized,
      });
    },

    info: (options) => {
      const normalized = normalizeToastOptions(options);
      return toastStore.add({
        kind: 'info',
        duration: normalized.duration ?? DEFAULT_DURATION,
        ...normalized,
      });
    },

    warning: (options) => {
      const normalized = normalizeToastOptions(options);
      return toastStore.add({
        kind: 'warning',
        duration: normalized.duration ?? DEFAULT_DURATION,
        ...normalized,
      });
    },

    error: (options) => {
      const normalized = normalizeToastOptions(options);
      return toastStore.add({
        kind: 'error',
        duration: normalized.duration ?? ERROR_DURATION,
        ...normalized,
      });
    },

    dismiss: (id) => toastStore.remove(id),

    clear: () => toastStore.clear(),
  };
}

// Export a singleton instance for imperative usage
export const toast: UseToastReturn = {
  success: (options) => {
    const normalized = normalizeToastOptions(options);
    return toastStore.add({
      kind: 'success',
      duration: normalized.duration ?? DEFAULT_DURATION,
      ...normalized,
    });
  },

  info: (options) => {
    const normalized = normalizeToastOptions(options);
    return toastStore.add({
      kind: 'info',
      duration: normalized.duration ?? DEFAULT_DURATION,
      ...normalized,
    });
  },

  warning: (options) => {
    const normalized = normalizeToastOptions(options);
    return toastStore.add({
      kind: 'warning',
      duration: normalized.duration ?? DEFAULT_DURATION,
      ...normalized,
    });
  },

  error: (options) => {
    const normalized = normalizeToastOptions(options);
    return toastStore.add({
      kind: 'error',
      duration: normalized.duration ?? ERROR_DURATION,
      ...normalized,
    });
  },

  dismiss: (id) => toastStore.remove(id),

  clear: () => toastStore.clear(),
};
