// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const OutputPortIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    {/* Port box */}
    <rect x="3" y="6" width="7" height="12" rx="1" />
    {/* Arrow pointing right out of box */}
    <path d="M11 12h10M17 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
