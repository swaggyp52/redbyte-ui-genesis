// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useMemo, useState } from 'react';
import { Icon, type IconName } from '@redbyte/rb-icons';
import { useSettingsStore } from '@redbyte/rb-utils';

interface BootScreenProps {
  onComplete: () => void;
}

const STAGES: Array<{ at: number; label: string; detail: string; icon: IconName }> = [
  { at: 0, label: 'Deterministic self-check', detail: 'Verifying core invariants', icon: 'power' },
  { at: 38, label: 'Workspace graph', detail: 'Loading state topology', icon: 'cpu' },
  { at: 72, label: 'Instrument calibration', detail: 'Syncing UI surfaces', icon: 'circuit-board' },
  { at: 100, label: 'Ready', detail: 'Handing control to shell', icon: 'grid' },
];

const BootScreen: React.FC<BootScreenProps> = ({ onComplete }) => {
  const reduceMotion = useSettingsStore((state) => state.reduceMotion);
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);

  const timing = useMemo(() => {
    const base = reduceMotion ? 320 : 1400;
    const fade = reduceMotion ? 0 : 220;
    return { duration: Math.max(1, base), fade };
  }, [reduceMotion]);

  const stageIndex = useMemo(() => {
    let index = 0;
    for (let i = 0; i < STAGES.length; i += 1) {
      if (progress >= STAGES[i].at) {
        index = i;
      }
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
      className="fixed inset-0 flex items-center justify-center text-white overflow-hidden rb-noise"
      style={{
        background: 'var(--rb-surface-0)',
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'scale(1.01)' : 'scale(1)',
        transition: reduceMotion
          ? 'none'
          : 'opacity 220ms var(--rb-easing-out), transform 220ms var(--rb-easing-out)',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(900px circle at 20% 20%, rgba(14,116,144,0.2), transparent 60%),' +
            'radial-gradient(800px circle at 80% 30%, rgba(56,189,248,0.12), transparent 62%),' +
            'linear-gradient(180deg, rgba(5,8,18,0.96), rgba(4,8,16,0.9))',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), ' +
            'linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)',
          backgroundSize: '90px 90px',
        }}
      />
      <div
        className="absolute left-0 right-0 h-px rb-anim"
        style={{
          top: 0,
          background: 'linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.4), transparent)',
          animation: reduceMotion ? 'none' : 'scan-line 6s linear infinite',
        }}
      />

      <div className="relative z-10 w-[520px] max-w-[90vw] rounded-3xl border px-6 py-6" style={{
        borderColor: 'var(--rb-border)',
        background: 'var(--rb-glass)',
        boxShadow: 'var(--rb-shadow-2)'
      }}>
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-2xl border flex items-center justify-center"
            style={{
              borderColor: 'var(--rb-border-strong)',
              background: 'var(--rb-surface-2)',
              boxShadow: 'var(--rb-shadow-1)',
            }}
          >
            <Icon name="neon-wave" size={24} className="text-cyan-300" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-semibold tracking-wide text-slate-100">RedByte OS</div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Deterministic boot</div>
          </div>
          <div className="text-[10px] font-mono text-slate-500">v1.0</div>
        </div>

        <div className="mt-6 space-y-3">
          {STAGES.map((stage, index) => {
            const status = index < stageIndex ? 'OK' : index === stageIndex ? 'RUN' : 'WAIT';
            const statusColor = index < stageIndex
              ? 'text-emerald-300'
              : index === stageIndex
                ? 'text-cyan-300'
                : 'text-slate-500';

            return (
              <div
                key={stage.label}
                className="flex items-center gap-3 rounded-2xl border px-3 py-2"
                style={{
                  borderColor: index === stageIndex ? 'var(--rb-border-strong)' : 'var(--rb-border)',
                  background: index === stageIndex ? 'rgba(8, 16, 32, 0.65)' : 'transparent',
                }}
              >
                <div
                  className="h-9 w-9 rounded-xl border flex items-center justify-center"
                  style={{ borderColor: 'var(--rb-border)', background: 'var(--rb-surface-2)' }}
                >
                  <Icon name={stage.icon} size={16} />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-slate-100 font-medium">{stage.label}</div>
                  <div className="text-[11px] text-slate-500">{stage.detail}</div>
                </div>
                <div className={`text-[10px] font-mono ${statusColor}`}>{status}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--rb-surface-3)' }}>
            <div
              className="h-full"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, rgba(34,211,238,0.8), rgba(56,189,248,0.45))',
                transition: reduceMotion ? 'none' : 'width 120ms var(--rb-easing-out)',
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
            <span className="font-mono">{currentStage?.label ?? 'Booting'}</span>
            <span className="font-mono">{progress.toString().padStart(3, '0')}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BootScreen;
