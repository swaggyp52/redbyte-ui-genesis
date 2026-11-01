import { describe, expect, it } from 'vitest';
import { BASYS3_BOARD_RESOURCES } from '@redbyte/rb-apps/domain';
import type { BoardBinding } from '@redbyte/rb-studio-kernel';
import { BOARD_PLANE, boardLabelText, buildBoardModel, labelBox, partBox, type BoardPart, type BoundNode } from '../lenses/boardModel';

const binding = (name: string, packagePin: string, direction: 'in' | 'out' = 'in'): BoardBinding => ({ name, packagePin, direction, ioRowId: name.toLowerCase(), label: name });
// The shipped 2-Bit Up Counter's mapping (examplesCatalog two-bit-counter ioRows).
const COUNTER: BoundNode[] = [
  { nodeId: 'clk_node', signal: 'CLK100MHZ', binding: binding('CLK100MHZ', 'W5') },
  { nodeId: 'en_node', signal: 'EN', binding: binding('SW0', 'V17') },
  { nodeId: 'rst_node', signal: 'RST', binding: binding('BTNC', 'U18') },
  { nodeId: 'q0_out', signal: 'LD0', binding: binding('LD0', 'U16', 'out') },
  { nodeId: 'q1_out', signal: 'LD1', binding: binding('LD1', 'E19', 'out') },
];

const overlaps = (a: ReturnType<typeof partBox>, b: ReturnType<typeof partBox>) =>
  a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
const part = (parts: readonly BoardPart[], alias: string) => parts.find((entry) => entry.alias === alias)!;

describe('Basys3 board drawing model', () => {
  it('places the pushbuttons as the physical D-pad: C in the middle, U above, D below, L left, R right', () => {
    const { parts } = buildBoardModel(BASYS3_BOARD_RESOURCES, []);
    const c = part(parts, 'BTNC');
    expect(part(parts, 'BTNU')).toMatchObject({ x: c.x });
    expect(part(parts, 'BTNU').y).toBeLessThan(c.y);
    expect(part(parts, 'BTND')).toMatchObject({ x: c.x });
    expect(part(parts, 'BTND').y).toBeGreaterThan(c.y);
    expect(part(parts, 'BTNL')).toMatchObject({ y: c.y });
    expect(part(parts, 'BTNL').x).toBeLessThan(c.x);
    expect(part(parts, 'BTNR')).toMatchObject({ y: c.y });
    expect(part(parts, 'BTNR').x).toBeGreaterThan(c.x);
    // Every placed part carries the catalog's own package pin.
    for (const entry of parts) expect(entry.packagePin).toBe(BASYS3_BOARD_RESOURCES.find((resource) => resource.alias === entry.alias)!.packagePin);
  });

  it('draws RST on the centre button (BTNC · U18), with its label clear of every other button', () => {
    const model = buildBoardModel(BASYS3_BOARD_RESOURCES, COUNTER);
    const mapped = model.parts.filter((entry) => entry.mapped);
    expect(mapped.map((entry) => `${entry.mapped!.signal}=${entry.alias}·${entry.packagePin}`).sort()).toEqual(['EN=SW0·V17', 'LD0=LD0·U16', 'LD1=LD1·E19', 'RST=BTNC·U18']);
    expect(model.clock).toEqual({ nodeId: 'clk_node', signal: 'CLK100MHZ' });
    const rst = part(model.parts, 'BTNC');
    const box = labelBox(rst.mapped!.label, 'RST');
    for (const other of model.parts) expect([other.alias, overlaps(box, partBox(other))]).toEqual([other.alias, false]);
    // The leader starts at the centre button's edge and ends at the label.
    const [x1, y1, x2, y2] = rst.mapped!.label.leader!;
    expect(Math.hypot(x1 - rst.x, y1 - rst.y)).toBeLessThanOrEqual(12);
    expect(Math.hypot(x2 - rst.mapped!.label.x, y2 - rst.mapped!.label.y)).toBeLessThanOrEqual(5);
  });

  it('keeps every button label beside its own button and clear of the others when all five are mapped', () => {
    const all = ['BTNC', 'BTNU', 'BTNL', 'BTNR', 'BTND'].map((alias) => {
      const resource = BASYS3_BOARD_RESOURCES.find((entry) => entry.alias === alias)!;
      return { nodeId: alias.toLowerCase(), signal: `S_${alias.slice(3)}`, binding: binding(alias, resource.packagePin) };
    });
    const { parts } = buildBoardModel(BASYS3_BOARD_RESOURCES, all);
    const buttons = parts.filter((entry) => entry.category === 'button');
    const boxes = buttons.map((entry) => ({ entry, box: labelBox(entry.mapped!.label, entry.mapped!.label.text) }));
    for (const { entry, box } of boxes) {
      for (const other of parts) expect([entry.alias, other.alias, overlaps(box, partBox(other))]).toEqual([entry.alias, other.alias, false]);
      for (const { entry: peer, box: peerBox } of boxes) if (peer !== entry) expect([entry.alias, peer.alias, overlaps(box, peerBox)]).toEqual([entry.alias, peer.alias, false]);
      if (!entry.mapped!.label.leader) {
        // Without a leader, the nearest button to the label is its own.
        const cx = (box.minX + box.maxX) / 2;
        const cy = (box.minY + box.maxY) / 2;
        const nearest = [...buttons].sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
        expect([entry.alias, nearest.alias]).toEqual([entry.alias, entry.alias]);
      }
    }
  });

  it('never marks a part from a binding whose package pin disagrees with the catalog', () => {
    const wrong = buildBoardModel(BASYS3_BOARD_RESOURCES, [{ nodeId: 'rst_node', signal: 'RST', binding: binding('BTNC', 'T17') }]);
    expect(wrong.parts.some((entry) => entry.mapped)).toBe(false);
    expect(wrong.mismatched.map((entry) => entry.name)).toEqual(['BTNC']);
    const unknown = buildBoardModel(BASYS3_BOARD_RESOURCES, [{ nodeId: 'x', signal: 'X', binding: binding('BTNX', 'A1') }]);
    expect(unknown.mismatched).toHaveLength(1);
  });

  it('names a switch or LED by its signal, without repeating the resource the board already prints', () => {
    expect(boardLabelText('LD0 (CARRY)', 'LD0')).toBe('CARRY');
    expect(boardLabelText('A0 (SW0)', 'SW0')).toBe('A0');
    expect(boardLabelText('SW1 (B)', 'SW1')).toBe('B');
    expect(boardLabelText('LD1', 'LD1')).toBe('LD1');
    expect(boardLabelText('EN', 'SW0')).toBe('EN');
  });

  const pin = (alias: string) => BASYS3_BOARD_RESOURCES.find((resource) => resource.alias === alias)!.packagePin;
  const rowsClear = (parts: readonly BoardPart[]) => {
    const labelled = parts.filter((entry) => entry.mapped && entry.category !== 'button');
    const boxes = labelled.map((entry) => ({ entry, box: labelBox(entry.mapped!.label, entry.mapped!.label.text) }));
    for (const { entry, box } of boxes) {
      expect([entry.alias, box.minX >= BOARD_PLANE.minX - 0.01 && box.maxX <= BOARD_PLANE.maxX + 0.01 && box.minY >= BOARD_PLANE.minY]).toEqual([entry.alias, true]);
      for (const { entry: peer, box: other } of boxes) {
        if (peer === entry) continue;
        const overlap = box.minX < other.maxX && other.minX < box.maxX && box.minY < other.maxY && other.minY < box.maxY;
        expect([entry.alias, peer.alias, overlap]).toEqual([entry.alias, peer.alias, false]);
      }
      for (const other of parts) expect([entry.alias, other.alias, (() => { const part = partBox(other); return box.minX < part.maxX && part.minX < box.maxX && box.minY < part.maxY && part.minY < box.maxY; })()]).toEqual([entry.alias, other.alias, false]);
    }
    return labelled;
  };

  it('keeps the shipped Half Adder and 4-bit adder labels apart and on the board', () => {
    const half = buildBoardModel(BASYS3_BOARD_RESOURCES, [
      { nodeId: 'sw0', signal: 'SW0 (A)', binding: binding('SW0', pin('SW0')) },
      { nodeId: 'sw1', signal: 'SW1 (B)', binding: binding('SW1', pin('SW1')) },
      { nodeId: 'ld0', signal: 'LD0 (CARRY)', binding: binding('LD0', pin('LD0'), 'out') },
      { nodeId: 'ld1', signal: 'LD1 (SUM)', binding: binding('LD1', pin('LD1'), 'out') },
    ]);
    expect(rowsClear(half.parts).map((entry) => `${entry.alias}=${entry.mapped!.label.text}`).sort()).toEqual(['LD0=CARRY', 'LD1=SUM', 'SW0=A', 'SW1=B']);
    const adder = buildBoardModel(BASYS3_BOARD_RESOURCES, [
      ...['A0', 'B0', 'A1', 'B1', 'A2', 'B2', 'A3', 'B3'].map((name, index) => ({ nodeId: name, signal: `${name} (SW${index})`, binding: binding(`SW${index}`, pin(`SW${index}`)) })),
      ...['SUM0', 'SUM1', 'SUM2', 'SUM3', 'CARRY'].map((name, index) => ({ nodeId: name, signal: `LD${index} (${name})`, binding: binding(`LD${index}`, pin(`LD${index}`), 'out') })),
    ]);
    const labelled = rowsClear(adder.parts);
    expect(labelled).toHaveLength(13);
    expect(labelled.every((entry) => !entry.mapped!.label.text.endsWith('…'))).toBe(true);
  });

  it('shortens only labels that cannot fit, and keeps every label on the board when all 16 LEDs carry long names', () => {
    const model = buildBoardModel(BASYS3_BOARD_RESOURCES, Array.from({ length: 16 }, (_, index) => ({
      nodeId: `n${index}`, signal: `COUNT_BIT_${index}`, binding: binding(`LD${index}`, pin(`LD${index}`), 'out'),
    })));
    const labelled = rowsClear(model.parts);
    expect(labelled).toHaveLength(16);
    // The full name is never lost: it stays as the mapped signal (the part's title and legend).
    expect(labelled.every((entry) => entry.mapped!.signal.startsWith('COUNT_BIT_'))).toBe(true);
  });
});
