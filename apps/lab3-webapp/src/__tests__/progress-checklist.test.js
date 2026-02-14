import { describe, it, expect } from 'vitest';
import { buildProgressSteps } from '../progress-tracker';
import { DIGIT_PATTERNS } from '../types';
const emptyRow = {
    b3: 0,
    b2: 0,
    b1: 0,
    b0: 0,
    seg: [1, 1, 1, 1, 1, 1, 1],
    isDontCare: false,
};
describe('Progress checklist', () => {
    it('marks validation as error when any required vector fails', () => {
        const truthTable = Array.from({ length: 16 }, (_, i) => ({
            ...emptyRow,
            b3: ((i >> 3) & 1),
            b2: ((i >> 2) & 1),
            b1: ((i >> 1) & 1),
            b0: (i & 1),
            seg: (i < 10 ? DIGIT_PATTERNS[i] : [1, 1, 1, 1, 1, 1, 1]),
            isDontCare: i >= 10,
        }));
        const steps = buildProgressSteps({
            truthTable,
            kMaps: { a: { grid: Array(16).fill(0), groups: [], simplifiedExpr: '', minTerms: [] } },
            validationResults: [{ input: 0, expected: 0, actual: 127, pass: false }],
            verilogCode: '',
            lastExportAt: undefined,
        });
        const validation = steps.steps.find((s) => s.id === 'validation');
        expect(validation?.status).toBe('error');
    });
});
