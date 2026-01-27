// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const KeyboardIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <line x1="7" y1="10" x2="7" y2="10" strokeLinecap="round" />
    <line x1="11" y1="10" x2="11" y2="10" strokeLinecap="round" />
    <line x1="15" y1="10" x2="15" y2="10" strokeLinecap="round" />
    <line x1="19" y1="10" x2="19" y2="10" strokeLinecap="round" />
    <line x1="7" y1="14" x2="17" y2="14" strokeLinecap="round" />
  </svg>
);
