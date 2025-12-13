// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const ChipIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} {...props}>
    <rect x="7" y="7" width="10" height="10" rx="2" fill="url(#chipGradient)" />
    <path d="M10 10h4v4h-4z" strokeLinecap="round" />
    <path d="M12 4v3M12 20v-3M4 12h3M20 12h-3" strokeLinecap="round" />
    <path d="M6 4v3M6 17v3M18 4v3M18 17v3" strokeLinecap="round" />
    <path d="M4 6h3M17 6h3M4 18h3M17 18h3" strokeLinecap="round" />
    <defs>
      <linearGradient id="chipGradient" x1="7" y1="7" x2="17" y2="17" gradientUnits="userSpaceOnUse">
        <stop stopColor="#a855f7" stopOpacity="0.65" />
        <stop offset="1" stopColor="#22c55e" stopOpacity="0.8" />
      </linearGradient>
    </defs>
  </svg>
);
