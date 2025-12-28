// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { ReactNode } from 'react';

export type ToastKind = 'success' | 'info' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  duration?: number;
  actions?: ToastAction[];
  createdAt: number;
}

export interface ToastOptions {
  title?: string;
  message: string;
  duration?: number;
  actions?: ToastAction[];
}

export interface ToastStore {
  toasts: Toast[];
  add: (toast: Omit<Toast, 'id' | 'createdAt'>) => string;
  remove: (id: string) => void;
  clear: () => void;
}
