import type { Basys3BoardResource } from '@redbyte/rb-apps/domain';
import type { BoardBinding } from '@redbyte/rb-studio-kernel';

/**
 * The Basys3 drawing model. Positions come only from the board catalog's own coordinates
 * (`visualCoordinate`), and a resource is marked as carrying a signal only through the
 * resolver's binding (the project's XDC alias or package pin), cross-checked against the
 * catalog's package pin. Labels are placed so each one reads as belonging to its own part: a
 * pushbutton label sits outside the D-pad, on the side of its button; switch and LED labels
 * drop a repeated resource name, stagger on two levels and stay inside the board.
 */
export type BoardCategory = 'switch' | 'led' | 'button';

export interface MappedLabel {
  readonly x: number;
  readonly y: number;
  readonly anchor: 'start' | 'middle' | 'end';
  /** The text drawn (the signal, minus a repeated resource name; shortened only if it cannot fit). */
  readonly text: string;
  /** A 1px leader from the part to the label, when the label cannot sit beside the part. */
  readonly leader: readonly [number, number, number, number] | null;
}

export interface BoardPart {
  readonly alias: string;
  readonly category: BoardCategory;
  readonly x: number;
  readonly y: number;
  readonly packagePin: string;
  /** The catalog's own name for the part (e.g. "Center pushbutton BTNC"). */
  readonly name: string;
  readonly mapped: { readonly nodeId: string; readonly signal: string; readonly label: MappedLabel } | null;
}

export interface BoardModel {
  readonly parts: readonly BoardPart[];
  readonly clock: { readonly nodeId: string; readonly signal: string } | null;
  /** Bindings to resources this drawing does not place (e.g. seven-segment), named in the legend. */
  readonly unplaced: readonly BoardBinding[];
  /** Bindings whose package pin disagrees with the catalog: never drawn as mapped. */
  readonly mismatched: readonly BoardBinding[];
}

export interface BoundNode {
  readonly nodeId: string;
  readonly signal: string;
  readonly binding: BoardBinding;
}

/** Part extents used for drawing and for the label clearance check (board units). */
export const PART_EXTENT: Readonly<Record<BoardCategory, { readonly w: number; readonly h: number }>> = {
  led: { w: 14, h: 14 },
  switch: { w: 12, h: 24 },
  button: { w: 22, h: 22 },
};
/** The board plane labels must stay inside (viewBox 620 × 260, plane inset 4, plus a margin). */
export const BOARD_PLANE = { minX: 8, maxX: 612, minY: 4, maxY: 256 } as const;
/** 13.5px bold mono silk: 0.6em per glyph. */
const GLYPH = 8.1;
const GAP = 4;

/** Approximate label box, for layout and clearance checks. */
export function labelBox(label: Pick<MappedLabel, 'x' | 'y' | 'anchor'>, text: string): { minX: number; minY: number; maxX: number; maxY: number } {
  const width = text.length * GLYPH;
  const minX = label.anchor === 'start' ? label.x : label.anchor === 'end' ? label.x - width : label.x - width / 2;
  return { minX, minY: label.y - 10, maxX: minX + width, maxY: label.y + 2 };
}

export function partBox(part: Pick<BoardPart, 'x' | 'y' | 'category'>): { minX: number; minY: number; maxX: number; maxY: number } {
  const extent = PART_EXTENT[part.category];
  return { minX: part.x - extent.w / 2, minY: part.y - extent.h / 2, maxX: part.x + extent.w / 2, maxY: part.y + extent.h / 2 };
}

/**
 * The part already prints its resource (LD0, SW0): a signal named "LD0 (CARRY)" or
 * "A0 (SW0)" labels it "CARRY" / "A0". A signal that is only the resource name keeps it.
 */
export function boardLabelText(signal: string, alias: string): string {
  const name = signal.trim();
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const inner = new RegExp(`^${escaped}\\s*[(\\[]\\s*(.+?)\\s*[)\\]]$`, 'i').exec(name)?.[1]
    ?? new RegExp(`^(.+?)\\s*[(\\[]\\s*${escaped}\\s*[)\\]]$`, 'i').exec(name)?.[1];
  return inner?.trim() || name;
}

function buttonLabel(x: number, y: number, centre: { x: number; y: number }, text: string): MappedLabel {
  const dx = x - centre.x;
  const dy = y - centre.y;
  if (dx === 0 && dy === 0) {
    // The centre button: a short leader out between the up and left buttons.
    return { x: x - 37, y: y - 31, anchor: 'end', text, leader: [x - 8, y - 8, x - 34, y - 34] };
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx < 0 ? { x: x - 16, y: y + 5, anchor: 'end', text, leader: null } : { x: x + 16, y: y + 5, anchor: 'start', text, leader: null };
  }
  // The down button sits just above the switch row: its label goes below-right, not under it.
  return dy < 0 ? { x, y: y - 16, anchor: 'middle', text, leader: null } : { x: x + 16, y: y + 9, anchor: 'start', text, leader: null };
}

/**
 * One row of LED or switch labels: each centred on its part, on the first of two levels where
 * it clears its neighbours, clamped inside the board. A label that fits nowhere is shortened
 * (the full name stays in the part's title and the legend).
 */
function layoutRow(entries: readonly { alias: string; x: number; text: string }[], levels: readonly number[]): Map<string, MappedLabel> {
  const placed: { minX: number; maxX: number }[][] = levels.map(() => []);
  const result = new Map<string, MappedLabel>();
  const fits = (level: number, minX: number, maxX: number) => placed[level].every((box) => maxX + GAP <= box.minX || minX >= box.maxX + GAP);
  const span = (x: number, text: string) => {
    const width = text.length * GLYPH;
    const minX = Math.min(Math.max(x - width / 2, BOARD_PLANE.minX), BOARD_PLANE.maxX - width);
    return { minX, maxX: minX + width };
  };
  for (const entry of [...entries].sort((a, b) => a.x - b.x)) {
    let text = entry.text;
    let level = -1;
    for (;;) {
      const box = span(entry.x, text);
      level = levels.findIndex((_y, index) => fits(index, box.minX, box.maxX));
      if (level >= 0 || text.length <= 2) break;
      text = `${text.slice(0, Math.max(1, text.length - 2))}…`;
    }
    const chosen = level >= 0 ? level : 0;
    const box = span(entry.x, text);
    placed[chosen].push(box);
    result.set(entry.alias, { x: (box.minX + box.maxX) / 2, y: levels[chosen], anchor: 'middle', text, leader: null });
  }
  return result;
}

export function buildBoardModel(resources: readonly Basys3BoardResource[], bound: readonly BoundNode[]): BoardModel {
  const byAlias = new Map(resources.map((resource) => [resource.alias.toUpperCase(), resource] as const));
  const mappedByAlias = new Map<string, BoundNode>();
  const unplaced: BoardBinding[] = [];
  const mismatched: BoardBinding[] = [];
  let clock: BoardModel['clock'] = null;
  for (const entry of bound) {
    const resource = byAlias.get(entry.binding.name.toUpperCase());
    if (!resource || (entry.binding.packagePin && resource.packagePin !== entry.binding.packagePin)) {
      mismatched.push(entry.binding);
      continue;
    }
    if (resource.category === 'clock') {
      clock = { nodeId: entry.nodeId, signal: entry.signal };
      continue;
    }
    if (!resource.visualCoordinate || !['switch', 'led', 'button'].includes(resource.category)) {
      unplaced.push(entry.binding);
      continue;
    }
    mappedByAlias.set(resource.alias.toUpperCase(), entry);
  }
  const placed = resources.filter((resource) => resource.visualCoordinate && ['switch', 'led', 'button'].includes(resource.category));
  const buttons = placed.filter((resource) => resource.category === 'button');
  const centreButton = buttons.find((resource) => resource.alias.toUpperCase() === 'BTNC');
  const centre = centreButton
    ? { x: centreButton.visualCoordinate!.x, y: centreButton.visualCoordinate!.y }
    : {
        x: buttons.reduce((sum, resource) => sum + resource.visualCoordinate!.x, 0) / Math.max(1, buttons.length),
        y: buttons.reduce((sum, resource) => sum + resource.visualCoordinate!.y, 0) / Math.max(1, buttons.length),
      };
  const rowLabels = (category: 'led' | 'switch', levels: (y: number) => number[]) => {
    const row = placed.filter((resource) => resource.category === category && mappedByAlias.has(resource.alias.toUpperCase()));
    if (row.length === 0) return new Map<string, MappedLabel>();
    return layoutRow(row.map((resource) => ({
      alias: resource.alias.toUpperCase(),
      x: resource.visualCoordinate!.x,
      text: boardLabelText(mappedByAlias.get(resource.alias.toUpperCase())!.signal, resource.alias),
    })), levels(row[0].visualCoordinate!.y));
  };
  // LEDs: above the LED, then higher. Switches: above the switch, then below its number.
  const ledLabels = rowLabels('led', (y) => [y - 12, y - 26]);
  const switchLabels = rowLabels('switch', (y) => [y - 16, y + 40]);
  const parts = placed.map((resource): BoardPart => {
    const { x, y } = resource.visualCoordinate!;
    const category = resource.category as BoardCategory;
    const alias = resource.alias.toUpperCase();
    const entry = mappedByAlias.get(alias);
    const label = !entry ? null
      : category === 'button' ? buttonLabel(x, y, centre, boardLabelText(entry.signal, resource.alias))
        : (category === 'led' ? ledLabels : switchLabels).get(alias)!;
    return {
      alias: resource.alias,
      category,
      x,
      y,
      packagePin: resource.packagePin,
      name: resource.label,
      mapped: entry && label ? { nodeId: entry.nodeId, signal: entry.signal, label } : null,
    };
  });
  return { parts, clock, unplaced, mismatched };
}
