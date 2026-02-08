import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useEffect, useRef } from 'react';
import { Portal } from '../Portal';
import { createFocusTrap } from '../focusTrap';
import { usePortalContainer } from '../PortalContext';
const MODAL_Z_INDEX = 10000;
export function Modal({ isOpen, onClose, title, children, footer, size = 'md', variant = 'center', width, height, initialFocusRef, closeOnBackdrop = true, closeOnEsc = true, }) {
    const modalRef = useRef(null);
    const previousActiveElementRef = useRef(null);
    const contextContainer = usePortalContainer();
    // Handle body scroll lock for center modals
    useEffect(() => {
        if (isOpen && variant === 'center') {
            previousActiveElementRef.current = document.activeElement;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = '';
            };
        }
    }, [isOpen, variant]);
    // Focus management and trap
    useEffect(() => {
        if (!isOpen || !modalRef.current)
            return;
        // Set initial focus
        if (initialFocusRef?.current) {
            initialFocusRef.current.focus();
        }
        else {
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
    const handleBackdropClick = (e) => {
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
    // If we have a context container, we are in a window-scoped OS environment.
    // We use absolute positioning and inset-0 to stay inside the window content.
    const isWindowScoped = !!contextContainer;
    const isBlockingModal = variant === 'center';
    return (_jsx(Portal, { children: _jsxs("div", { className: `${isWindowScoped ? 'absolute' : 'fixed'} inset-0 flex ${variantClasses[variant]}`, style: {
                zIndex: MODAL_Z_INDEX,
                pointerEvents: 'none',
            }, "aria-modal": "true", role: "dialog", children: [_jsx("div", { className: "absolute inset-0 transition-opacity duration-300", style: {
                        backgroundColor: variant === 'center' ? 'rgba(0, 0, 0, 0.5)' : 'transparent',
                        pointerEvents: isBlockingModal ? 'auto' : 'none',
                    }, onClick: handleBackdropClick }), _jsxs("div", { ref: modalRef, tabIndex: -1, className: `
            relative z-10 rounded-xl border
            ${variant === 'center' ? `${sizeClasses[size]} w-full mx-4` : 'max-w-sm'}
            ${variant === 'bottom-right' ? 'transform transition-all duration-300 ease-out' : ''}
          `, style: {
                        outline: 'none',
                        pointerEvents: 'auto',
                        background: 'var(--rb-metal)',
                        borderColor: 'var(--rb-border)',
                        boxShadow: variant === 'center' ? 'var(--rb-shadow-3)' : 'var(--rb-shadow-2)',
                        backdropFilter: 'blur(16px)',
                        width,
                        height,
                    }, children: [title && (_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b", style: { borderColor: 'var(--rb-border)' }, children: [_jsx("div", { className: "text-lg font-semibold", style: { color: 'var(--rb-text)' }, children: title }), _jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-200 transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500", "aria-label": "Close modal", children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: _jsx("path", { d: "M6 6L14 14M14 6L6 14" }) }) })] })), _jsx("div", { className: `${title || footer ? 'px-6 py-4' : 'p-6'}`, children: children }), footer && (_jsx("div", { className: "px-6 py-4 border-t flex justify-end gap-3", style: { borderColor: 'var(--rb-border)' }, children: footer }))] })] }) }));
}
