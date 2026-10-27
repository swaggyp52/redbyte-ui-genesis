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
  /** Every area the desktop lab grid lays its regions into. */
  const usedAreas = () => {
    const desktop = ruleBody(stripComments(simulateCss), '.ide-root .rb-sim-lab-grid');
    return [...new Set([...(desktop.match(/grid-template-areas:([^;]*)/)?.[1] ?? '').matchAll(/[a-z-]+/g)].map((match) => match[0]))];
  };

  it('stacks the lab grid in one column under 900px and declares every area a region uses', () => {
    const owners = compactBlocks(stripComments(simulateCss)).filter((block) => block.includes("grid-template-areas: 'cases'"));
    expect(owners, 'exactly one compact block owns the stacked template').toHaveLength(1);
    const template = owners[0].match(/\.rb-sim-lab-grid, [^{]*\{([^}]*)\}/)?.[1] ?? '';
    expect(template).toContain('grid-template-columns: minmax(0, 1fr)');
    // The cases row takes its content (the time instrument with its lane floor); the workspace scrolls.
    expect(template).toContain('grid-template-rows: minmax(180px, auto)');
    // An area a region names but the template does not declare makes implicit tracks; at 720px
    // they took the whole width and the time instrument collapsed to 0px.
    const declared = template.match(/grid-template-areas:([^;]*)/)?.[1] ?? '';
    for (const area of usedAreas()) expect(declared, `compact template declares '${area}'`).toContain(`'${area}'`);
  });

  it('gives replay its own compact template without a cases row, and no deck variants remain', () => {
    const compact = compactBlocks(stripComments(simulateCss)).join('\n');
    const replay = compact.match(/\.rb-sim-lab-grid\[data-studio-mode='replay'\] \{([^}]*)\}/)?.[1] ?? '';
    expect(replay).toContain("grid-template-areas: 'evidence' 'inspector' 'result'");
    expect(replay).not.toContain("'cases'");
    // The resizable Cases/Evidence deck was replaced by one time instrument: no splitter row and
    // no collapsed or maximized deck variants are left to fight the template.
    expect(stripComments(simulateCss)).not.toMatch(/data-evidence-|'split'/);
  });

  it('bounds the result region and guarantees the document a floor', () => {
    const result = ruleBody(simulateCss, '.ide-root .rb-sim-region--result');
    expect(result).toContain('min-height: 0');
    expect(result).toContain('overflow: auto');
    const workspace = ruleBody(simulateCss, '.ide-root .rb-sim-workspace');
    expect(workspace).toContain('flex: 1 0 22rem');
    expect(workspace).toContain('min-height: 22rem');
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

  it('keeps the !important count from growing back (ratchet after the Wave Four sweeps)', () => {
    const count = (root.match(/!important/g) ?? []).length;
    expect(count).toBeLessThanOrEqual(2230);
  });
});

describe('simulate-instrument.css — Details owns its scrolling, with no !important', () => {
  it('leaves the drawer body uncapped inside the inspector, with nothing in ide-root.css forcing a height', () => {
    expect(stripComments(simulateCss)).toContain('.ide-root .rb-sim-inspector .ide-verify-drawer-body, .ide-root .rb-sim-inspector .ide-verify-tab-panel { flex: none; min-height: 0; max-height: none;');
    expect(stripComments(rootCss)).not.toMatch(/\.ide-verify-drawer-body[^{]*\{[^}]*max-height:[^;]*!important/);
    expect(stripComments(simulateCss)).not.toContain('!important');
  });
});
