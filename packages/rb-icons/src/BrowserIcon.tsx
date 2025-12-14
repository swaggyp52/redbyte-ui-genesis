// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const BrowserIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox='0 0 24 24' fill='currentColor' {...props}>
    <rect x='2' y='3' width='20' height='18' rx='2' fill='none' stroke='currentColor' strokeWidth='2' />
    <line x1='2' y1='8' x2='22' y2='8' stroke='currentColor' strokeWidth='2' />
    <circle cx='6' cy='5.5' r='0.8' />
    <circle cx='8.5' cy='5.5' r='0.8' />
    <circle cx='11' cy='5.5' r='0.8' />
  </svg>
);
