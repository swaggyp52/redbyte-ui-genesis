// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const LogicIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} {...props}>
    <path d="M4 6h8l4 3v6l-4 3H4z" fill="url(#logicGradient)" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6" cy="9" r="1.5" fill="#0ea5e9" />
    <circle cx="6" cy="15" r="1.5" fill="#a855f7" />
    <circle cx="17" cy="12" r="1.5" fill="#22d3ee" />
    <path d="M6 9h6M6 15h6M14 12h3" strokeLinecap="round" />
    <defs>
      <linearGradient id="logicGradient" x1="4" y1="6" x2="18" y2="18" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0f172a" stopOpacity="0.7" />
        <stop offset="1" stopColor="#1e293b" stopOpacity="0.9" />
      </linearGradient>
    </defs>
  </svg>
);
