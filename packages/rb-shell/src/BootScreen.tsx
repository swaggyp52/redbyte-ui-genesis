// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useState } from 'react';
import { Icon } from '@redbyte/rb-icons';

interface BootScreenProps {
  onComplete: () => void;
}

const BootScreen: React.FC<BootScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);

  const BOOT_DURATION_MS = 1200;
  const stages = [
    { at: 0, label: 'Powering workspace' },
    { at: 35, label: 'Loading logic core' },
    { at: 70, label: 'Calibrating instruments' },
    { at: 100, label: 'Ready' },
  ];

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const nextProgress = Math.min(100, Math.round((elapsed / BOOT_DURATION_MS) * 100));

      setProgress(nextProgress);

      const nextStageIndex = stages.reduce((acc, stage, index) => (
        nextProgress >= stage.at ? index : acc
      ), 0);

      setStageIndex(nextStageIndex);
    }, 50);

    const timeout = setTimeout(() => {
      onComplete();
    }, BOOT_DURATION_MS + 150);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [onComplete]);

  return (
    <div data-testid="shell-boot-screen" className="flex h-screen w-screen flex-col items-center justify-center bg-slate-950 text-white overflow-hidden relative">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(900px circle at 20% 20%, rgba(14,116,144,0.18), transparent 60%),' +
            'radial-gradient(700px circle at 80% 35%, rgba(34,211,238,0.12), transparent 60%),' +
            'linear-gradient(180deg, rgba(2,6,23,0.98), rgba(2,6,23,0.9))',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px), ' +
            'linear-gradient(90deg, rgba(148,163,184,0.5) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="mb-5 flex items-center gap-3">
          <Icon name="neon-wave" size={24} className="text-cyan-300" />
          <div className="text-left">
            <div className="text-lg font-semibold tracking-wide text-slate-100">RedByte</div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Digital Logic Workspace</div>
          </div>
        </div>

        <div className="text-xs text-slate-400 mb-6 min-h-[16px] font-mono">
          {stages[stageIndex].label}
        </div>

        <div className="w-72">
          <div className="h-[2px] rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-100 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="mt-3 text-[10px] uppercase tracking-[0.3em] text-slate-500">
          RedByte — Digital Logic Workspace
        </div>
      </div>
    </div>
  );
};

export default BootScreen;
