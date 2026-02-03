import { describe, it, expect, vi } from 'vitest';
import { exportGradingNotes } from '../gradingExport';
import { downloadBlob } from '../bundleExport';
// Mock must be hoisted and cannot reference local variables
vi.mock('../bundleExport', () => ({
    downloadBlob: vi.fn(),
}));
describe('Grading Export', () => {
    it('exports grading with correct hash and fields', () => {
        const grading = { score: 95, passFail: true, notes: 'Good job', initials: 'TA' };
        const evidenceHash = 'abcdef1234567890';
        // Mock Blob since we are in node environment
        global.Blob = function (content, opts) { return { content, opts }; };
        exportGradingNotes({ grading, evidenceHash });
        expect(downloadBlob).toHaveBeenCalled();
        const call = downloadBlob.mock.calls[0];
        const [blob, filename] = call;
        expect(filename).toContain('grading-abcdef12-');
        const json = JSON.parse(blob.content[0]);
        expect(json.evidenceHash).toBe(evidenceHash);
        expect(json.score).toBe(95);
        expect(json.passFail).toBe(true);
        expect(json.notes).toBe('Good job');
        expect(json.initials).toBe('TA');
    });
    it('throws if initials missing when grading fields are set', () => {
        const grading = { score: 80, passFail: false, notes: 'Incomplete', initials: '' };
        expect(() => exportGradingNotes({ grading: grading, evidenceHash: 'abc' })).toThrow();
    });
});
