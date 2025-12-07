import React from 'react';

export const LogicNandIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox='0 0 24 24' fill='currentColor' {...props}>
    {/* AND gate shape */}
    <path d='M4 4h6a6 6 0 0 1 0 12H4V4z' />
    {/* NOT bubble */}
    <circle cx='17' cy='12' r='1.5' fill='none' stroke='currentColor' strokeWidth='1.5' />
  </svg>
);
