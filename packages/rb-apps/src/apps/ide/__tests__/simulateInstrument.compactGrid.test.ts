import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * P2.5H Wave Four — the Simulate inner grid has one owner (`simulate-instrument.css`) at every
 * viewport, including 200% zoom on a laptop display (< 900 CSS px). The legacy `ide-root.css`
 * verify caps that fought it with `!important` are gone: their selectors no longer render.
 */
const ideRoot = resolve('packages/rb-apps/src/apps/ide');
const simulateCss = readFileSync(resolve(ideRoot, 'surfaces/verify/simulate-instrument.css'), 'utf8');
const rootCss = readFileSync(resolve(ideRoot, 'ide-root.css'), 'utf8');

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Bodies of every `@media (max-width: 899px)` block, brace-balanced. */
function compactBlocks(css: string): string[] {
  const blocks: string[] = [];
  const marker = '@media (max-width: 899px)';
  let from = 0;
  for (;;) {
    const at = css.indexOf(marker, from);
    if (at < 0) return blocks;
    const open = css.indexOf('{', at);
    let depth = 1;
    let i = open + 1;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      if (css[i] === '}') depth -= 1;
      i += 1;
    }
    blocks.push(css.slice(open + 1, i - 1));
    from = i;
  }
}

function ruleBody(css: string, selector: string): string {
  const at = css.indexOf(selector + ' {');
  expect(at, `rule for ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('Simulate inner grid — one owner at every viewport', () => {
  it('stacks the lab grid in one column under 900px with the splitter and evidence rows following the document', () => {
    const owners = compactBlocks(stripComments(simulateCss)).filter((block) => block.includes("grid-template-areas: 'cases'"));
    expect(owners, 'exactly one compact block owns the stacked template').toHaveLength(1);
    const template = owners[0].match(/\.rb-sim-lab-grid, [^{]*\{([^}]*)\}/)?.[1] ?? '';
    expect(template).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(template).toContain("grid-template-areas: 'cases' 'split' 'evidence' 'inspector'");
    expect(template).toContain('grid-template-rows: minmax(160px, 1fr) auto minmax(0, var(--rb-sim-evidence-fr)) minmax(0, 32%)');
  });

  it('keeps the collapsed and maximized deck variants in the same stacked row order', () => {
    const compact = compactBlocks(stripComments(simulateCss)).join('\n');
    expect(compact).toContain(".rb-sim-lab-grid[data-evidence-collapsed='true'] { grid-template-rows: minmax(160px, 1fr) auto 28px minmax(0, 32%); }");
    expect(compact).toContain(".rb-sim-lab-grid[data-evidence-maximized='cases'] { grid-template-rows: minmax(0, 1fr) auto 0 minmax(0, 32%); }");
    expect(compact).toContain(".rb-sim-lab-grid[data-evidence-maximized='waveform'] { grid-template-rows: 0 auto minmax(0, 1fr) minmax(0, 32%); }");
  });

  it('bounds the result region and guarantees the document a floor (182px up to 240px or 60%)', () => {
    const result = ruleBody(simulateCss, '.ide-root .rb-sim-region--result');
    expect(result).toContain('min-height: 0');
    expect(result).toContain('overflow: auto');
    const workspace = ruleBody(simulateCss, '.ide-root .rb-sim-workspace');
    expect(workspace).toContain('flex: 1 1 0');
    expect(workspace).toContain('min-height: clamp(182px, 60%, 240px)');
    // The shell's section-gap rule outranks the base panel rule, so the gap owner names the full path.
    const gapOwner = ruleBody(simulateCss, ".ide-root .ide-workbench-shell[data-ide-mode-marker='verify'] .ide-workbench-workspace > .rb-sim-panel > .ide-panel-body");
    expect(gapOwner).toContain('gap: 0');
  });
});

describe('ide-root.css — the retired verify layout owners are gone', () => {
  const root = stripComments(rootCss);

  it.each([
    'ide-verify-region--stimulus',
    'ide-verify-region--waveform',
    '.ide-verify-workspace',
    '.ide-verify-lab-grid',
    'ide-verify-oscilloscope-stage',
    'ide-verify-waveform-frame',
    'ide-verify-scope-header',
    'ide-verify-console-frame',
    'ide-workbench-dock-toggle-rail',
    // The Simulate panel carries `ide-verify-panel` as a test id, never as a class.
    '.ide-verify-panel',
    'ide-verify-status-strip',
    'ide-verify-stale-banner',
    'ide-verify-wrong-scenario-banner',
    'ide-verify-kit-tip',
  ])('has no rule for %s (no element renders it; the Case Lab grid owns the layout)', (token) => {
    const selectorUse = new RegExp(token.replace(/[.]/g, '\\.') + '(?![\\w-])');
    expect(selectorUse.test(root)).toBe(false);
  });

  it('does not cap the stimulus scroll with !important any more', () => {
    expect(root).not.toMatch(/\.ide-stimulus-grid-scroll\s*\{[^}]*min-height:[^;]*!important/);
  });

  it('keeps the !important count from growing back (ratchet after the Wave Four sweep)', () => {
    const count = (root.match(/!important/g) ?? []).length;
    expect(count).toBeLessThanOrEqual(3010);
  });
});

describe('simulate-instrument.css — re-homed drawer caps carry no !important', () => {
  it('states the supporting strip and drawer body limits as plain rules', () => {
    expect(simulateCss).toContain(".ide-root .ide-workbench-shell[data-ide-mode-marker='verify'] .ide-verify-supporting-strip:not(.is-open) { max-height: 38px; }");
    expect(simulateCss).toContain(".ide-root .ide-workbench-shell[data-ide-mode-marker='verify'] .ide-verify-drawer-body { max-height: min(34vh, 320px); }");
    expect(stripComments(simulateCss)).not.toContain('!important');
  });
});
