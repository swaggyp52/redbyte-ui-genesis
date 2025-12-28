// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useState } from 'react';
import { Portal } from '../Portal';
import { Toast } from './Toast';
import { subscribeToToasts } from './toastStore';
import type { Toast as ToastType } from './toastTypes';

export interface ToastContainerProps {
  /** Position of toast container (default: 'top-right') */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
}

const TOAST_Z_INDEX = 10001; // Above modals

const positionClasses = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};

export function ToastContainer({ position = 'top-right' }: ToastContainerProps) {
  const [toasts, setToasts] = useState<ToastType[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToToasts(setToasts);
    return unsubscribe;
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <Portal>
      <div
        className={`fixed ${positionClasses[position]} flex flex-col gap-3`}
        style={{ zIndex: TOAST_Z_INDEX }}
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onDismiss={(id) => {
              // The toast store handles removal
              // This is called from Toast component after animation
            }}
          />
        ))}
      </div>
    </Portal>
  );
}
