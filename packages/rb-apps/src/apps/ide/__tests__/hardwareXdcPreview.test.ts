import { describe, expect, it } from 'vitest';
import type { HardwareMappingDocumentV2, HardwareMappingEntryV2 } from '@redbyte/rb-utils';
import { applyHardwareMappingV2Edit } from '../hardwareMappingV2EditorModel';
import { buildPlannerXdcLines, diffPlannerXdc, diffXdc } from '../hardwareXdcPreview';

function doc(entries: HardwareMappingEntryV2[]): HardwareMappingDocumentV2 {
  return { schemaVersion: '2.0', boardId: 'basys3', entries };
}
const scalar = (id: string, direction: 'in' | 'out', pin: string): HardwareMappingEntryV2 => ({
  id,
  kind: 'scalar',
  width: 1 as const,
  direction,
  portName: id,
  nodeId: `${id}_node`,
  pin,
});

describe('hardwareXdcPreview', () => {
  it('emits PACKAGE_PIN + IOSTANDARD lines per mapped assignment, label-sorted', () => {
    const lines = buildPlannerXdcLines(doc([scalar('SW1', 'in', 'V16'), scalar('SW0', 'in', 'V17')]));
    expect(lines).toEqual([
      'set_property PACKAGE_PIN V17 [get_ports {SW0}]',
      'set_property IOSTANDARD LVCMOS33 [get_ports {SW0}]',
      'set_property PACKAGE_PIN V16 [get_ports {SW1}]',
      'set_property IOSTANDARD LVCMOS33 [get_ports {SW1}]',
    ]);
  });

  it('omits unmapped assignments', () => {
    expect(buildPlannerXdcLines(doc([scalar('SW0', 'in', '')]))).toEqual([]);
  });

  it('diffs before/after as added/removed/unchanged', () => {
    const diff = diffXdc(['a', 'b'], ['b', 'c']);
    expect(diff.addedCount).toBe(1);
    expect(diff.removedCount).toBe(1);
    expect(diff.changed).toBe(true);
    expect(diff.lines.find((l) => l.line === 'c')?.status).toBe('added');
    expect(diff.lines.find((l) => l.line === 'a')?.status).toBe('removed');
    expect(diff.lines.find((l) => l.line === 'b')?.status).toBe('unchanged');
  });

  it('shows the exact XDC consequence of a pin edit', () => {
    const before = doc([scalar('SW0', 'in', 'V17')]);
    const after = applyHardwareMappingV2Edit(before, {
      type: 'set_bit_pin',
      entryId: 'SW0',
      pin: 'V16',
    });
    const diff = diffPlannerXdc(before, after);
    expect(diff.changed).toBe(true);
    expect(diff.lines.find((l) => l.status === 'removed')?.line).toContain('PACKAGE_PIN V17');
    expect(diff.lines.find((l) => l.status === 'added')?.line).toContain('PACKAGE_PIN V16');
  });

  it('reports no change when the mapping is identical', () => {
    const d = doc([scalar('SW0', 'in', 'V17')]);
    expect(diffPlannerXdc(d, d).changed).toBe(false);
  });
});
