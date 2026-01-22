// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const FlipFlopIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    {/* D Flip-Flop box */}
    <rect x="4" y="4" width="16" height="16" rx="2" />
    {/* D label */}
    <text x="7" y="10" fontSize="5" fill="currentColor" stroke="none">D</text>
    {/* Clock triangle */}
    <path d="M4 14l3 -2 -3 -2" fill="none" />
    {/* Q output */}
    <text x="15" y="10" fontSize="5" fill="currentColor" stroke="none">Q</text>
    {/* Rising edge indicator */}
    <path d="M8 18l2-3 2 3" strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.6} />
  </svg>
);
