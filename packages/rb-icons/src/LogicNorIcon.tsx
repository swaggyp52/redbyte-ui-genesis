// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const LogicNorIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox='0 0 24 24' fill='currentColor' {...props}>
    {/* OR gate shape */}
    <path d='M4 4h6c5 0 9 6 0 12H4V4z' />
    {/* NOT bubble */}
    <circle cx='17' cy='12' r='1.5' fill='none' stroke='currentColor' strokeWidth='1.5' />
  </svg>
);
