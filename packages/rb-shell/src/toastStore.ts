// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Compatibility shim for old toast API
 * Wraps rb-primitives toast system with the old interface
 *
 * @deprecated Use `toast` from '@redbyte/rb-primitives' directly instead
 */

import { toast as newToast } from '@redbyte/rb-primitives';

export interface Toast {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

export interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type'], duration?: number) => void;
  removeToast: (id: string) => void;
}

/**
 * Compatibility hook that wraps the new toast API
 * @deprecated Use `useToast()` from '@redbyte/rb-primitives' instead
 */
export function useToastStore(): ToastState {
  return {
    toasts: [], // The new system doesn't expose this - consumers shouldn't need it

    addToast: (message: string, type: Toast['type'] = 'info', duration?: number) => {
      switch (type) {
        case 'success':
          newToast.success({ message, duration });
          break;
        case 'warning':
          newToast.warning({ message, duration });
          break;
        case 'error':
          newToast.error({ message, duration });
          break;
        case 'info':
        default:
          newToast.info({ message, duration });
          break;
      }
    },

    removeToast: (id: string) => {
      newToast.dismiss(id);
    },
  };
}
