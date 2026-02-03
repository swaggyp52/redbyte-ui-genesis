import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export const DeadZoneScanner = () => {
    const [status, setStatus] = useState('Ready to scan (Click Button)');
    const [missedCount, setMissedCount] = useState(0);
    const getClassNameSafe = (el) => {
        const anyEl = el;
        const cn = anyEl?.className;
        if (typeof cn === 'string')
            return cn;
        if (cn && typeof cn === 'object' && typeof cn.baseVal === 'string')
            return cn.baseVal;
        return '';
    };
    const runScan = async () => {
        try {
            setStatus('Scanning...');
            setMissedCount(0);
            // Allow UI to update before blocking thread
            await new Promise(r => setTimeout(r, 100));
            const GRID_SIZE = 25; // 25x25 grid = 625 points
            const width = window.innerWidth;
            const height = window.innerHeight;
            const stepX = width / GRID_SIZE;
            const stepY = height / GRID_SIZE;
            const blockers = {};
            let backgroundHits = 0;
            for (let ix = 0; ix < GRID_SIZE; ix++) {
                for (let iy = 0; iy < GRID_SIZE; iy++) {
                    const x = ix * stepX + stepX / 2;
                    const y = iy * stepY + stepY / 2;
                    const element = document.elementFromPoint(x, y);
                    if (!element)
                        continue;
                    // Check if we hit the scanner itself or its children
                    if (element.closest('#dead-zone-scanner-ui')) {
                        backgroundHits++; // Treat as background/ignore for stats, or just skip
                        continue;
                    }
                    const tagName = element.tagName.toLowerCase();
                    const id = element.id || '';
                    const testId = element.getAttribute('data-testid') || '';
                    // Define what counts as "background" (i.e. click-through is fine)
                    const isSafeBackground = tagName === 'body' ||
                        id === 'desktop-background' ||
                        id === 'shell-root' ||
                        testId === 'shell-desktop' ||
                        element.getAttribute('aria-label') === 'Desktop Environment';
                    if (isSafeBackground) {
                        backgroundHits++;
                        continue;
                    }
                    // Generate a readable selector key
                    let key = tagName;
                    const className = getClassNameSafe(element);
                    if (id)
                        key += `#${id}`;
                    else if (testId)
                        key += `[data-testid="${testId}"]`;
                    else if (className) {
                        key += `.${className.split(' ')[0]}`;
                    }
                    if (!blockers[key]) {
                        let owningWindow = 'none';
                        let curr = element;
                        while (curr && curr !== document.body) {
                            const currClass = getClassNameSafe(curr);
                            if (curr.getAttribute('role') === 'dialog' || currClass.includes('window') || curr.getAttribute('data-testid')?.includes('window')) {
                                owningWindow = curr.getAttribute('data-testid') || curr.id || 'unknown-window';
                                break;
                            }
                            curr = curr.parentElement;
                        }
                        const style = window.getComputedStyle(element);
                        const rect = element.getBoundingClientRect();
                        blockers[key] = {
                            count: 0,
                            element: {
                                tagName,
                                id,
                                testId,
                                className,
                                pointerEvents: style.pointerEvents,
                                zIndex: style.zIndex,
                                position: style.position,
                                owningWindow,
                                rect: {
                                    x: Math.round(rect.x),
                                    y: Math.round(rect.y),
                                    w: Math.round(rect.width),
                                    h: Math.round(rect.height)
                                },
                                htmlPreview: element.outerHTML.slice(0, 200)
                            },
                            points: []
                        };
                    }
                    blockers[key].count++;
                    blockers[key].points.push({ x, y });
                }
            }
            const sortedBlockers = Object.entries(blockers)
                .map(([selector, data]) => ({
                selector,
                count: data.count,
                ...data.element
            }))
                .sort((a, b) => b.count - a.count);
            setMissedCount(backgroundHits);
            const report = {
                timestamp: new Date().toISOString(),
                gridSize: GRID_SIZE,
                totalPoints: GRID_SIZE * GRID_SIZE,
                backgroundHits,
                blockers: sortedBlockers.filter(b => b.count > 0),
                topOffenders: sortedBlockers.slice(0, 10),
                viewport: { width, height }
            };
            window.__deadZoneReport = report;
            console.log('DEAD ZONE REPORT:', report);
            // Try to send to local capture server
            try {
                setStatus('Sending report...');
                const res = await fetch('http://localhost:3001/report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(report)
                });
                if (res.ok) {
                    const json = await res.json();
                    setStatus(`Saved to ${json.path || 'server'}`);
                }
                else {
                    setStatus('Save Failed (Server Error)');
                }
            }
            catch (e) {
                console.error('Failed to send report to local server', e);
                setStatus('Save Failed (Run scripts/capture-scan-report.js)');
            }
        }
        catch (e) {
            console.error('[DeadZoneScanner] scan failed', e);
            setStatus(`Error: ${e.message || e}`);
        }
    };
    return (_jsxs("div", { id: "dead-zone-scanner-ui", className: "fixed bottom-20 left-1/2 -translate-x-1/2 z-[100000] bg-slate-900 border border-cyan-500 p-4 rounded-lg shadow-2xl font-mono text-xs text-cyan-400", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("span", { className: "animate-pulse", children: "\u25CF" }), _jsx("span", { className: "font-bold", children: "DEAD-ZONE SCANNER (v3 DETECT)" })] }), _jsxs("div", { className: "mb-2", children: ["Status: ", status] }), _jsx("div", { className: "mb-2", children: "Grid: 25x25" }), _jsx("button", { onClick: runScan, onPointerDown: (e) => e.stopPropagation(), className: "bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-2 rounded w-full font-bold transition-colors cursor-pointer", style: { pointerEvents: 'auto' }, children: "RUN SCAN" })] }));
};
