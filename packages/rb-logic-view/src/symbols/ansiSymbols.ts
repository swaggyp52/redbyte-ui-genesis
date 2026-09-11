import type { SymbolGeometry } from './portGeometry';

/**
 * ANSI / IEEE 91 distinctive-shape symbol outlines as SVG path data in LOCAL
 * (unscaled world) units, relative to the symbol origin. Rendered inside a
 * `<g transform="translate(screen) scale(zoom)">` so one path serves every
 * zoom level; strokes use `vector-effect: non-scaling-stroke`.
 */

export interface SymbolOutline {
  /** Main body path. */
  readonly d: string;
  /** Second outline stroke (the XOR/XNOR input arc), drawn unfilled. */
  readonly extra?: string;
  /** Inversion bubble centre + radius, when the symbol inverts its output. */
  readonly bubble?: { readonly cx: number; readonly cy: number; readonly r: number };
  /** Clock wedge (two lines) for register-style symbols. */
  readonly wedge?: string;
}

const f = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** AND: flat left edge, semicircular right edge. */
export function andPath(minX: number, minY: number, maxX: number, maxY: number): string {
  const h = maxY - minY;
  const r = h / 2;
  const flatRight = maxX - r;
  return `M ${f(minX)} ${f(minY)} H ${f(flatRight)} A ${f(r)} ${f(r)} 0 0 1 ${f(flatRight)} ${f(maxY)} H ${f(minX)} Z`;
}

/** OR: concave left arc, two convex sweeps meeting at the output point. */
export function orPath(minX: number, minY: number, maxX: number, maxY: number): string {
  const h = maxY - minY;
  const midY = (minY + maxY) / 2;
  const backCtrl = minX + h * 0.28;
  const w = maxX - minX;
  return [
    `M ${f(minX)} ${f(minY)}`,
    `Q ${f(backCtrl)} ${f(midY)} ${f(minX)} ${f(maxY)}`,
    `H ${f(minX + w * 0.42)}`,
    `C ${f(minX + w * 0.78)} ${f(maxY)} ${f(maxX - 4)} ${f(midY + h * 0.22)} ${f(maxX)} ${f(midY)}`,
    `C ${f(maxX - 4)} ${f(midY - h * 0.22)} ${f(minX + w * 0.78)} ${f(minY)} ${f(minX + w * 0.42)} ${f(minY)}`,
    'Z',
  ].join(' ');
}

/** XOR: OR shape plus a second parallel arc offset to the left. */
export function xorExtraArc(minX: number, minY: number, maxY: number): string {
  const h = maxY - minY;
  const midY = (minY + maxY) / 2;
  const x = minX - 6;
  return `M ${f(x)} ${f(minY)} Q ${f(x + h * 0.28)} ${f(midY)} ${f(x)} ${f(maxY)}`;
}

/** Triangle buffer / inverter. */
export function bufPath(minX: number, minY: number, maxX: number, maxY: number): string {
  const midY = (minY + maxY) / 2;
  return `M ${f(minX)} ${f(minY)} L ${f(maxX)} ${f(midY)} L ${f(minX)} ${f(maxY)} Z`;
}

/** Input port: pentagon pointing into the design (chevron on the right). */
export function ioInPath(minX: number, minY: number, maxX: number, maxY: number): string {
  const midY = (minY + maxY) / 2;
  const chev = (maxY - minY) / 2;
  return `M ${f(minX)} ${f(minY)} H ${f(maxX - chev)} L ${f(maxX)} ${f(midY)} L ${f(maxX - chev)} ${f(maxY)} H ${f(minX)} Z`;
}

/** Output port: pentagon with its chevron on the left. */
export function ioOutPath(minX: number, minY: number, maxX: number, maxY: number): string {
  const midY = (minY + maxY) / 2;
  const chev = (maxY - minY) / 2;
  return `M ${f(minX + chev)} ${f(minY)} H ${f(maxX)} V ${f(maxY)} H ${f(minX + chev)} L ${f(minX)} ${f(midY)} Z`;
}

export function rectPath(minX: number, minY: number, maxX: number, maxY: number): string {
  return `M ${f(minX)} ${f(minY)} H ${f(maxX)} V ${f(maxY)} H ${f(minX)} Z`;
}

/** Clock wedge drawn inside the body at a left-edge pin. */
export function clockWedge(bodyX: number, y: number, size = 6): string {
  return `M ${f(bodyX)} ${f(y - size)} L ${f(bodyX + size)} ${f(y)} L ${f(bodyX)} ${f(y + size)}`;
}

export function outlineFor(geometry: SymbolGeometry): SymbolOutline {
  const { minX, minY, maxX, maxY } = geometry.body;
  const out = geometry.pins.find((pin) => pin.direction === 'out');
  const bubble = out?.invert ? { cx: maxX + 4, cy: out.y, r: 4 } : undefined;
  switch (geometry.kind) {
    case 'and':
    case 'nand':
      return { d: andPath(minX, minY, maxX, maxY), bubble };
    case 'or':
    case 'nor':
      return { d: orPath(minX, minY, maxX, maxY), bubble };
    case 'xor':
    case 'xnor':
      return { d: orPath(minX, minY, maxX, maxY), extra: xorExtraArc(minX, minY, maxY), bubble };
    case 'not':
    case 'buf':
      return { d: bufPath(minX, minY, maxX, maxY), bubble };
    case 'io-in':
    case 'clock':
    case 'const':
      return { d: ioInPath(minX, minY, maxX, maxY) };
    case 'io-out':
      return { d: ioOutPath(minX, minY, maxX, maxY) };
    case 'register': {
      const clock = geometry.pins.find((pin) => pin.clock);
      return { d: rectPath(minX, minY, maxX, maxY), wedge: clock ? clockWedge(minX, clock.y) : undefined };
    }
    case 'module':
    case 'block':
    default: {
      const clock = geometry.pins.find((pin) => pin.clock);
      return { d: rectPath(minX, minY, maxX, maxY), wedge: clock ? clockWedge(minX, clock.y) : undefined };
    }
  }
}
