import { computeRbprojContentHashFromEncoded } from '../rbprojAutosave';
import { encodeRBProject } from '../../export/projectFormat';
const baseProject = () => ({
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-02-04T00:00:00.000Z',
    updatedAt: '2026-02-04T00:00:00.000Z',
    name: 'Test Project',
    description: 'fixture',
    circuit: { nodes: [], connections: [] },
    meta: { appVersion: '1.0.0', gitCommit: 'deadbeef', tickRate: 10, tags: ['fixture'] },
});
describe('rbproj autosave content hash', () => {
    it('ignores updatedAt and meta appVersion/gitCommit', () => {
        const a = baseProject();
        const b = {
            ...a,
            updatedAt: '2026-02-04T12:34:56.000Z',
            meta: { ...a.meta, appVersion: '9.9.9', gitCommit: 'cafebabe' },
        };
        const ha = computeRbprojContentHashFromEncoded(encodeRBProject(a));
        const hb = computeRbprojContentHashFromEncoded(encodeRBProject(b));
        expect(ha).toBe(hb);
    });
    it('changes when meta.tickRate changes', () => {
        const a = baseProject();
        const b = { ...a, meta: { ...a.meta, tickRate: 60 } };
        const ha = computeRbprojContentHashFromEncoded(encodeRBProject(a));
        const hb = computeRbprojContentHashFromEncoded(encodeRBProject(b));
        expect(ha).not.toBe(hb);
    });
    it('changes when circuit changes', () => {
        const a = baseProject();
        const b = {
            ...a,
            circuit: {
                nodes: [{ id: 'n1', type: 'Const1', position: { x: 0, y: 0 }, config: {}, state: {} }],
                connections: [],
            },
        };
        const ha = computeRbprojContentHashFromEncoded(encodeRBProject(a));
        const hb = computeRbprojContentHashFromEncoded(encodeRBProject(b));
        expect(ha).not.toBe(hb);
    });
});
