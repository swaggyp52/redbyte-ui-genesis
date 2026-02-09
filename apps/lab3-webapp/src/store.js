import { create } from 'zustand';
import { createEmptyTruthTable, DIGIT_PATTERNS, segToNumber } from './types';
import { generateKMapGrid, minimizeBooleanExpr, evaluateBoolExpr } from './kmap';
const initialState = {
    truthTable: createEmptyTruthTable(),
    implMode: 'table',
    verilogCode: '',
    booleanExpressions: {
        a: '',
        b: '',
        c: '',
        d: '',
        e: '',
        f: '',
        g: '',
    },
    kMaps: {
        a: { grid: Array(16).fill('X'), groups: [], simplifiedExpr: '', minTerms: [] },
        b: { grid: Array(16).fill('X'), groups: [], simplifiedExpr: '', minTerms: [] },
        c: { grid: Array(16).fill('X'), groups: [], simplifiedExpr: '', minTerms: [] },
        d: { grid: Array(16).fill('X'), groups: [], simplifiedExpr: '', minTerms: [] },
        e: { grid: Array(16).fill('X'), groups: [], simplifiedExpr: '', minTerms: [] },
        f: { grid: Array(16).fill('X'), groups: [], simplifiedExpr: '', minTerms: [] },
        g: { grid: Array(16).fill('X'), groups: [], simplifiedExpr: '', minTerms: [] },
    },
    simulationInput: 0,
    validationResults: [],
    simulationMode: 'manual',
    currentStep: 0,
    waveformHistory: [],
    validationErrors: {},
};
export const useLabStore = create((set, get) => ({
    ...initialState,
    // ============ Truth Table ============
    setTableRow: (index, partial) => {
        set((state) => ({
            truthTable: state.truthTable.map((row, i) => i === index ? { ...row, ...partial } : row),
        }));
        // Auto-generate K-maps after table change
        setTimeout(() => get().generateKMaps(), 0);
        // Trigger live validation
        setTimeout(() => get().performLiveValidation(), 0);
    },
    toggleDontCare: (index) => {
        set((state) => ({
            truthTable: state.truthTable.map((row, i) => i === index ? { ...row, isDontCare: !row.isDontCare, seg: !row.isDontCare ? [1, 1, 1, 1, 1, 1, 1] : row.seg } : row),
        }));
        setTimeout(() => get().generateKMaps(), 0);
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
        setTimeout(() => get().generateKMaps(), 0);
        setTimeout(() => get().performLiveValidation(), 0);
    },
    // ============ K-Maps & Boolean Expressions ============
    generateKMaps: () => {
        const state = get();
        const segmentNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
        const newKMaps = { ...state.kMaps };
        for (let i = 0; i < segmentNames.length; i++) {
            const segName = segmentNames[i];
            const kmapGrid = generateKMapGrid(state.truthTable, i);
            const simplifiedExpr = minimizeBooleanExpr(kmapGrid);
            const minTerms = kmapGrid
                .map((val, idx) => (val === 1 ? idx : -1))
                .filter((idx) => idx >= 0);
            newKMaps[segName] = {
                grid: kmapGrid,
                groups: [],
                simplifiedExpr,
                minTerms,
            };
        }
        set({
            kMaps: newKMaps,
            booleanExpressions: {
                a: newKMaps.a.simplifiedExpr,
                b: newKMaps.b.simplifiedExpr,
                c: newKMaps.c.simplifiedExpr,
                d: newKMaps.d.simplifiedExpr,
                e: newKMaps.e.simplifiedExpr,
                f: newKMaps.f.simplifiedExpr,
                g: newKMaps.g.simplifiedExpr,
            },
        });
    },
    setBooleanExpr: (segmentName, expr) => {
        set((state) => ({
            booleanExpressions: {
                ...state.booleanExpressions,
                [segmentName]: expr,
            },
        }));
        setTimeout(() => get().performLiveValidation(), 0);
    },
    regenerateKMapFromExpr: (segmentName) => {
        // Update K-map based on edited boolean expression
        const state = get();
        const expr = state.booleanExpressions[segmentName];
        // Evaluate expression for all 16 inputs
        const newGrid = Array(16);
        for (let i = 0; i < 16; i++) {
            const result = evaluateBoolExpr(expr, i);
            newGrid[i] = result ? 1 : 0;
        }
        set((state) => ({
            kMaps: {
                ...state.kMaps,
                [segmentName]: {
                    ...state.kMaps[segmentName],
                    grid: newGrid,
                },
            },
        }));
    },
    // ============ Simulation ============
    setSimulationInput: (value) => {
        set({ simulationInput: value });
    },
    setSimulationMode: (mode) => {
        set({ simulationMode: mode, currentStep: 0, waveformHistory: [] });
    },
    runAllVectors: () => {
        const state = get();
        const results = [];
        const waveforms = [];
        for (let i = 0; i < 16; i++) {
            const actual = state.evalSeg(i);
            const expected = segToNumber(state.truthTable[i].seg);
            const pass = i < 10 ? actual === expected : true;
            results.push({
                input: i,
                expected,
                actual,
                pass,
            });
            // Record waveform for later visualization
            const b3 = (i >> 3) & 1;
            const b2 = (i >> 2) & 1;
            const b1 = (i >> 1) & 1;
            const b0 = i & 1;
            const outputs = [
                (actual >> 0) & 1,
                (actual >> 1) & 1,
                (actual >> 2) & 1,
                (actual >> 3) & 1,
                (actual >> 4) & 1,
                (actual >> 5) & 1,
                (actual >> 6) & 1,
            ];
            waveforms.push({
                time: i,
                inputs: [b3, b2, b1, b0],
                outputs,
            });
        }
        set({ validationResults: results, waveformHistory: waveforms });
    },
    stepSimulation: () => {
        const state = get();
        if (state.currentStep >= 16)
            return;
        const input = state.currentStep;
        const actual = state.evalSeg(input);
        const b3 = (input >> 3) & 1;
        const b2 = (input >> 2) & 1;
        const b1 = (input >> 1) & 1;
        const b0 = input & 1;
        const outputs = [
            (actual >> 0) & 1,
            (actual >> 1) & 1,
            (actual >> 2) & 1,
            (actual >> 3) & 1,
            (actual >> 4) & 1,
            (actual >> 5) & 1,
            (actual >> 6) & 1,
        ];
        const sample = {
            time: input,
            inputs: [b3, b2, b1, b0],
            outputs,
        };
        set((state) => ({
            waveformHistory: [...state.waveformHistory, sample],
            currentStep: state.currentStep + 1,
        }));
    },
    resetSimulation: () => {
        set({ currentStep: 0, waveformHistory: [], validationResults: [] });
    },
    performLiveValidation: () => {
        const state = get();
        const errors = {};
        const segmentNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
        // Check if truth table matches boolean expressions for all inputs 0-9
        for (let segIdx = 0; segIdx < segmentNames.length; segIdx++) {
            const segName = segmentNames[segIdx];
            const expr = state.booleanExpressions[segName];
            const exprErrors = [];
            for (let input = 0; input < 10; input++) {
                const tableValue = state.truthTable[input].seg[segIdx];
                const exprValue = evaluateBoolExpr(expr, input) ? 1 : 0;
                if (tableValue !== exprValue) {
                    exprErrors.push(`Input ${input}: table=${tableValue}, expr=${exprValue}`);
                }
            }
            if (exprErrors.length > 0) {
                errors[segName] = exprErrors;
            }
        }
        set({ validationErrors: errors });
    },
    // ============ Verilog ============
    setVerilogCode: (code) => {
        set({ verilogCode: code });
        setTimeout(() => get().performLiveValidation(), 0);
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
        setTimeout(() => get().generateKMaps(), 0);
    },
    generateVerilogFromExpr: () => {
        const state = get();
        let code = `module ssd_driver(
  input [3:0] B,
  output reg [6:0] seg
);

always @(*) begin
  seg = 7'b0000000;
`;
        const segmentNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
        for (let i = 0; i < segmentNames.length; i++) {
            const expr = state.booleanExpressions[segmentNames[i]];
            code += `  assign seg[${i}] = ${expr};\n`;
        }
        code += `end\n\nendmodule\n`;
        return code;
    },
    // ============ Evaluation ============
    evalSeg: (input) => {
        const state = get();
        if (state.implMode === 'verilogCase') {
            const regex = new RegExp(`4'b${input.toString(2).padStart(4, '0')}:\\s*seg\\s*=\\s*7'b([01]{7});`);
            const match = regex.exec(state.verilogCode);
            if (match) {
                return parseInt(match[1], 2);
            }
            return 0b1111111;
        }
        if (state.implMode === 'boolExpr') {
            let result = 0;
            const segmentNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
            for (let i = 0; i < segmentNames.length; i++) {
                const expr = state.booleanExpressions[segmentNames[i]];
                const val = evaluateBoolExpr(expr, input) ? 1 : 0;
                result |= val << i;
            }
            return result;
        }
        const row = state.truthTable[input];
        if (!row)
            return 0b1111111;
        return segToNumber(row.seg);
    },
    // ============ Persistence ============
    exportJSON: () => {
        const state = get();
        return JSON.stringify({
            version: '2.0',
            timestamp: new Date().toISOString(),
            truthTable: state.truthTable,
            implMode: state.implMode,
            verilogCode: state.verilogCode,
            booleanExpressions: state.booleanExpressions,
            kMaps: state.kMaps,
        }, null, 2);
    },
    importJSON: (json) => {
        try {
            const data = JSON.parse(json);
            set({
                truthTable: data.truthTable || initialState.truthTable,
                implMode: data.implMode || 'table',
                verilogCode: data.verilogCode || '',
                booleanExpressions: data.booleanExpressions || initialState.booleanExpressions,
                kMaps: data.kMaps || initialState.kMaps,
            });
        }
        catch (e) {
            console.error('Failed to import JSON:', e);
        }
    },
    exportPDF: async () => {
        // Placeholder for PDF export (will implement with jsPDF)
        console.log('PDF export not yet implemented');
    },
    reset: () => {
        set(initialState);
    },
}));
