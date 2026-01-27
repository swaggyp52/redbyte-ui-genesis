// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { tokensDarkNeon, tokensLightFrost, tokensToCSSVariables } from '@redbyte/rb-tokens';

export type ThemeVariant = 'redbyte-dark' | 'instrument' | 'system';

function resolveThemeVariant(variant: ThemeVariant): 'redbyte-dark' | 'instrument' {
  if (variant === 'system') {
    if (typeof window === 'undefined') return 'redbyte-dark';
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'instrument' : 'redbyte-dark';
  }
  return variant;
}

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  const int = parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export function applyTheme(root: HTMLElement, variant: ThemeVariant): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const resolved = resolveThemeVariant(variant);
  const tokens = resolved === 'redbyte-dark' ? tokensDarkNeon : tokensLightFrost;
  const cssVars = tokensToCSSVariables(tokens);

  Object.entries(cssVars).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });

  const accent = tokens.color.accent[500];
  const surface =
    resolved === 'redbyte-dark'
      ? {
          bg: '#05070f',
          panel: '#0c1324',
          panel2: '#111b31',
          border: 'rgba(148,163,184,0.22)',
          borderStrong: 'rgba(148,163,184,0.36)',
          text: 'rgba(226,232,240,0.92)',
          muted: 'rgba(226,232,240,0.62)',
          faint: 'rgba(226,232,240,0.42)',
        }
      : {
          bg: '#0c1116',
          panel: '#111a23',
          panel2: '#172230',
          border: 'rgba(148,163,184,0.28)',
          borderStrong: 'rgba(148,163,184,0.44)',
          text: 'rgba(226,232,240,0.94)',
          muted: 'rgba(226,232,240,0.68)',
          faint: 'rgba(226,232,240,0.48)',
        };

  root.style.setProperty('--rb-bg', surface.bg);
  root.style.setProperty('--rb-panel', surface.panel);
  root.style.setProperty('--rb-panel-2', surface.panel2);
  root.style.setProperty('--rb-border', surface.border);
  root.style.setProperty('--rb-border-strong', surface.borderStrong);
  root.style.setProperty('--rb-text', surface.text);
  root.style.setProperty('--rb-muted', surface.muted);
  root.style.setProperty('--rb-faint', surface.faint);
  root.style.setProperty('--rb-accent', accent);
  root.style.setProperty('--rb-accent-weak', hexToRgba(accent, 0.18));
  root.style.setProperty('--rb-accent-strong', hexToRgba(accent, 0.32));
  root.style.setProperty('--rb-warn-bg', hexToRgba(tokens.color.warning[500], 0.14));
  root.style.setProperty('--rb-warn-border', hexToRgba(tokens.color.warning[500], 0.35));
  root.style.setProperty('--rb-danger-bg', hexToRgba(tokens.color.error[500], 0.14));
  root.style.setProperty('--rb-danger-border', hexToRgba(tokens.color.error[500], 0.35));
  root.style.setProperty('--rb-shadow-sm', tokens.shadow.md);
  root.style.setProperty('--rb-shadow-md', tokens.shadow.lg);
  root.style.setProperty('--rb-radius-sm', tokens.radius.sm);
  root.style.setProperty('--rb-radius-md', tokens.radius.lg);
  root.style.setProperty('--rb-radius-lg', tokens.radius['2xl']);
  root.style.setProperty('--rb-font-sans', tokens.typography.fontFamily.sans);
  root.style.setProperty('--rb-font-mono', tokens.typography.fontFamily.mono);
  root.style.setProperty('--rb-font-family-body', tokens.typography.fontFamily.sans);

  // Visual utility variables
  const glowColor = hexToRgba(accent, resolved === 'redbyte-dark' ? 0.35 : 0.28);
  root.style.setProperty('--rb-effect-glow', `0 0 24px ${glowColor}`);
  root.style.setProperty(
    '--rb-effect-glass',
    resolved === 'redbyte-dark' ? 'rgba(12,18,34,0.7)' : 'rgba(18,26,38,0.66)'
  );
  // Material system surfaces
  root.style.setProperty('--rb-surface-0', surface.bg);
  root.style.setProperty('--rb-surface-1', surface.panel);
  root.style.setProperty('--rb-surface-2', surface.panel2);
  root.style.setProperty('--rb-surface-3', resolved === 'redbyte-dark' ? '#162038' : '#1a2434');
  root.style.setProperty(
    '--rb-glass',
    resolved === 'redbyte-dark' ? 'rgba(8, 14, 26, 0.72)' : 'rgba(12, 18, 30, 0.72)'
  );
  root.style.setProperty(
    '--rb-metal',
    resolved === 'redbyte-dark' ? 'rgba(12, 18, 32, 0.9)' : 'rgba(18, 26, 38, 0.9)'
  );
  root.style.setProperty('--rb-shadow-1', '0 12px 28px rgba(0, 0, 0, 0.35)');
  root.style.setProperty('--rb-shadow-2', '0 18px 44px rgba(0, 0, 0, 0.45)');
  root.style.setProperty('--rb-shadow-3', '0 28px 70px rgba(0, 0, 0, 0.6)');
  root.style.setProperty('--rb-motion-fast', tokens.motion.duration.fast);
  root.style.setProperty('--rb-motion-normal', tokens.motion.duration.normal);
  root.style.setProperty('--rb-motion-slow', tokens.motion.duration.slow);
  root.style.setProperty('--rb-easing-out', tokens.motion.easing.out);
  root.style.setProperty('--rb-noise-opacity', resolved === 'redbyte-dark' ? '0.05' : '0.04');
  root.style.setProperty('--rb-theme-foreground', surface.text);
  root.style.setProperty('--rb-theme-background', surface.bg);

  root.setAttribute('data-rb-theme', resolved);

  try {
    localStorage.setItem('rb-theme-variant', variant);
  } catch {}
}

export function getActiveTheme(): ThemeVariant | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  try {
    const stored = localStorage.getItem('rb-theme-variant');
    if (stored === 'redbyte-dark' || stored === 'instrument' || stored === 'system') return stored;
  } catch {}

  return null;
}
