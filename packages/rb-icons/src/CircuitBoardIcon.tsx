// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const CircuitBoardIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <circle cx="8" cy="8" r="1.2" />
    <circle cx="16" cy="8" r="1.2" />
    <circle cx="8" cy="16" r="1.2" />
    <path d="M8 9.5v5" strokeLinecap="round" />
    <path d="M9.5 8h5" strokeLinecap="round" />
    <path d="M16 9.5v3" strokeLinecap="round" />
    <path d="M13 16h4" strokeLinecap="round" />
  </svg>
);
