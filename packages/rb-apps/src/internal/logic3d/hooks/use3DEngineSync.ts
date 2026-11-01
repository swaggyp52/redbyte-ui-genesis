// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { useEffect, useRef, useState } from 'react';
import type { CircuitEngine, Signal } from '@redbyte/rb-logic-core';
import { copySceneSignals } from '../sceneContracts';

export function use3DEngineSync(engine: CircuitEngine) {
  const [signals, setSignals] = useState<Map<string, Signal>>(() => copySceneSignals(engine.getAllSignals()));
  const frameIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Guard against undefined engine or missing methods
    if (!engine || typeof engine.getAllSignals !== 'function') {
      return;
    }

    let active = true;
    let lastUpdate = Date.now();
    setSignals(copySceneSignals(engine.getAllSignals()));

    const updateSignals = () => {
      if (!active) return;
      const now = Date.now();
      if (now - lastUpdate >= 50) {
        // Update at 20Hz max
        setSignals(copySceneSignals(engine.getAllSignals()));
        lastUpdate = now;
      }

      frameIdRef.current = requestAnimationFrame(updateSignals);
    };

    frameIdRef.current = requestAnimationFrame(updateSignals);

    return () => {
      active = false;
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
    };
  }, [engine]);

  return signals;
}
