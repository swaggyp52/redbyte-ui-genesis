import React, { useLayoutEffect, useState } from 'react';

export const HitTestDebugHUD: React.FC = () => {
    const [lastHit, setLastHit] = useState<{
        x: number;
        y: number;
        tagName: string;
        id: string;
        testId: string;
        pointerEvents: string;
        rect: DOMRect;
    } | null>(null);

    useLayoutEffect(() => {
        const handlePointerDown = (e: PointerEvent) => {
            const target = e.target as HTMLElement;
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
            const composedPath = e.composedPath().map((el: any) => {
                if (el instanceof HTMLElement) {
                    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.getAttribute('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` : ''}`;
                }
                return '';
            }).filter(Boolean).slice(0, 5); // Top 5

            const elementFromPoint = document.elementFromPoint(e.clientX, e.clientY);
            const elementFromPointTag = elementFromPoint
                ? `${elementFromPoint.tagName.toLowerCase()}${elementFromPoint.id ? '#' + elementFromPoint.id : ''}`
                : 'null';

            console.log(
                `%c[HitTest] %c${hitInfo.tagName} %c(${hitInfo.x}, ${hitInfo.y})`,
                'color: #06b6d4; font-weight: bold;',
                'color: #fff;',
                'color: #94a3b8;',
                {
                    target: hitInfo,
                    composedPath,
                    elementFromPoint: elementFromPointTag,
                    isBlocked: style.pointerEvents === 'none',
                }
            );
        };

        // Capture phase to see everything before it's stopped
        window.addEventListener('pointerdown', handlePointerDown, { capture: true });
        return () => window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
    }, []);

    if (!lastHit) return null;

    return (
        <>
            {/* Visual Overlay of the exact hit target */}
            <div
                className="fixed pointer-events-none z-[99999] border-2 border-red-500 bg-red-500/10 transition-all duration-75"
                style={{
                    left: lastHit.rect.left,
                    top: lastHit.rect.top,
                    width: lastHit.rect.width,
                    height: lastHit.rect.height,
                }}
            />

            {/* Info HUD */}
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] bg-black/90 text-red-400 border border-red-500/50 px-4 py-2 rounded shadow-2xl font-mono text-xs pointer-events-none whitespace-pre">
                <div>HIT: {lastHit.tagName} #{lastHit.id}</div>
                <div className="text-white/70">data-testid: {lastHit.testId}</div>
                <div className="text-white/70">pointer-events: {lastHit.pointerEvents}</div>
            </div>
        </>
    );
};
