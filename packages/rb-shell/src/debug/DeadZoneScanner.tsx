// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useState } from 'react';

/**
 * DeadZoneScanner
 * 
 * A diagnostic tool that clicks a grid across the viewport and reports
 * areas where no element (or only the background) was hit.
 * 
 * Activated via Ctrl+Shift+K in Shell.tsx
 */
export const DeadZoneScanner: React.FC = () => {
    const [status, setStatus] = useState<string>('Ready to scan...');
    const [missedCount, setMissedCount] = useState<number>(0);

    const runScan = async () => {
        setStatus('Scanning...');
        setMissedCount(0);

        const GRID_SIZE = 25; // 25x25 grid = 625 points
        const width = window.innerWidth;
        const height = window.innerHeight;
        const stepX = width / GRID_SIZE;
        const stepY = height / GRID_SIZE;

        const blockers: Record<string, { count: number, element: any, points: { x: number, y: number }[] }> = {};
        let backgroundHits = 0;

        for (let ix = 0; ix < GRID_SIZE; ix++) {
            for (let iy = 0; iy < GRID_SIZE; iy++) {
                const x = ix * stepX + stepX / 2;
                const y = iy * stepY + stepY / 2;

                const element = document.elementFromPoint(x, y);
                if (!element) continue;

                const tagName = element.tagName.toLowerCase();
                const id = element.id || '';
                const testId = element.getAttribute('data-testid') || '';

                // Heuristic: What counts as "safe background"?
                // 1. The body itself
                // 2. The desktop wallpaper/container
                // 3. The shell root container
                const isSafeBackground =
                    tagName === 'body' ||
                    id === 'desktop-background' ||
                    id === 'shell-root' ||
                    testId === 'shell-desktop' ||
                    element.getAttribute('aria-label') === 'Desktop Environment';

                if (isSafeBackground) {
                    backgroundHits++;
                    continue;
                }

                // If not safe background, it's potentially a blocker or a valid UI element.
                // We aggregate EVERYTHING that isn't background.
                // Key construction: try ID -> testId -> tagName + class
                let key = tagName;
                if (id) key += `#${id}`;
                else if (testId) key += `[data-testid="${testId}"]`;
                else if (element.className && typeof element.className === 'string') {
                    key += `.${element.className.split(' ')[0]}`;
                }

                if (!blockers[key]) {
                    // Find owning window
                    let owningWindow = 'none';
                    let curr = element;
                    while (curr && curr !== document.body) {
                        // Check for typical window indicators (adjust selectors as needed for your specific codebase)
                        if (curr.getAttribute('role') === 'dialog' || curr.className.includes('window') || curr.getAttribute('data-testid')?.includes('window')) {
                            owningWindow = curr.getAttribute('data-testid') || curr.id || 'unknown-window';
                            break;
                        }
                        curr = curr.parentElement as Element;
                    }

                    const style = window.getComputedStyle(element);
                    blockers[key] = {
                        count: 0,
                        element: {
                            tagName,
                            id,
                            testId,
                            className: element.className,
                            pointerEvents: style.pointerEvents,
                            zIndex: style.zIndex,
                            owningWindow
                        },
                        points: []
                    };
                }
                blockers[key].count++;
                blockers[key].points.push({ x, y });
            }
        }

        // Convert blockers to sorted list
        const sortedBlockers = Object.entries(blockers)
            .map(([selector, data]) => ({
                selector,
                count: data.count,
                ...data.element
            }))
            .sort((a, b) => b.count - a.count);

        setMissedCount(backgroundHits);
        setStatus('Scan complete.');

        const report = {
            timestamp: new Date().toISOString(),
            gridSize: GRID_SIZE,
            totalPoints: GRID_SIZE * GRID_SIZE,
            backgroundHits,
            blockers: sortedBlockers.filter(b => b.count > 0), // meaningful blockers
            topOffenders: sortedBlockers.slice(0, 10)
        };

        console.log('[DeadZoneScanner] JSON_REPORT_START');
        console.log(JSON.stringify(report, null, 2));
        console.log('[DeadZoneScanner] JSON_REPORT_END');

        // Expose for external agents
        (window as any).__deadZoneReport = report;
    };

    useEffect(() => {
        // Run immediately on mount
        const timer = setTimeout(runScan, 500); // Small delay to let UI settle
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100000] bg-slate-900 border border-cyan-500 p-4 rounded-lg shadow-2xl font-mono text-xs text-cyan-400 pointer-events-none">
            <div className="flex items-center gap-2 mb-2">
                <span className="animate-pulse">●</span>
                <span className="font-bold">DEAD-ZONE SCANNER</span>
            </div>
            <div>Status: {status}</div>
            <div>Scanned: 25x25</div>
        </div>
    );
};
