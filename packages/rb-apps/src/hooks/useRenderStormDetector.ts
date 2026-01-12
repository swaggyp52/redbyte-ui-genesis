// Dev-only helper to surface render storms without affecting production builds.
import { useEffect, useRef } from 'react';

export function useRenderStormDetector(label: string, thresholdPerSecond: number = 60) {
  if (!import.meta.env.DEV) return;

  const countRef = useRef(0);
  const gateRef = useRef(false);
  const startRef = useRef(performance.now());

  countRef.current += 1;

  useEffect(() => {
    const now = performance.now();
    if (now - startRef.current > 1000) {
      startRef.current = now;
      countRef.current = 0;
      gateRef.current = false;
    }

    if (!gateRef.current && countRef.current > thresholdPerSecond) {
      gateRef.current = true;
      // eslint-disable-next-line no-console
      console.warn(`[render-storm] ${label}`, { renders: countRef.current, stack: new Error().stack });
    }
  });
}
