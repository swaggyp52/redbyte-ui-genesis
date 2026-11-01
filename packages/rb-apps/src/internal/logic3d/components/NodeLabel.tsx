// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { Html } from '@react-three/drei';

interface NodeLabelProps {
  position: [number, number, number];
  type: string;
  nodeId: string;
}

export const NodeLabel: React.FC<NodeLabelProps> = ({ position, type, nodeId }) => {
  // Position label above the node
  const labelPosition: [number, number, number] = [
    position[0],
    position[1] + 0.8,
    position[2],
  ];

  return (
    <Html position={labelPosition} center distanceFactor={8}>
      <div className="bg-gray-900/80 px-2 py-1 rounded text-xs text-white whitespace-nowrap border border-gray-700 backdrop-blur-sm pointer-events-none select-none">
        {type}
      </div>
    </Html>
  );
};
