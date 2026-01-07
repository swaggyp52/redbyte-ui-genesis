// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useState } from 'react';
import { NeonWaveIcon } from '@redbyte/rb-icons';

interface BootScreenProps {
  onComplete: () => void;
}

const BootScreen: React.FC<BootScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);

  const stages = [
    'Initializing system',
    'Loading components',
    'Starting workspace',
    'Ready',
  ];

  useEffect(() => {
    // Faster boot: 1.5s instead of 3s
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) return 100;
        const newProgress = p + 6.67; // 100% / 15 ticks = ~1.5s

        // Update stage based on progress
        if (newProgress >= 75) setStage(3);
        else if (newProgress >= 50) setStage(2);
        else if (newProgress >= 25) setStage(1);

        return newProgress;
      });
    }, 100);

    const timeout = setTimeout(() => {
      onComplete();
    }, 1600); // Faster completion

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [onComplete]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-950 text-white overflow-hidden relative">
      {/* Subtle grid background - no animation */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(#00ffff 1px, transparent 1px), linear-gradient(90deg, #00ffff 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />

      {/* Logo and title */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-6">
          <NeonWaveIcon width={64} height={64} className="text-cyan-400" />
        </div>

        <h1 className="text-4xl font-bold mb-1 text-white">
          RedByte OS
        </h1>
        <p className="text-sm text-slate-500 tracking-wide mb-10">Digital Logic Workspace</p>

        {/* Status */}
        <div className="text-xs text-slate-400 mb-4 min-h-[16px] font-mono">
          {stages[stage]}
        </div>

        {/* Progress bar - simple, clean */}
        <div className="w-80 h-1 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-cyan-500 transition-all duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default BootScreen;
