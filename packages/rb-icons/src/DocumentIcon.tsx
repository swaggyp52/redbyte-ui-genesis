import React from 'react';

export const DocumentIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox='0 0 24 24' fill='currentColor' {...props}>
    <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z' />
    <path d='M14 2v6h6' fill='none' stroke='currentColor' strokeWidth='2' />
    <line x1='8' y1='13' x2='16' y2='13' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
    <line x1='8' y1='17' x2='16' y2='17' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
  </svg>
);
