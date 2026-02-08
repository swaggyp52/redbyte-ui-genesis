import { jsx as _jsx } from "react/jsx-runtime";
import { usePortalContainer } from './PortalContext';
/**
 * A non-modal overlay primitive that respects the pointer-events invariant.
 * Backdrop is non-intercepting; children (panels) should re-enable pointer-events.
 */
export function OverlayRoot({ children, className = '', style, isActive = true }) {
    const contextContainer = usePortalContainer();
    const isWindowScoped = !!contextContainer;
    if (!isActive)
        return null;
    return (_jsx("div", { className: `${isWindowScoped ? 'absolute' : 'fixed'} inset-0 ${className}`, style: {
            zIndex: 50,
            pointerEvents: 'none',
            ...style
        }, children: children }));
}
/**
 * An interactive panel within an OverlayRoot.
 * Re-enables pointer events to allow interaction.
 */
export function OverlayPanel({ children, className = '', style }) {
    return (_jsx("div", { className: `${className}`, style: {
            pointerEvents: 'auto',
            ...style
        }, children: children }));
}
/**
 * An optional backdrop for an OverlayRoot.
 * Re-enables pointer events to capture clicks (e.g., for dismissal).
 * Sits behind OverlayPanel if used correctly in the DOM order.
 */
export function OverlayBackdrop({ className = '', style, onClick }) {
    return (_jsx("div", { className: `absolute inset-0 ${className}`, style: {
            pointerEvents: 'auto',
            ...style
        }, onClick: onClick }));
}
