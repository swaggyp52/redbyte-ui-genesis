export const uiColors = {
  bg: '#060912',
  bgSurface: '#0b1324',
  bgElevated: '#111c31',
  border: '#22324f',
  text: '#ecf4ff',
  textMuted: '#9cb2d6',
  accent: '#39d9ff',
  accentSoft: 'rgba(57, 217, 255, 0.16)',
  success: '#36d98a',
  warning: '#ffb347',
  danger: '#ff5d7a',
  info: '#6ea8ff',
} as const;

export const uiSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const uiRadii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const uiTypography = {
  body: 'var(--rb-font-sans)',
  mono: 'var(--rb-font-mono)',
  h1: 32,
  h2: 24,
  h3: 18,
  bodySize: 14,
  caption: 12,
} as const;

export const uiMotion = {
  fast: 150,
  normal: 200,
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;
