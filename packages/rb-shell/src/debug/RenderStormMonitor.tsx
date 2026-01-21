import React, { useEffect } from 'react';
import { getRenderCounts } from '@redbyte/rb-utils';
import { toast } from '@redbyte/rb-primitives';

const THRESHOLD_FPS = 60;
const CHECK_INTERVAL_MS = 1000;

export const RenderStormMonitor: React.FC = () => {
    useEffect(() => {
        let lastCounts: Record<string, number> = {};

        const interval = setInterval(() => {
            const currentCounts = getRenderCounts();

            Object.entries(currentCounts).forEach(([key, count]) => {
                const prev = lastCounts[key] || 0;
                const diff = count - prev;

                if (diff > THRESHOLD_FPS) {
                    const msg = `[RenderStorm] ${key}: ${diff} renders/sec`;
                    console.warn(msg, { total: count });

                    // Debounce toast showing to avoid spamming UI during a storm
                    if (Math.random() > 0.9) {
                        toast.error({ title: 'Render Storm Detected', message: msg });
                    }
                }
            });

            lastCounts = { ...currentCounts };
        }, CHECK_INTERVAL_MS);

        return () => clearInterval(interval);
    }, []);

    return null; // Headless component
};
