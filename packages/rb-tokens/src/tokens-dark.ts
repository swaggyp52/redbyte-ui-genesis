// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { RBTokens } from './types';

export const tokensDarkNeon: RBTokens = {
  color: {
    accent: {
      50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3',
      300: '#fda4af', 400: '#fb7185', 500: '#f43f5e',
      600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337',
    },
    neutral: {
      50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0',
      300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b',
      600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a',
    },
    success: {
      50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0',
      300: '#86efac', 400: '#4ade80', 500: '#22c55e',
      600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d',
    },
    warning: {
      50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a',
      300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b',
      600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f',
    },
    error: {
      50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca',
      300: '#fca5a5', 400: '#f87171', 500: '#ef4444',
      600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d',
    },
    info: {
      50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe',
      300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6',
      600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a',
    },
  },
  radius: {
    none: '0', sm: '0.125rem', md: '0.375rem', lg: '0.5rem',
    xl: '0.75rem', '2xl': '1rem', '3xl': '1.5rem', full: '9999px',
  },
  shadow: {
    none: 'none',
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  },
  spacing: {
    0: '0', 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem',
    5: '1.25rem', 6: '1.5rem', 7: '1.75rem', 8: '2rem', 9: '2.25rem',
    10: '2.5rem', 12: '3rem', 16: '4rem', 20: '5rem', 24: '6rem',
    32: '8rem', 40: '10rem', 48: '12rem', 56: '14rem', 64: '16rem',
  },
  typography: {
    fontFamily: {
      sans: 'system-ui, sans-serif',
      serif: 'Georgia, serif',
      mono: 'ui-monospace, monospace',
    },
    fontSize: {
      xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem',
      xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem',
      '4xl': '2.25rem', '5xl': '3rem', '6xl': '3.75rem',
    },
    fontWeight: {
      thin: '100', light: '300', normal: '400', medium: '500',
      semibold: '600', bold: '700', extrabold: '800', black: '900',
    },
    lineHeight: {
      none: '1', tight: '1.25', snug: '1.375',
      normal: '1.5', relaxed: '1.625', loose: '2',
    },
    letterSpacing: {
      tighter: '-0.05em', tight: '-0.025em', normal: '0',
      wide: '0.025em', wider: '0.05em', widest: '0.1em',
    },
  },
  motion: {
    duration: {
      instant: '50ms', fast: '150ms', normal: '250ms',
      slow: '400ms', slower: '600ms',
    },
    easing: {
      linear: 'linear',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },
};
