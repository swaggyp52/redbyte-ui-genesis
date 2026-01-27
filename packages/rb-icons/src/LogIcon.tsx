// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const LogIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="6" cy="7" r="1.5" />
    <circle cx="6" cy="12" r="1.5" />
    <circle cx="6" cy="17" r="1.5" />
    <line x1="10" y1="7" x2="20" y2="7" strokeLinecap="round" />
    <line x1="10" y1="12" x2="20" y2="12" strokeLinecap="round" />
    <line x1="10" y1="17" x2="20" y2="17" strokeLinecap="round" />
  </svg>
);
