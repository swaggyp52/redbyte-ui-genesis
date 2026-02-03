// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { toastStore } from './toastStore';
const DEFAULT_DURATION = 6000;
const ERROR_DURATION = 10000;
export function useToast() {
    return {
        success: (options) => toastStore.add({
            kind: 'success',
            duration: options.duration ?? DEFAULT_DURATION,
            ...options,
        }),
        info: (options) => toastStore.add({
            kind: 'info',
            duration: options.duration ?? DEFAULT_DURATION,
            ...options,
        }),
        warning: (options) => toastStore.add({
            kind: 'warning',
            duration: options.duration ?? DEFAULT_DURATION,
            ...options,
        }),
        error: (options) => toastStore.add({
            kind: 'error',
            duration: options.duration ?? ERROR_DURATION,
            ...options,
        }),
        dismiss: (id) => toastStore.remove(id),
        clear: () => toastStore.clear(),
    };
}
// Export a singleton instance for imperative usage
export const toast = {
    success: (options) => toastStore.add({
        kind: 'success',
        duration: options.duration ?? DEFAULT_DURATION,
        ...options,
    }),
    info: (options) => toastStore.add({
        kind: 'info',
        duration: options.duration ?? DEFAULT_DURATION,
        ...options,
    }),
    warning: (options) => toastStore.add({
        kind: 'warning',
        duration: options.duration ?? DEFAULT_DURATION,
        ...options,
    }),
    error: (options) => toastStore.add({
        kind: 'error',
        duration: options.duration ?? ERROR_DURATION,
        ...options,
    }),
    dismiss: (id) => toastStore.remove(id),
    clear: () => toastStore.clear(),
};
