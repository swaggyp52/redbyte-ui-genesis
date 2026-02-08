// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useEffect, useRef, useState } from 'react';
export function use3DEngineSync(engine) {
    const [signals, setSignals] = useState(new Map());
    const frameIdRef = useRef();
    useEffect(() => {
        // Guard against undefined engine or missing methods
        if (!engine || typeof engine.getAllSignals !== 'function') {
            return;
        }
        let lastUpdate = Date.now();
        const updateSignals = () => {
            const now = Date.now();
            if (now - lastUpdate >= 50) {
                // Update at 20Hz max
                setSignals(new Map(engine.getAllSignals()));
                lastUpdate = now;
            }
            frameIdRef.current = requestAnimationFrame(updateSignals);
        };
        frameIdRef.current = requestAnimationFrame(updateSignals);
        return () => {
            if (frameIdRef.current) {
                cancelAnimationFrame(frameIdRef.current);
            }
        };
    }, [engine]);
    return signals;
}
