import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '../../../..');

describe('ui:quality-gate', () => {
  it('theme default is still light', () => {
    const themePath = join(REPO_ROOT, 'packages/rb-theme/src/applyTheme.ts');
    if (existsSync(themePath)) {
      const content = readFileSync(themePath, 'utf-8');
      expect(content).toMatch(/default.*light|light.*default|'light'/);
    }
  });

  it('HomeApp includes StartHere card CSS classes', () => {
    const cssPath = join(REPO_ROOT, 'packages/rb-apps/src/apps/HomeApp.module.css');
    const content = readFileSync(cssPath, 'utf-8');
    expect(content).toContain('.startHere');
    expect(content).toContain('.startHereTitle');
    expect(content).toContain('.startHereActions');
  });

  it('HomeApp renders StartHere card in JSX', () => {
    const jsxPath = join(REPO_ROOT, 'packages/rb-apps/src/apps/HomeApp.tsx');
    const content = readFileSync(jsxPath, 'utf-8');
    expect(content).toContain('showExamplesFirst');
    expect(content).toContain('startHere');
    expect(content).toContain('Welcome to RedByte');
  });

  it('os-tokens.css has typography tokens', () => {
    const tokensPath = join(REPO_ROOT, 'packages/rb-apps/src/styles/os-tokens.css');
    const content = readFileSync(tokensPath, 'utf-8');
    expect(content).toContain('--rb-text-body');
    expect(content).toContain('--rb-text-section');
    expect(content).toContain('--rb-leading-normal');
    expect(content).toContain('--rb-weight-');
  });

  it('os-controls.css uses spacing tokens', () => {
    const controlsPath = join(REPO_ROOT, 'packages/rb-apps/src/styles/os-controls.css');
    const content = readFileSync(controlsPath, 'utf-8');
    expect(content).toContain('var(--rb-space-');
    // Verify no hardcoded padding like "0.5rem" or "1rem"
    const lines = content.split('\n');
    const badPadding = lines.filter(l =>
      /padding:\s*(0\.\d+rem|1rem)/.test(l)
    );
    expect(badPadding, `Found hardcoded padding without tokens`).toHaveLength(0);
  });

  it('SubmissionInspectorApp.module.css uses lab theme tokens', () => {
    const cssPath = join(REPO_ROOT, 'packages/rb-apps/src/apps/SubmissionInspectorApp.module.css');
    const content = readFileSync(cssPath, 'utf-8');
    // Check that it uses var(...) for colors instead of raw hex
    const lines = content.split('\n');
    const hexLines = lines.filter(l => {
      // Skip comments
      if (l.trim().startsWith('/*') || l.trim().startsWith('//')) return false;
      // Look for raw hex colors that are NOT inside var(--...)
      return /#[0-9a-fA-F]{3,8}/.test(l) && !l.includes('var(--');
    });
    expect(hexLines, `Found raw hex colors instead of tokens: ${hexLines.slice(0, 3).join('; ')}`).toHaveLength(0);
  });

  it('focus-visible enforcement in shell and app themes', () => {
    const shellPath = join(REPO_ROOT, 'packages/rb-shell/src/styles.css');
    const themePath = join(REPO_ROOT, 'packages/rb-apps/src/ui/theme.css');
    const shell = readFileSync(shellPath, 'utf-8');
    const theme = readFileSync(themePath, 'utf-8');
    expect(shell).toContain(':focus-visible');
    expect(theme).toContain(':focus-visible');
    expect(shell).toContain('outline');
  });

  it('a11y gate exists and validates contrast', () => {
    const aPath = join(REPO_ROOT, 'packages/rb-shell/src/__tests__/ui-a11y-contrast-gate.test.ts');
    expect(existsSync(aPath)).toBe(true);
    const content = readFileSync(aPath, 'utf-8');
    expect(content).toContain('WCAG');
    expect(content).toContain('contrastRatio');
  });

  it('package.json has ui quality gates registered', () => {
    const pkgPath = join(REPO_ROOT, 'package.json');
    const content = readFileSync(pkgPath, 'utf-8');
    expect(content).toContain('"ui:a11y-gate"');
    expect(content).toContain('"ui:style-token-contract-gate"');
  });

  it('verify:gates includes ui:a11y-gate', () => {
    const pkgPath = join(REPO_ROOT, 'package.json');
    const content = readFileSync(pkgPath, 'utf-8');
    const verifyLine = content.match(/"verify:gates":\s*"[^"]+"/)?.[0] ?? '';
    expect(verifyLine).toContain('ui:a11y-gate');
  });

  it('StartHere card has 3 action buttons', () => {
    const jsxPath = join(REPO_ROOT, 'packages/rb-apps/src/apps/HomeApp.tsx');
    const content = readFileSync(jsxPath, 'utf-8');
    // Check for the 3 button actions
    expect(content).toContain('logic-playground');
    expect(content).toContain('lab-workspace');
    expect(content).toContain('submission-inspector');
  });

  it('minimum font-size from token scale is >= 11px', () => {
    const tokensPath = join(REPO_ROOT, 'packages/rb-apps/src/styles/os-tokens.css');
    const content = readFileSync(tokensPath, 'utf-8');
    // All text-* tokens should be >= 11px (in pixel values)
    const textTokenLines = content.split('\n').filter(l => /--rb-text-/.test(l));
    const badSizes = textTokenLines.filter(l => {
      const match = /:\s*(\d+)px/.exec(l);
      if (!match) return false;
      const px = parseInt(match[1], 10);
      return px > 0 && px < 11;
    });
    expect(badSizes, 'Font size tokens below 11px found').toHaveLength(0);
  });
});
