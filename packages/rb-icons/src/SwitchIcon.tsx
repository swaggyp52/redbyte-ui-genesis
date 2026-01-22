// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const SwitchIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    {/* Toggle switch body */}
    <rect x="3" y="8" width="18" height="8" rx="4" strokeLinecap="round" />
    {/* Toggle circle (ON position) */}
    <circle cx="16" cy="12" r="2.5" fill="currentColor" />
  </svg>
);
