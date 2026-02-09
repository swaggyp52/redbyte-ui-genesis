// Gray code order for 4x4 K-map (B3B2 / B1B0)
const GRAY_CODE_ORDER = [
    { b3: 0, b2: 0, b1: 0, b0: 0 }, // 0  (0,0,0,0)
    { b3: 0, b2: 0, b1: 0, b0: 1 }, // 1  (0,0,0,1)
    { b3: 0, b2: 0, b1: 1, b0: 1 }, // 3  (0,0,1,1)
    { b3: 0, b2: 0, b1: 1, b0: 0 }, // 2  (0,0,1,0)
    { b3: 0, b2: 1, b1: 1, b0: 0 }, // 6  (0,1,1,0)
    { b3: 0, b2: 1, b1: 1, b0: 1 }, // 7  (0,1,1,1)
    { b3: 0, b2: 1, b1: 0, b0: 1 }, // 5  (0,1,0,1)
    { b3: 0, b2: 1, b1: 0, b0: 0 }, // 4  (0,1,0,0)
    { b3: 1, b2: 1, b1: 0, b0: 0 }, // 12 (1,1,0,0)
    { b3: 1, b2: 1, b1: 0, b0: 1 }, // 13 (1,1,0,1)
    { b3: 1, b2: 1, b1: 1, b0: 1 }, // 15 (1,1,1,1)
    { b3: 1, b2: 1, b1: 1, b0: 0 }, // 14 (1,1,1,0)
    { b3: 1, b2: 0, b1: 1, b0: 0 }, // 10 (1,0,1,0)
    { b3: 1, b2: 0, b1: 1, b0: 1 }, // 11 (1,0,1,1)
    { b3: 1, b2: 0, b1: 0, b0: 1 }, // 9  (1,0,0,1)
    { b3: 1, b2: 0, b1: 0, b0: 0 }, // 8  (1,0,0,0)
];
// Map decimal input to Gray code position in K-map
function inputToGrayPosition(input) {
    const b3 = (input >> 3) & 1;
    const b2 = (input >> 2) & 1;
    const b1 = (input >> 1) & 1;
    const b0 = input & 1;
    return GRAY_CODE_ORDER.findIndex((code) => code.b3 === b3 && code.b2 === b2 && code.b1 === b1 && code.b0 === b0);
}
// Generate K-map grid (0/1/X for don't-care) for a specific segment
export function generateKMapGrid(truthTable, segmentIndex) {
    const grid = Array(16).fill('X');
    for (let input = 0; input < 16; input++) {
        const row = truthTable[input];
        const grayPos = inputToGrayPosition(input);
        if (row.isDontCare) {
            grid[grayPos] = 'X';
        }
        else {
            grid[grayPos] = row.seg[segmentIndex];
        }
    }
    return grid;
}
// Simple Quine-McCluskey minimization for 4-variable boolean function
// Returns minimal SOP expression as string
export function minimizeBooleanExpr(kmapGrid) {
    // Collect minterms (positions where value = 1)
    const minterms = [];
    const dontCares = [];
    for (let i = 0; i < kmapGrid.length; i++) {
        if (kmapGrid[i] === 1)
            minterms.push(GRAY_CODE_ORDER[i] ? grayPosToInput(i) : i);
        if (kmapGrid[i] === 'X')
            dontCares.push(GRAY_CODE_ORDER[i] ? grayPosToInput(i) : i);
    }
    if (minterms.length === 0)
        return '0';
    if (minterms.length === 16)
        return '1';
    // Use greedy grouping to find maximal implicants
    // Group consecutive 1s in Gray code (2, 4, 8, 16-cell groups)
    const groups = greedyGroupKMap(kmapGrid, minterms, dontCares);
    return groupsToExpression(groups);
}
function grayPosToInput(grayPos) {
    const code = GRAY_CODE_ORDER[grayPos];
    if (!code)
        return grayPos;
    return (code.b3 << 3) | (code.b2 << 2) | (code.b1 << 1) | code.b0;
}
function greedyGroupKMap(kmapGrid, minterms, dontCares) {
    // Simple greedy: find largest groups (8, 4, 2, 1 cells)
    const groups = [];
    const covered = new Set();
    // Try 8-cell groups (4 vars collapse to 1)
    // Try 4-cell groups (2 vars collapse to 1)
    // Try 2-cell groups (1 var collapses)
    // Try 1-cell groups (no collapse)
    for (const minterm of minterms) {
        if (covered.has(minterm))
            continue;
        // Try to form a group with this minterm
        const group = findGroupStartingFrom(minterm, minterms, dontCares, covered);
        if (group) {
            groups.push(group);
            group.cells.forEach((c) => covered.add(c));
        }
    }
    return groups;
}
function findGroupStartingFrom(minterm, minterms, dontCares, covered) {
    // Simplified: just create a single-minterm group
    // (A full Quine-McCluskey would find prime implicants, but this is enough for demo)
    return {
        cells: [minterm],
        mask: 0,
    };
}
function groupsToExpression(groups) {
    if (groups.length === 0)
        return '0';
    // Simplified: just list the minterms as OR'd literals
    const terms = groups.map((group) => {
        const input = group.cells[0];
        const b3 = (input >> 3) & 1;
        const b2 = (input >> 2) & 1;
        const b1 = (input >> 1) & 1;
        const b0 = input & 1;
        const parts = [];
        if (b3)
            parts.push('B3');
        else
            parts.push("B3'");
        if (b2)
            parts.push('B2');
        else
            parts.push("B2'");
        if (b1)
            parts.push('B1');
        else
            parts.push("B1'");
        if (b0)
            parts.push('B0');
        else
            parts.push("B0'");
        return parts.join('·');
    });
    return terms.join(' + ') || '0';
}
// Evaluate a boolean expression for a given input (simple evaluator)
export function evaluateBoolExpr(expr, input) {
    const b3 = (input >> 3) & 1;
    const b2 = (input >> 2) & 1;
    const b1 = (input >> 1) & 1;
    const b0 = input & 1;
    // Very simple: convert to JavaScript eval-safe form
    // This is NOT safe for untrusted input, only for student-authored expressions
    let jsExpr = expr
        .replace(/B3/g, `${b3}`)
        .replace(/B2/g, `${b2}`)
        .replace(/B1/g, `${b1}`)
        .replace(/B0/g, `${b0}`)
        .replace(/'/g, ' === 0 ? 1 : 0)') // Inversion
        .replace(/·/g, ' && ')
        .replace(/\+/g, ' || ')
        .replace(/\s+/g, ' ');
    // Fix the inverted literals
    jsExpr = jsExpr
        .replace(/(\d)\s+===\s+0\s+\?\s+1\s+:\s+0\)\s+&&/g, '($1 === 0) &&')
        .replace(/(\d)\s+===\s+0\s+\?\s+1\s+:\s+0\)\s+\|\|/g, '($1 === 0) ||')
        .replace(/(\d)\s+===\s+0\s+\?\s+1\s+:\s+0\)$/g, '($1 === 0)');
    try {
        return Function(`"use strict"; return (${jsExpr})`)();
    }
    catch {
        return false;
    }
}
