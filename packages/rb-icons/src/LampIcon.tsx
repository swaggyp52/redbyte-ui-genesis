// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const LampIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    {/* Light bulb */}
    <path d="M9 18h6M10 21h4" strokeLinecap="round" />
    <path d="M12 2a7 7 0 0 0-4 12.65V17h8v-2.35A7 7 0 0 0 12 2z" strokeLinejoin="round" />
    {/* Light rays */}
    <path d="M12 2V1M4.22 4.22l-.7-.7M1 12H2M4.22 19.78l-.7.7M22 12h1M19.78 4.22l.7-.7M19.78 19.78l.7.7" strokeLinecap="round" strokeOpacity={0.5} />
  </svg>
);
