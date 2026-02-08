import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
/**
 * Dev-only debug HUD to visualize overlay roots and mounting targets.
 * Helps identify "Global Capture" issues and z-index fighting.
 */
export const OverlayDebugHUD = () => {
    const [roots, setRoots] = useState([]);
    useEffect(() => {
        const update = () => {
            const elements = document.querySelectorAll('[data-rb-window-overlay-root]');
            const newRoots = Array.from(elements).map((el, i) => {
                const style = window.getComputedStyle(el);
                return {
                    id: el.id || `root-${i}`,
                    rect: el.getBoundingClientRect(),
                    zIndex: style.zIndex,
                };
            });
            setRoots(newRoots);
        };
        const interval = setInterval(update, 500);
        update();
        return () => clearInterval(interval);
    }, []);
    if (roots.length === 0) {
        return (_jsx("div", { className: "fixed bottom-4 left-4 z-[99999] bg-yellow-900/90 text-yellow-200 border border-yellow-500/50 px-3 py-1.5 rounded text-[10px] font-mono shadow-2xl", children: "OVERLAY DEBUG: No window roots found! (Global Portals only)" }));
    }
    return (_jsxs(_Fragment, { children: [roots.map((root) => (_jsx("div", { className: "fixed pointer-events-none z-[99998] border-2 border-cyan-500/50 bg-cyan-500/5 animate-pulse", style: {
                    left: root.rect.left,
                    top: root.rect.top,
                    width: root.rect.width,
                    height: root.rect.height,
                }, children: _jsxs("div", { className: "absolute top-0 right-0 bg-cyan-600 text-white text-[8px] px-1 font-mono", children: ["ROOT (Z:", root.zIndex, ")"] }) }, root.id))), _jsxs("div", { className: "fixed bottom-4 left-4 z-[99999] bg-cyan-900/90 text-cyan-200 border border-cyan-500/50 px-3 py-1.5 rounded text-[10px] font-mono shadow-2xl space-y-1", children: [_jsx("div", { className: "font-bold border-b border-cyan-500/30 pb-1 mb-1", children: "OVERLAY DEBUG ACTIVE" }), _jsxs("div", { children: ["Roots: ", roots.length] }), roots.map(r => (_jsxs("div", { className: "opacity-70", children: ["\u2022 ", r.id, ": ", Math.round(r.rect.width), "x", Math.round(r.rect.height), " (Z: ", r.zIndex, ")"] }, r.id)))] })] }));
};
