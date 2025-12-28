// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Portal } from '../Portal';
import { createFocusTrap } from '../focusTrap';

export interface ModalProps {
  /** Controls modal visibility */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Optional title displayed in header */
  title?: ReactNode;
  /** Modal content */
  children: ReactNode;
  /** Optional footer content (typically action buttons) */
  footer?: ReactNode;
  /** Modal size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Modal position variant */
  variant?: 'center' | 'bottom-right';
  /** Optional ref to element that should receive initial focus */
  initialFocusRef?: RefObject<HTMLElement>;
  /** Whether clicking backdrop closes modal (default: true) */
  closeOnBackdrop?: boolean;
  /** Whether Escape key closes modal (default: true) */
  closeOnEsc?: boolean;
}

const MODAL_Z_INDEX = 10000;

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  variant = 'center',
  initialFocusRef,
  closeOnBackdrop = true,
  closeOnEsc = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Handle body scroll lock for center modals
  useEffect(() => {
    if (isOpen && variant === 'center') {
      previousActiveElementRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, variant]);

  // Focus management and trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    // Set initial focus
    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
    } else {
      modalRef.current.focus();
    }

    // Create focus trap
    const cleanup = createFocusTrap(modalRef.current, {
      onEscape: closeOnEsc ? onClose : undefined,
    });

    // Restore focus on unmount
    return () => {
      cleanup();
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, closeOnEsc, onClose, initialFocusRef]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  const variantClasses = {
    center: 'items-center justify-center',
    'bottom-right': 'items-end justify-end p-8',
  };

  return (
    <Portal>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 flex ${variantClasses[variant]}`}
        style={{
          zIndex: MODAL_Z_INDEX,
          backgroundColor: variant === 'center' ? 'rgba(0, 0, 0, 0.5)' : 'transparent',
        }}
        onClick={handleBackdropClick}
        aria-modal="true"
        role="dialog"
      >
        {/* Modal Panel */}
        <div
          ref={modalRef}
          tabIndex={-1}
          className={`
            bg-slate-800 border border-slate-700 rounded-lg shadow-xl
            ${variant === 'center' ? `${sizeClasses[size]} w-full mx-4` : 'max-w-sm'}
            ${variant === 'bottom-right' ? 'transform transition-all duration-300 ease-out' : ''}
          `}
          style={{
            outline: 'none',
            ...(variant === 'bottom-right' && {
              boxShadow: '0 8px 32px rgba(0, 217, 255, 0.2)',
            }),
          }}
        >
          {/* Header */}
          {title && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <div className="text-lg font-semibold text-gray-100">{title}</div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                aria-label="Close modal"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 6L14 14M14 6L6 14" />
                </svg>
              </button>
            </div>
          )}

          {/* Body */}
          <div className={`${title || footer ? 'px-6 py-4' : 'p-6'}`}>{children}</div>

          {/* Footer */}
          {footer && <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}
