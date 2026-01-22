// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const LatchIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    {/* Memory cell box */}
    <rect x="4" y="4" width="16" height="16" rx="2" />
    {/* RS labels */}
    <text x="7" y="10" fontSize="5" fill="currentColor" stroke="none">S</text>
    <text x="7" y="18" fontSize="5" fill="currentColor" stroke="none">R</text>
    <text x="15" y="10" fontSize="5" fill="currentColor" stroke="none">Q</text>
    {/* Feedback loop */}
    <path d="M14 14h2v-6h-2" strokeOpacity={0.5} />
  </svg>
);
