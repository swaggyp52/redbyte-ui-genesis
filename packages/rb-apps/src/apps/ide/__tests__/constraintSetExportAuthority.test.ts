// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { materializeIoMappingFromHardwareMappingV2 } from '@redbyte/rb-utils';
import { decodeRBProject, encodeRBProject, type RBProject } from '../../../export/projectFormat';
import { buildDeterministicZip } from '../../../export/deterministicZip';
import { buildExportViewModel } from '../viewmodels/buildExportViewModel';
import { useProjectRuntime } from '../projectRuntime';

const rt = () => useProjectRuntime.getState();
const fixture: RBProject = {
  kind: 'rb-project', version: 1, name: 'Captured mapping package',
  createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z',
  circuit: {
    nodes: [
      { id: 'a', type: 'INPUT', label: 'A', position: { x: 0, y: 0 }, rotation: 0 },
      { id: 'y', type: 'OUTPUT', label: 'Y', position: { x: 180, y: 0 }, rotation: 0 },
    ],
    connections: [{ id: 'a-y', from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'y', portName: 'in' } }],
  },
  ioMapping: {
    inputs: [{ id: 'a', nodeId: 'a', port: 'out', label: 'A', pin: 'V17' }],
    outputs: [{ id: 'y', nodeId: 'y', port: 'in', label: 'Y', pin: 'U16' }],
  },
  fpga: { board: 'basys3', top: 'top' }, hdl: { top: 'top', sources: [] },
};
const project = (): RBProject => ({
  ...fixture, circuit: structuredClone(rt().circuit),
  hardwareMappingV2: structuredClone(rt().hardwareMappingV2),
  ioMapping: materializeIoMappingFromHardwareMappingV2(rt().hardwareMappingV2),
  constraintSets: structuredClone(rt().constraintSets),
});

describe('captured mapping export authority', () => {
  it('keeps restored A, generated preview, manifest and actual ZIP aligned after project codec/reopen', async () => {
    rt().loadFromProject(fixture);
    const before = buildExportViewModel(project());
    const a = rt().addConstraintSet('A', before.artifacts.find(file => file.path === 'top.xdc')!.content);
    if (!a.ok) throw new Error(a.error);
    rt().setMappingPin('a', 'V16');
    expect(rt().constraintSets.activeId).toBeNull();
    const b = rt().addConstraintSet('B', buildExportViewModel(project()).artifacts.find(file => file.path === 'top.xdc')!.content);
    if (!b.ok) throw new Error(b.error);
    expect(rt().setActiveConstraintSet(a.id)).toEqual({ ok: true });
    const saved = encodeRBProject(project());
    rt().loadFromProject({ ...fixture, name: 'Other project', constraintSets: undefined });
    rt().loadFromProject(decodeRBProject(saved));
    expect(rt().constraintSets.activeId).toBe(a.id);
    expect(rt().projectIoRows.find(row => row.id === 'a')?.pin).toBe('V17');
    const restored = buildExportViewModel(project());
    const xdc = restored.artifacts.find(file => file.path === 'top.xdc')!.content;
    expect(xdc).toContain('PACKAGE_PIN V17 [get_ports {A}]');
    expect(xdc).not.toContain('PACKAGE_PIN V16');
    const bytes = await buildDeterministicZip(restored.artifacts.map(file => ({ name: file.path, text: file.content })));
    const zip = await JSZip.loadAsync(bytes);
    const deliveredXdc = await zip.file('top.xdc')!.async('string');
    const manifest = decodeRBProject(await zip.file('project.rbproj.json')!.async('string'));
    expect(deliveredXdc).toBe(xdc);
    expect(manifest.fpga?.constraints?.text).toBe(deliveredXdc);
    expect(manifest.constraintSets).toEqual(rt().constraintSets);
    expect(manifest.ioMapping?.inputs.find(row => row.id === 'a')?.pin).toBe('V17');
    expect(await zip.file('top.vhd')!.async('string')).toBe(manifest.hdl?.sources.find(source => source.path === 'top.vhd')?.text);
  });
});
