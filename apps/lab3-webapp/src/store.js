import { create } from 'zustand';
import { createEmptyTruthTable, DIGIT_PATTERNS, segToNumber } from './types';
const initialState = {
    truthTable: createEmptyTruthTable(),
    implMode: 'table',
    verilogCode: '',
    simulationInput: 0,
    validationResults: [],
};
export const useLabStore = create((set, get) => ({
    ...initialState,
    setTableRow: (index, partial) => {
        set((state) => ({
            truthTable: state.truthTable.map((row, i) => i === index ? { ...row, ...partial } : row),
        }));
    },
    toggleDontCare: (index) => {
        set((state) => ({
            truthTable: state.truthTable.map((row, i) => i === index ? { ...row, isDontCare: !row.isDontCare, seg: !row.isDontCare ? [1, 1, 1, 1, 1, 1, 1] : row.seg } : row),
        }));
    },
    fillStandardDigits: () => {
        set((state) => ({
            truthTable: state.truthTable.map((row, i) => {
                if (i < 10) {
                    return { ...row, seg: DIGIT_PATTERNS[i], isDontCare: false };
                }
                return { ...row, isDontCare: true, seg: [1, 1, 1, 1, 1, 1, 1] };
            }),
        }));
    },
    setSimulationInput: (value) => {
        set({ simulationInput: value });
    },
    runAllVectors: () => {
        const state = get();
        const results = [];
        for (let i = 0; i < 16; i++) {
            const actual = state.evalSeg(i);
            const expected = segToNumber(state.truthTable[i].seg);
            const pass = i < 10 ? actual === expected : true; // Don't-cares always pass
            results.push({
                input: i,
                expected,
                actual,
                pass,
            });
        }
        set({ validationResults: results });
    },
    setVerilogCode: (code) => {
        set({ verilogCode: code });
    },
    parseVerilogCase: (code) => {
        const regex = /4'b([01]{4}):\s*seg\s*=\s*7'b([01]{7});/g;
        const newTable = createEmptyTruthTable();
        let match;
        while ((match = regex.exec(code)) !== null) {
            const input = parseInt(match[1], 2);
            const seg = match[2].split('').map((s) => (parseInt(s) ? 1 : 0));
            newTable[input] = { ...newTable[input], seg, isDontCare: false };
        }
        set({ truthTable: newTable, implMode: 'verilogCase', verilogCode: code });
    },
    evalSeg: (input) => {
        const state = get();
        if (state.implMode === 'verilogCase') {
            const regex = new RegExp(`4'b${input.toString(2).padStart(4, '0')}:\\s*seg\\s*=\\s*7'b([01]{7});`);
            const match = regex.exec(state.verilogCode);
            if (match) {
                return parseInt(match[1], 2);
            }
            // Default: blank
            return 0b1111111;
        }
        // Table mode
        const row = state.truthTable[input];
        if (!row)
            return 0b1111111;
        return segToNumber(row.seg);
    },
    exportJSON: () => {
        const state = get();
        return JSON.stringify({
            version: '1.0',
            timestamp: new Date().toISOString(),
            truthTable: state.truthTable,
            implMode: state.implMode,
            verilogCode: state.verilogCode,
        }, null, 2);
    },
    importJSON: (json) => {
        try {
            const data = JSON.parse(json);
            set({
                truthTable: data.truthTable || initialState.truthTable,
                implMode: data.implMode || 'table',
                verilogCode: data.verilogCode || '',
            });
        }
        catch (e) {
            console.error('Failed to import JSON:', e);
        }
    },
    reset: () => {
        set(initialState);
    },
}));
