// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useState } from 'react';
import { NeonWaveIcon, PowerButtonIcon } from '@redbyte/rb-icons';

interface BootScreenProps {
  onComplete: () => void;
}

const BootScreen: React.FC<BootScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);

  const stages = [
    'Initializing kernel...',
    'Loading runtime...',
    'Mounting filesystem...',
    'Starting logic engine...',
    'Ready',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) return 100;
        const newProgress = p + 3.5;

        // Update stage based on progress
        if (newProgress >= 80) setStage(4);
        else if (newProgress >= 60) setStage(3);
        else if (newProgress >= 40) setStage(2);
        else if (newProgress >= 20) setStage(1);

        return newProgress;
      });
    }, 100);

    const timeout = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [onComplete]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white overflow-hidden relative">
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(#00ffff 1px, transparent 1px), linear-gradient(90deg, #00ffff 1px, transparent 1px)',
          backgroundSize: '50px 50px',
          animation: 'gridSlide 20s linear infinite'
        }} />
      </div>

      {/* Floating orbs in background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s', animationDuration: '5s' }} />
      </div>

      {/* Logo and title */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-8 relative">
          <div className="absolute inset-0 blur-2xl bg-cyan-500/30 animate-pulse" />
          <NeonWaveIcon width={84} height={84} className="relative" />
        </div>

        <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
          RedByte OS
        </h1>
        <p className="text-lg text-gray-400 tracking-widest mb-12">GENESIS</p>

        {/* Status */}
        <div className="flex items-center gap-3 text-sm text-cyan-300 mb-6 min-h-[24px]">
          <PowerButtonIcon width={16} height={16} className="animate-pulse" />
          <span className="font-mono">{stages[stage]}</span>
        </div>

        {/* Progress bar */}
        <div className="w-96 h-2 rounded-full bg-white/5 overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 transition-all duration-200 relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
        </div>

        {/* Progress percentage */}
        <div className="mt-3 text-xs font-mono text-gray-500">
          {Math.floor(progress)}%
        </div>
      </div>

      <style>{`
        @keyframes gridSlide {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default BootScreen;
