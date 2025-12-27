// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { Html } from '@react-three/drei';

interface PortLabelProps {
  position: [number, number, number];
  portName: string;
  signalValue: 0 | 1;
  isOutput: boolean;
}

export const PortLabel: React.FC<PortLabelProps> = ({
  position,
  portName,
  signalValue,
  isOutput,
}) => {
  const valueColor = signalValue === 1 ? 'text-green-400' : 'text-gray-500';
  const bgColor = signalValue === 1 ? 'bg-green-500/10' : 'bg-gray-900/80';

  return (
    <Html position={position} center distanceFactor={10}>
      <div
        className={`${bgColor} px-1.5 py-0.5 rounded text-[10px] ${valueColor} whitespace-nowrap border border-gray-700/50 backdrop-blur-sm pointer-events-none select-none font-mono`}
      >
        {portName}: {signalValue}
      </div>
    </Html>
  );
};
