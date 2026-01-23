import React, { useEffect, useState } from 'react';

/**
 * Dev-only debug HUD to visualize overlay roots and mounting targets.
 * Helps identify "Global Capture" issues and z-index fighting.
 */
export const OverlayDebugHUD: React.FC = () => {
    const [roots, setRoots] = useState<{ id: string; rect: DOMRect; zIndex: string }[]>([]);

    useEffect(() => {
        const update = () => {
            const elements = document.querySelectorAll('[data-rb-window-overlay-root]');
            const newRoots = Array.from(elements).map((el, i) => {
                const style = window.getComputedStyle(el);
                return {
                    id: (el as HTMLElement).id || `root-${i}`,
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
        return (
            <div className="fixed bottom-4 left-4 z-[99999] bg-yellow-900/90 text-yellow-200 border border-yellow-500/50 px-3 py-1.5 rounded text-[10px] font-mono shadow-2xl">
                OVERLAY DEBUG: No window roots found! (Global Portals only)
            </div>
        );
    }

    return (
        <>
            {roots.map((root) => (
                <div
                    key={root.id}
                    className="fixed pointer-events-none z-[99998] border-2 border-cyan-500/50 bg-cyan-500/5 animate-pulse"
                    style={{
                        left: root.rect.left,
                        top: root.rect.top,
                        width: root.rect.width,
                        height: root.rect.height,
                    }}
                >
                    <div className="absolute top-0 right-0 bg-cyan-600 text-white text-[8px] px-1 font-mono">
                        ROOT (Z:{root.zIndex})
                    </div>
                </div>
            ))}

            <div className="fixed bottom-4 left-4 z-[99999] bg-cyan-900/90 text-cyan-200 border border-cyan-500/50 px-3 py-1.5 rounded text-[10px] font-mono shadow-2xl space-y-1">
                <div className="font-bold border-b border-cyan-500/30 pb-1 mb-1">OVERLAY DEBUG ACTIVE</div>
                <div>Roots: {roots.length}</div>
                {roots.map(r => (
                    <div key={r.id} className="opacity-70">
                        • {r.id}: {Math.round(r.rect.width)}x{Math.round(r.rect.height)} (Z: {r.zIndex})
                    </div>
                ))}
            </div>
        </>
    );
};
