// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { Edges } from '@react-three/drei';

interface SelectionGlowProps {
  isSelected: boolean;
  isHovered: boolean;
}

export const SelectionGlow: React.FC<SelectionGlowProps> = ({ isSelected, isHovered }) => {
  if (!isSelected && !isHovered) return null;

  const color = isSelected ? '#D4930D' : '#22D3EE'; // Amber for selected, teal for hover
  const scale = isSelected ? 1.15 : 1.08;
  const linewidth = isSelected ? 3 : 2;

  return (
    <Edges
      scale={scale}
      threshold={15}
      color={color}
      linewidth={linewidth}
    />
  );
};
