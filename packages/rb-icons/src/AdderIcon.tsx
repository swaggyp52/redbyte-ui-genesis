// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const AdderIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    {/* Adder box */}
    <rect x="4" y="4" width="16" height="16" rx="2" />
    {/* Plus symbol */}
    <path d="M12 8v8M8 12h8" strokeLinecap="round" strokeWidth={2} />
    {/* Sigma at bottom */}
    <text x="17" y="19" fontSize="4" fill="currentColor" stroke="none" opacity={0.6}>S</text>
  </svg>
);
