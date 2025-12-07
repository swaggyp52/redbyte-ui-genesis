import React from 'react';

export const LogicXnorIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox='0 0 24 24' fill='currentColor' {...props}>
    {/* XOR gate shape with double curve */}
    <path d='M4 4h6c5 0 9 6 0 12H4V4z' opacity='0.5' />
    <path d='M6 4h6c5 0 9 6 0 12H6V4z' />
    {/* NOT bubble */}
    <circle cx='17' cy='12' r='1.5' fill='none' stroke='currentColor' strokeWidth='1.5' />
  </svg>
);
