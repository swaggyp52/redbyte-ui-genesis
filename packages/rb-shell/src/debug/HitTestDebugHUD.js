import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useLayoutEffect, useState } from 'react';
export const HitTestDebugHUD = () => {
    const [lastHit, setLastHit] = useState(null);
    useLayoutEffect(() => {
        const handlePointerDown = (e) => {
            const target = e.target;
            const rect = target.getBoundingClientRect();
            const style = window.getComputedStyle(target);
            const hitInfo = {
                x: e.clientX,
                y: e.clientY,
                tagName: target.tagName.toLowerCase(),
                id: target.id || '(none)',
                testId: target.getAttribute('data-testid') || '(none)',
                pointerEvents: style.pointerEvents,
                rect,
            };
            setLastHit(hitInfo);
            // Log rigorous details for the agent/dev
            const composedPath = e.composedPath().map((el) => {
                if (el instanceof HTMLElement) {
                    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.getAttribute('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` : ''}`;
                }
                return '';
            }).filter(Boolean).slice(0, 5); // Top 5
            const elementFromPoint = document.elementFromPoint(e.clientX, e.clientY);
            const elementFromPointTag = elementFromPoint
                ? `${elementFromPoint.tagName.toLowerCase()}${elementFromPoint.id ? '#' + elementFromPoint.id : ''}`
                : 'null';
            console.log(`%c[HitTest] %c${hitInfo.tagName} %c(${hitInfo.x}, ${hitInfo.y})`, 'color: #06b6d4; font-weight: bold;', 'color: #fff;', 'color: #94a3b8;', {
                target: hitInfo,
                composedPath,
                elementFromPoint: elementFromPointTag,
                isBlocked: style.pointerEvents === 'none',
            });
        };
        // Capture phase to see everything before it's stopped
        window.addEventListener('pointerdown', handlePointerDown, { capture: true });
        return () => window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
    }, []);
    if (!lastHit)
        return null;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed pointer-events-none z-[99999] border-2 border-red-500 bg-red-500/10 transition-all duration-75", style: {
                    left: lastHit.rect.left,
                    top: lastHit.rect.top,
                    width: lastHit.rect.width,
                    height: lastHit.rect.height,
                } }), _jsxs("div", { className: "fixed top-4 left-1/2 -translate-x-1/2 z-[99999] bg-black/90 text-red-400 border border-red-500/50 px-4 py-2 rounded shadow-2xl font-mono text-xs pointer-events-none whitespace-pre", children: [_jsxs("div", { children: ["HIT: ", lastHit.tagName, " #", lastHit.id] }), _jsxs("div", { className: "text-white/70", children: ["data-testid: ", lastHit.testId] }), _jsxs("div", { className: "text-white/70", children: ["pointer-events: ", lastHit.pointerEvents] })] })] }));
};
