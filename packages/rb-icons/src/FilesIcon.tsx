// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const FilesIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} {...props}>
    <rect x="3" y="5" width="12" height="14" rx="2" ry="2" fill="url(#filesGradient)" />
    <path d="M9 3h5l3 3v13a2 2 0 0 1-2 2H9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 3v4h7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 9h6" strokeLinecap="round" />
    <path d="M7 13h8" strokeLinecap="round" />
    <path d="M7 17h5" strokeLinecap="round" />
    <defs>
      <linearGradient id="filesGradient" x1="3" y1="5" x2="16" y2="19" gradientUnits="userSpaceOnUse">
        <stop stopColor="#38bdf8" stopOpacity="0.4" />
        <stop offset="1" stopColor="#8b5cf6" stopOpacity="0.7" />
      </linearGradient>
    </defs>
  </svg>
);
