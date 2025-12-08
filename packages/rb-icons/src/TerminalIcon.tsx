// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const TerminalIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox='0 0 24 24' fill='currentColor' {...props}>
    <rect x='3' y='4' width='18' height='16' rx='2' fill='none' stroke='currentColor' strokeWidth='2' />
    <path d='M7 9l3 3-3 3' stroke='currentColor' strokeWidth='2' fill='none' strokeLinecap='round' strokeLinejoin='round' />
    <line x1='12' y1='15' x2='17' y2='15' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
  </svg>
);
