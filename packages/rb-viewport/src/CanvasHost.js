import { jsx as _jsx } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
import { useRef, useEffect, useCallback } from 'react';
import { setActiveCanvas, isCanvasActive, clearIfActive } from './activeCanvas.js';
function isTextEntryElement(el) {
    if (!el)
        return false;
    if (!(el instanceof HTMLElement))
        return false;
    // direct types
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
        return true;
    if (el.isContentEditable)
        return true;
    // aria textboxes (common in component libs)
    if (el.getAttribute('role') === 'textbox')
        return true;
    // if focus is inside an input-like container
    const closest = el.closest?.('input, textarea, [contenteditable="true"], [role="textbox"]');
    return Boolean(closest);
}
export const CanvasHost = ({ id, children, onActive, onInactive, onWheelActive, onKeyDownActive, onKeyUpActive, preventPageScroll = true, className = '', }) => {
    const containerRef = useRef(null);
    // Keep latest callbacks without re-binding global listeners
    const wheelCbRef = useRef(onWheelActive);
    const keyDownCbRef = useRef(onKeyDownActive);
    const keyUpCbRef = useRef(onKeyUpActive);
    useEffect(() => { wheelCbRef.current = onWheelActive; }, [onWheelActive]);
    useEffect(() => { keyDownCbRef.current = onKeyDownActive; }, [onKeyDownActive]);
    useEffect(() => { keyUpCbRef.current = onKeyUpActive; }, [onKeyUpActive]);
    const activate = useCallback(() => {
        if (!isCanvasActive(id)) {
            setActiveCanvas(id);
            onActive?.();
        }
    }, [id, onActive]);
    const deactivate = useCallback(() => {
        if (isCanvasActive(id)) {
            clearIfActive(id);
            onInactive?.();
        }
    }, [id, onInactive]);
    // Pointer enter activates (hover-based)
    const handlePointerEnter = useCallback(() => {
        activate();
    }, [activate]);
    // Pointer leave must not deactivate when moving to an overlay inside the container
    const handlePointerLeave = useCallback((e) => {
        const next = e.relatedTarget;
        const container = containerRef.current;
        if (container && next && container.contains(next)) {
            return; // still "inside" the canvas host (entered a child overlay)
        }
        deactivate();
    }, [deactivate]);
    // Wheel: bind once
    useEffect(() => {
        const container = containerRef.current;
        if (!container)
            return;
        const handleWheel = (e) => {
            if (!isCanvasActive(id))
                return;
            if (preventPageScroll) {
                e.preventDefault();
            }
            const cb = wheelCbRef.current;
            if (cb) {
                cb(e, container.getBoundingClientRect());
            }
        };
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [id, preventPageScroll]);
    // Keyboard: bind once (uses global active id)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isCanvasActive(id))
                return;
            // Guard text entry using activeElement (NOT e.target)
            const ae = document.activeElement;
            if (isTextEntryElement(ae))
                return;
            keyDownCbRef.current?.(e);
        };
        const handleKeyUp = (e) => {
            if (!isCanvasActive(id))
                return;
            const ae = document.activeElement;
            if (isTextEntryElement(ae))
                return;
            keyUpCbRef.current?.(e);
        };
        const handleBlur = () => {
            // prevent "stuck active" when alt-tabbing
            deactivate();
        };
        const handleVis = () => {
            if (document.visibilityState !== 'visible')
                deactivate();
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        document.addEventListener('visibilitychange', handleVis);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
            document.removeEventListener('visibilitychange', handleVis);
            // Cleanup on unmount if we were active
            clearIfActive(id);
        };
    }, [id, deactivate]);
    return (_jsx("div", { ref: containerRef, onPointerEnter: handlePointerEnter, onPointerLeave: handlePointerLeave, className: className, style: { position: 'relative', width: '100%', height: '100%' }, children: children }));
};
