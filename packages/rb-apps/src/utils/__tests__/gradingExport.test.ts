import { exportGradingNotes } from '../gradingExport';

describe('Grading Export', () => {
  it('exports grading with correct hash and fields', () => {
    const grading = { score: 95, passFail: true, notes: 'Good job', initials: 'TA' };
    const evidenceHash = 'abcdef1234567890';
    global.Blob = function (content: any, opts: any) { return { content, opts }; } as any;
    const downloadSpy = jest.fn();
    jest.mock('../bundleExport', () => ({ downloadBlob: downloadSpy }));
    exportGradingNotes({ grading, evidenceHash });
    expect(downloadSpy).toHaveBeenCalled();
    const call = downloadSpy.mock.calls[0];
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
    expect(() => exportGradingNotes({ grading, evidenceHash: 'abc' })).toThrow();
  });
});
