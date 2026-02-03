import { validateEvidenceAgainstLabSpec } from '../validateEvidenceAgainstLabSpec';
describe('validateEvidenceAgainstLabSpec', () => {
    const baseEvidence = {
        probes: [
            { name: 'clk', id: 'p1', color: '#f00' },
            { name: 'Q', id: 'p2', color: '#0f0' },
        ],
        ticks: Array(20).fill(0),
        exampleId: '11_d-flipflop',
        // ...other required fields as needed for minimal evidence
    };
    it('returns all green when evidence meets all requirements', () => {
        const spec = {
            labId: 'lab1',
            requirements: { probes: ['clk', 'Q'], minTicks: 20 },
            requiredExampleId: '11_d-flipflop',
        };
        const result = validateEvidenceAgainstLabSpec(baseEvidence, spec);
        expect(result.probes).toEqual({ clk: 'present', Q: 'present' });
        expect(result.ticks.status).toBe('sufficient');
        expect(result.exampleMatch).toBe('match');
    });
    it('flags missing required probe', () => {
        const spec = {
            labId: 'lab1',
            requirements: { probes: ['clk', 'Q', 'D'] },
        };
        const result = validateEvidenceAgainstLabSpec(baseEvidence, spec);
        expect(result.probes).toEqual({ clk: 'present', Q: 'present', D: 'missing' });
    });
    it('flags insufficient ticks', () => {
        const spec = {
            labId: 'lab1',
            requirements: { minTicks: 25 },
        };
        const result = validateEvidenceAgainstLabSpec(baseEvidence, spec);
        expect(result.ticks.status).toBe('insufficient');
        expect(result.ticks.required).toBe(25);
        expect(result.ticks.observed).toBe(20);
    });
    it('returns no-op if no lab spec', () => {
        // If no spec, function should return empty result
        const result = validateEvidenceAgainstLabSpec(baseEvidence, { labId: 'lab1' });
        expect(result).toEqual({ ticks: { status: 'not-checked' }, exampleMatch: 'not-checked' });
    });
    it('is backward compatible with older evidence (missing fields)', () => {
        const legacyEvidence = { probes: [{ name: 'clk' }], ticks: undefined };
        const spec = { labId: 'lab1', requirements: { probes: ['clk'], minTicks: 1 } };
        const result = validateEvidenceAgainstLabSpec(legacyEvidence, spec);
        expect(result.probes).toEqual({ clk: 'present' });
        expect(result.ticks.status).toBe('insufficient');
    });
});
