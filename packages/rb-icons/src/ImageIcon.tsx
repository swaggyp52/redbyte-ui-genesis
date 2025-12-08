// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const ImageIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox='0 0 24 24' fill='currentColor' {...props}>
    <rect x='3' y='3' width='18' height='18' rx='2' fill='none' stroke='currentColor' strokeWidth='2' />
    <circle cx='8.5' cy='8.5' r='2' />
    <path d='M3 16l5-5 4 4 5-5 4 4v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3z' opacity='0.5' />
  </svg>
);
