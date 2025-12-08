import React from 'react';

export const NeonWaveIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    <defs>
      <linearGradient id="neonWave" x1="2" y1="12" x2="22" y2="12" gradientUnits="userSpaceOnUse">
        <stop stopColor="#22d3ee" />
        <stop offset="0.5" stopColor="#a855f7" />
        <stop offset="1" stopColor="#f97316" />
      </linearGradient>
    </defs>
    <path
      d="M3 14c2-4 4-4 6 0s4 4 6 0 4-4 6 0"
      stroke="url(#neonWave)"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <circle cx="5" cy="14" r="1" fill="#22d3ee" />
    <circle cx="11" cy="14" r="1" fill="#a855f7" />
    <circle cx="17" cy="14" r="1" fill="#f97316" />
  </svg>
);
