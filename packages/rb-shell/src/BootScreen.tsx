import React, { useEffect, useState } from 'react';
import { NeonWaveIcon, PowerButtonIcon } from '@rb/rb-icons';

interface BootScreenProps {
  onComplete: () => void;
}

const BootScreen: React.FC<BootScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) return 100;
        return p + 5;
      });
    }, 120);

    const timeout = setTimeout(() => {
      onComplete();
    }, 2600);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [onComplete]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-black text-white">
      <div className="flex items-center gap-3 text-2xl font-semibold tracking-wide">
        <NeonWaveIcon width={42} height={42} />
        RedByte OS Genesis
      </div>
      <div className="mt-6 flex items-center gap-3 text-sm text-cyan-300">
        <PowerButtonIcon width={20} height={20} /> Initializing Logic Engine…
      </div>
      <div className="mt-6 h-3 w-64 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-orange-400 transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default BootScreen;
