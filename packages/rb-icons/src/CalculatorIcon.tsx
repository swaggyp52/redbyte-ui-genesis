import React from 'react';

export const CalculatorIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox='0 0 24 24' fill='currentColor' {...props}>
    <rect x='4' y='2' width='16' height='20' rx='2' fill='none' stroke='currentColor' strokeWidth='2' />
    <rect x='6' y='5' width='12' height='4' rx='1' />
    <circle cx='8' cy='13' r='1' />
    <circle cx='12' cy='13' r='1' />
    <circle cx='16' cy='13' r='1' />
    <circle cx='8' cy='17' r='1' />
    <circle cx='12' cy='17' r='1' />
    <circle cx='16' cy='17' r='1' />
  </svg>
);
