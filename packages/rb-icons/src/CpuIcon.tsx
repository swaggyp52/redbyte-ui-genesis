// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const CpuIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} {...props}>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="url(#cpuGradient)" />
    <rect x="10" y="10" width="4" height="4" rx="1" strokeLinecap="round" />
    {[2, 6, 10, 14].map((x) => (
      <line key={`t-${x}`} x1={x} y1={4} x2={x} y2={2} strokeLinecap="round" />
    ))}
    {[2, 6, 10, 14].map((x) => (
      <line key={`b-${x}`} x1={x} y1={22} x2={x} y2={20} strokeLinecap="round" />
    ))}
    {[2, 6, 10, 14].map((y) => (
      <line key={`l-${y}`} x1={4} y1={y} x2={2} y2={y} strokeLinecap="round" />
    ))}
    {[2, 6, 10, 14].map((y) => (
      <line key={`r-${y}`} x1={22} y1={y} x2={20} y2={y} strokeLinecap="round" />
    ))}
    <defs>
      <linearGradient id="cpuGradient" x1="6" y1="6" x2="18" y2="18" gradientUnits="userSpaceOnUse">
        <stop stopColor="#22d3ee" stopOpacity="0.6" />
        <stop offset="1" stopColor="#0ea5e9" stopOpacity="0.8" />
      </linearGradient>
    </defs>
  </svg>
);
