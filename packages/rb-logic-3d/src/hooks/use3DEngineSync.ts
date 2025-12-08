import { useEffect, useRef, useState } from 'react';
import type { CircuitEngine } from '@rb/rb-logic-core';

export function use3DEngineSync(engine: CircuitEngine) {
  const [signals, setSignals] = useState<Map<string, 0 | 1>>(new Map());
  const frameIdRef = useRef<number>();

  useEffect(() => {
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
