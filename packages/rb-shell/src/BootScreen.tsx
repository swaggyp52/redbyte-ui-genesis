// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useMemo, useState } from 'react';
import { useSettingsStore } from '@redbyte/rb-utils';

interface BootScreenProps {
  onComplete: () => void;
}

const STAGES = [
  { at: 0, label: 'Self-check' },
  { at: 40, label: 'Loading workspace' },
  { at: 75, label: 'Calibrating' },
  { at: 100, label: 'Ready' },
];

const BootScreen: React.FC<BootScreenProps> = ({ onComplete }) => {
  const reduceMotion = useSettingsStore((state) => state.reduceMotion);
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);

  const timing = useMemo(() => {
    const base = reduceMotion ? 200 : 800;
    const fade = reduceMotion ? 0 : 180;
    return { duration: Math.max(1, base), fade };
  }, [reduceMotion]);

  const stageIndex = useMemo(() => {
    let index = 0;
    for (let i = 0; i < STAGES.length; i += 1) {
      if (progress >= STAGES[i].at) index = i;
    }
    return index;
  }, [progress]);

  useEffect(() => {
    let raf = 0;
    let active = true;
    const start = performance.now();

    const tick = (now: number) => {
      if (!active) return;
      const elapsed = now - start;
      const nextProgress = Math.min(100, Math.round((elapsed / timing.duration) * 100));
      setProgress(nextProgress);

      if (elapsed < timing.duration) {
        raf = requestAnimationFrame(tick);
      } else {
        setExiting(true);
      }
    };

    raf = requestAnimationFrame(tick);

    const timeout = window.setTimeout(() => {
      if (active) onComplete();
    }, timing.duration + timing.fade);

    return () => {
      active = false;
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [onComplete, timing.duration, timing.fade]);

  const currentStage = STAGES[stageIndex];

  return (
    <div
      data-testid="shell-boot-screen"
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{
        background: 'var(--rb-surface-0)',
        color: 'var(--rb-text)',
        opacity: exiting ? 0 : 1,
        transition: reduceMotion
          ? 'none'
          : 'opacity 180ms var(--rb-easing-out)',
      }}
    >
      {/* Minimal boot card */}
      <div className="w-[320px] max-w-[85vw]">
        {/* Logo + name */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--rb-accent)' }}
          >
            <span className="text-sm font-bold text-white leading-none">R</span>
          </div>
          <div>
            <div
              className="text-lg font-semibold tracking-wide"
              style={{ color: 'var(--rb-text)' }}
            >
              RedByte OS
            </div>
            <div
              className="text-[10px] font-mono uppercase tracking-widest"
              style={{ color: 'var(--rb-text-3)' }}
            >
              Genesis
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: 'var(--rb-surface-2)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: 'var(--rb-accent)',
              transition: reduceMotion ? 'none' : 'width 80ms linear',
            }}
          />
        </div>

        {/* Stage label */}
        <div
          className="mt-2 flex items-center justify-between text-[11px] font-mono"
          style={{ color: 'var(--rb-text-3)' }}
        >
          <span>{currentStage?.label ?? 'Booting'}</span>
          <span>{progress}%</span>
        </div>
      </div>
    </div>
  );
};

export default BootScreen;
