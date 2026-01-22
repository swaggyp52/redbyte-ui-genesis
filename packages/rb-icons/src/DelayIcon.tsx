// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const DelayIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    {/* Timer/stopwatch body */}
    <circle cx="12" cy="13" r="8" />
    {/* Top button */}
    <path d="M12 5V2M10 2h4" strokeLinecap="round" />
    {/* Delay arrows */}
    <path d="M12 9v4l2 2" strokeLinecap="round" strokeLinejoin="round" />
    {/* Delta symbol inside */}
    <path d="M8 17l4-6 4 6" strokeOpacity={0.4} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
