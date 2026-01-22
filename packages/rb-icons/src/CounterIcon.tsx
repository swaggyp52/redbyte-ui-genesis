// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const CounterIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    {/* Counter box */}
    <rect x="3" y="6" width="18" height="12" rx="2" />
    {/* 4-bit display segments */}
    <text x="5" y="15" fontSize="8" fontFamily="monospace" fill="currentColor" stroke="none">0101</text>
    {/* Clock input indicator */}
    <path d="M3 14l2 -1.5 -2 -1.5" fill="none" strokeOpacity={0.6} />
  </svg>
);
