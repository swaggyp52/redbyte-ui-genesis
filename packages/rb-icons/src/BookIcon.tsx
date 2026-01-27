// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export const BookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M4 6.5c0-1.1.9-2 2-2h6v15H6a2 2 0 0 0-2 2V6.5z" />
    <path d="M20 6.5c0-1.1-.9-2-2-2h-6v15h6a2 2 0 0 1 2 2V6.5z" />
    <line x1="12" y1="4.5" x2="12" y2="19.5" />
  </svg>
);
