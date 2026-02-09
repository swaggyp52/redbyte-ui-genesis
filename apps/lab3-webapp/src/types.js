// Canonical digit patterns (active-low: 0 = lit, 1 = off)
export const DIGIT_PATTERNS = {
    0: [0, 0, 0, 0, 0, 0, 1], // a,b,c,d,e,f,g
    1: [1, 0, 0, 1, 1, 1, 1],
    2: [0, 0, 1, 0, 0, 1, 0],
    3: [0, 0, 0, 0, 1, 1, 0],
    4: [1, 0, 0, 1, 1, 0, 0],
    5: [0, 1, 0, 0, 1, 0, 0],
    6: [0, 1, 0, 0, 0, 0, 0],
    7: [0, 0, 0, 1, 1, 1, 1],
    8: [0, 0, 0, 0, 0, 0, 0],
    9: [0, 0, 0, 0, 1, 0, 0],
};
export function createEmptyTruthTable() {
    const table = [];
    for (let i = 0; i < 16; i++) {
        const b3 = (i >> 3) & 1 ? 1 : 0;
        const b2 = (i >> 2) & 1 ? 1 : 0;
        const b1 = (i >> 1) & 1 ? 1 : 0;
        const b0 = i & 1 ? 1 : 0;
        table.push({
            b3: b3,
            b2: b2,
            b1: b1,
            b0: b0,
            seg: [1, 1, 1, 1, 1, 1, 1],
            isDontCare: i >= 10,
        });
    }
    return table;
}
export function inputToNumber(row) {
    return (row.b3 << 3) | (row.b2 << 2) | (row.b1 << 1) | row.b0;
}
export function segToNumber(seg) {
    return (seg[6] << 6) | (seg[5] << 5) | (seg[4] << 4) | (seg[3] << 3) | (seg[2] << 2) | (seg[1] << 1) | seg[0];
}
