// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { usePortalContainer } from './PortalContext';

export interface OverlayProps {
    children: React.ReactNode;
    /** Optional class name for the root container */
    className?: string;
    /** Optional inline styles for the root container */
    style?: React.CSSProperties;
    /** Whether the overlay is active (rendered) */
    isActive?: boolean;
}

/**
 * A non-modal overlay primitive that respects the pointer-events invariant.
 * Backdrop is non-intercepting; children (panels) should re-enable pointer-events.
 */
export function OverlayRoot({
    children,
    className = '',
    style,
    isActive = true
}: OverlayProps) {
    const contextContainer = usePortalContainer();
    const isWindowScoped = !!contextContainer;

    if (!isActive) return null;

    return (
        <div
            className={`${isWindowScoped ? 'absolute' : 'fixed'} inset-0 ${className}`}
            style={{
                zIndex: 50,
                pointerEvents: 'none',
                ...style
            }}
        >
            {children}
        </div>
    );
}

export interface OverlayPanelProps {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * An interactive panel within an OverlayRoot.
 * Re-enables pointer events to allow interaction.
 */
export function OverlayPanel({
    children,
    className = '',
    style
}: OverlayPanelProps) {
    return (
        <div
            className={`${className}`}
            style={{
                pointerEvents: 'auto',
                ...style
            }}
        >
            {children}
        </div>
    );
}
export interface OverlayBackdropProps {
    className?: string;
    style?: React.CSSProperties;
    onClick?: (e: React.MouseEvent) => void;
}

/**
 * An optional backdrop for an OverlayRoot.
 * Re-enables pointer events to capture clicks (e.g., for dismissal).
 * Sits behind OverlayPanel if used correctly in the DOM order.
 */
export function OverlayBackdrop({
    className = '',
    style,
    onClick
}: OverlayBackdropProps) {
    return (
        <div
            className={`absolute inset-0 ${className}`}
            style={{
                pointerEvents: 'auto',
                ...style
            }}
            onClick={onClick}
        />
    );
}
