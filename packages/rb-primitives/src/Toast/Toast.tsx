// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useState, useRef } from 'react';
import type { Toast as ToastType } from './toastTypes';

export interface ToastProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

const kindStyles = {
  success: {
    bg: 'bg-emerald-900/90',
    border: 'border-emerald-500',
    icon: '✓',
    iconColor: 'text-emerald-400',
  },
  info: {
    bg: 'bg-cyan-900/90',
    border: 'border-cyan-500',
    icon: 'ℹ',
    iconColor: 'text-cyan-400',
  },
  warning: {
    bg: 'bg-amber-900/90',
    border: 'border-amber-500',
    icon: '⚠',
    iconColor: 'text-amber-400',
  },
  error: {
    bg: 'bg-red-900/90',
    border: 'border-red-500',
    icon: '✕',
    iconColor: 'text-red-400',
  },
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(toast.duration || 0);

  const style = kindStyles[toast.kind];

  useEffect(() => {
    if (!toast.duration) return;

    const scheduleRemoval = () => {
      timeoutRef.current = setTimeout(() => {
        handleDismiss();
      }, remainingTimeRef.current);
    };

    if (!isPaused) {
      startTimeRef.current = Date.now();
      scheduleRemoval();
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isPaused, toast.duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 300); // Match animation duration
  };

  return (
    <div
      className={`
        ${style.bg} ${style.border}
        border rounded-lg shadow-lg p-4 min-w-[320px] max-w-md
        transition-all duration-300 ease-out
        ${isExiting ? 'opacity-0 transform translate-x-8' : 'opacity-100 transform translate-x-0'}
      `}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="alert"
      aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`${style.iconColor} text-xl font-bold flex-shrink-0`}>{style.icon}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {toast.title && <div className="font-semibold text-gray-100 mb-1">{toast.title}</div>}
          <div className="text-sm text-gray-300">{toast.message}</div>

          {/* Actions */}
          {toast.actions && toast.actions.length > 0 && (
            <div className="flex gap-2 mt-3">
              {toast.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    action.onClick();
                    handleDismiss();
                  }}
                  className="text-xs font-medium px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-white/50 rounded p-1"
          aria-label="Dismiss notification"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4L12 12M12 4L4 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
