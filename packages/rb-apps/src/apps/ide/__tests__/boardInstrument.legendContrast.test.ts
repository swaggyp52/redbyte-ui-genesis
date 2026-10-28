import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Board resource names are text a student reads to find SW3 or LD0. Every label state meets
 * 4.5:1 on both board planes and on its own state fill, in both themes, including resources
 * that cannot take the signal being assigned: the outline carries the state, never faint text.
 */
const here = dirname(fileURLToPath(import.meta.url));
const read = (file: string) => readFileSync(resolve(here, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const boardCss = read('../surfaces/hardware/board-instrument.css');
const schematicCss = read('../surfaces/design/design-schematic.css');
const productCss = read('../product-system-v3.css');
const boardView = readFileSync(resolve(here, '../components/Basys3BoardView.tsx'), 'utf8');

type Theme = { readonly board: string; readonly fallback: string; readonly product: string; readonly schematic: string };

function block(css: string, selector: RegExp): string {
  return css.match(selector)?.[1] ?? '';
}

// A theme's schematic block may list more selectors after the root one (the canvas appearance).
const LIGHT: Theme = {
  board: block(boardCss, /:root\[data-redbyte-mode='ide'\]\s*\{([\s\S]*?)\}/),
  fallback: '',
  product: block(productCss, /:root[^{]*\{([^}]*--rb-action:\s*#2563eb[^}]*)\}/),
  schematic: block(schematicCss, /:root\[data-redbyte-mode='ide'\]\s*(?:,[^{}]*)?\{([\s\S]*?)\}/),
};
const DARK: Theme = {
  board: block(boardCss, /:root\[data-redbyte-mode='ide'\]\[data-rb-theme='midnight'\]\s*\{([\s\S]*?)\}/),
  fallback: LIGHT.board,
  product: block(productCss, /\{([^}]*--rb-action:\s*#2e5fd0[^}]*)\}/),
  schematic: block(schematicCss, /\[data-rb-theme='midnight'\]\s*(?:,[^{}]*)?\{([\s\S]*?)\}/),
};

function declared(body: string, name: string): string | undefined {
  return body.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();
}

/** A token's colour as #rrggbb, resolving var() chains and the color-mix(in srgb, …) the board uses. */
function resolveColor(theme: Theme, value: string): string {
  const mix = value.match(/^color-mix\(in srgb,\s*(.+?)\s+(\d+)%,\s*(#[0-9a-f]{6})\)$/i);
  if (mix) {
    const [top, base] = [resolveColor(theme, mix[1]), mix[3]];
    const share = Number(mix[2]) / 100;
    return '#' + [1, 3, 5].map((index) => Math.round(parseInt(top.slice(index, index + 2), 16) * share
      + parseInt(base.slice(index, index + 2), 16) * (1 - share)).toString(16).padStart(2, '0')).join('');
  }
  const reference = value.match(/^var\((--[\w-]+)(?:,\s*(#[0-9a-f]{6}))?\)$/i);
  if (reference) {
    const found = declared(theme.board, reference[1]) ?? declared(theme.fallback, reference[1])
      ?? declared(theme.schematic, reference[1]) ?? declared(theme.product, reference[1]) ?? reference[2];
    if (!found) throw new Error(`${reference[1]} is not declared`);
    return resolveColor(theme, found);
  }
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`Unresolved colour ${value}`);
  return value.toLowerCase();
}

const token = (theme: Theme, name: string) => resolveColor(theme, `var(${name})`);

function contrast(a: string, b: string): number {
  const luminance = (hex: string) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Each label state and the fills it is drawn over, besides the two planes. */
const LABEL_STATES = [
  { label: '--rb-board-label', fills: ['--rb-board-idle-fill'] },
  { label: '--rb-board-ink', fills: ['--rb-board-mapped-fill', '--rb-board-available-fill'] },
  { label: '--rb-board-selected-label', fills: ['--rb-board-selected-fill'] },
  { label: '--rb-board-conflict-label', fills: ['--rb-board-conflict-fill'] },
  { label: '--rb-board-unavailable-label', fills: [] },
];

describe('board legend contrast', () => {
  it('draws every label state from its own label token', () => {
    const body = boardView.match(/function labelFill[\s\S]*?\n\}/)?.[0] ?? '';
    for (const { label } of LABEL_STATES.filter(({ label }) => label !== '--rb-board-ink' && label !== '--rb-board-label')) {
      expect(body).toContain(`var(${label})`);
    }
    expect(body).not.toMatch(/-stroke\)/);
  });

  it.each([['light', LIGHT], ['dark', DARK]] as const)('keeps every resource name readable on the %s board', (_name, theme) => {
    expect(theme.board.length > 0 && theme.product.length > 0 && theme.schematic.length > 0).toBe(true);
    const planes = [token(theme, '--rb-board-plane'), token(theme, '--rb-board-plane-2')];
    for (const { label, fills } of LABEL_STATES) {
      const ink = token(theme, label);
      for (const backdrop of [...planes, ...fills.map((fill) => token(theme, fill))]) {
        expect(contrast(ink, backdrop), `${label} ${ink} on ${backdrop}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
