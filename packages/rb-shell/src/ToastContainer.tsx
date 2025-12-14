// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { useToastStore } from './toastStore';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
      }}
      data-testid="toast-container"
    >
      {toasts.map((toast) => {
        const bgColor =
          toast.type === 'success'
            ? 'rgba(34, 197, 94, 0.95)'
            : toast.type === 'warning'
            ? 'rgba(251, 146, 60, 0.95)'
            : toast.type === 'error'
            ? 'rgba(239, 68, 68, 0.95)'
            : 'rgba(59, 130, 246, 0.95)'; // info

        return (
          <div
            key={toast.id}
            data-testid={`toast-${toast.type}`}
            style={{
              background: bgColor,
              color: 'white',
              padding: '12px 16px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              minWidth: '250px',
              maxWidth: '400px',
              pointerEvents: 'auto',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              animation: 'slideIn 0.3s ease-out',
            }}
            onClick={() => removeToast(toast.id)}
          >
            {toast.message}
          </div>
        );
      })}

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
