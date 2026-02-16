import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '../../../..');

/**
 * Relative luminance per WCAG 2.0
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('ui:a11y-contrast-gate', () => {
  it('light theme primary text on background meets WCAG AA (>= 4.5:1)', () => {
    // Light theme: --rb-text (#1C1917) on --rb-surface-0 (#FAFAF8)
    const ratio = contrastRatio('#1C1917', '#FAFAF8');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('light theme secondary text on background meets WCAG AA (>= 4.5:1)', () => {
    // Light theme: --rb-text-2 (#57534E) on --rb-surface-0 (#FAFAF8)
    const ratio = contrastRatio('#57534E', '#FAFAF8');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('light theme accent on background meets WCAG AA for large text (>= 3:1)', () => {
    // Light theme: --rb-accent (#B47A09) on --rb-surface-0 (#FAFAF8)
    const ratio = contrastRatio('#B47A09', '#FAFAF8');
    expect(ratio).toBeGreaterThanOrEqual(3.0);
  });

  it('dark theme primary text on background meets WCAG AA (>= 4.5:1)', () => {
    // Dark theme: --rb-text (#E6EDF3) on --rb-surface-0 (#070B14)
    const ratio = contrastRatio('#E6EDF3', '#070B14');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('lab theme text on background meets WCAG AA (>= 4.5:1)', () => {
    // Lab theme: --rb-ui-lab-text (#ecf4ff) on --rb-ui-lab-bg (#060912)
    const ratio = contrastRatio('#ecf4ff', '#060912');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('no font-size below 11px in os-tokens.css', () => {
    const tokensPath = join(REPO_ROOT, 'packages/rb-apps/src/styles/os-tokens.css');
    const content = readFileSync(tokensPath, 'utf-8');
    // Find only font/text/size related tokens (not spacing tokens)
    const lines = content.split('\n');
    const fontLines = lines.filter(line =>
      /--rb-(text|font|size|leading|weight)/.test(line)
    );
    const tooSmall = fontLines.filter(line => {
      const match = /:\s*(\d+)px/.exec(line);
      if (!match) return false;
      const px = parseInt(match[1], 10);
      return px > 0 && px < 11;
    });
    expect(tooSmall, `Font sizes below 11px found: ${tooSmall.map(l => l.trim()).join(', ')}`).toHaveLength(0);
  });

  it('focus-visible rules exist in shell styles', () => {
    const stylesPath = join(REPO_ROOT, 'packages/rb-shell/src/styles.css');
    const content = readFileSync(stylesPath, 'utf-8');
    expect(content).toContain(':focus-visible');
    expect(content).toContain('outline');
  });

  it('focus-visible rules exist in lab theme', () => {
    const themePath = join(REPO_ROOT, 'packages/rb-apps/src/ui/theme.css');
    const content = readFileSync(themePath, 'utf-8');
    expect(content).toContain(':focus-visible');
  });
});
