// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const ClockIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    {/* Clock circle */}
    <circle cx="12" cy="12" r="9" />
    {/* Clock hands */}
    <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
    {/* Pulse indicator at top */}
    <path d="M12 3V1" strokeLinecap="round" strokeOpacity={0.6} />
  </svg>
);
