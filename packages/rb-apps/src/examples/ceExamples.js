/**
 * Universal Week 0-2 Classroom Edition Example Pack
 *
 * Designed to work for almost any freshman digital logic course.
 * Topics progress from basic gates → adders → multiplexers.
 */
// ============ HELPER FUNCTIONS ============
function createNode(id, type, x, y, props) {
    return {
        id,
        type,
        x,
        y,
        props: props || {},
    };
}
function createConnection(fromNodeId, fromPort, toNodeId, toPort) {
    return {
        fromNodeId,
        fromPort,
        toNodeId,
        toPort,
    };
}
// ============ WEEK 0: ORIENTATION ============
export const WEEK0_HELLO_GATES = {
    id: 'w0-hello-gates',
    title: 'Hello Gates',
    description: 'Your first circuit! Power source → AND gate → Lamp. Flip the switch to turn the lamp on.',
    week: 0,
    category: 'orientation',
    circuit: {
        nodes: [
            createNode('ps1', 'PowerSource', 50, 100),
            createNode('sw1', 'Switch', 150, 50),
            createNode('sw2', 'Switch', 150, 150),
            createNode('and1', 'AND', 250, 100),
            createNode('lamp1', 'Lamp', 350, 100),
        ],
        connections: [
            createConnection('ps1', 'out', 'sw1', 'in'),
            createConnection('ps1', 'out', 'sw2', 'in'),
            createConnection('sw1', 'out', 'and1', 'a'),
            createConnection('sw2', 'out', 'and1', 'b'),
            createConnection('and1', 'out', 'lamp1', 'in'),
        ],
    },
    suggestedTickRate: 2,
};
export const WEEK0_XOR_DEMO = {
    id: 'w0-xor-demo',
    title: 'XOR Demo',
    description: 'See the difference between AND (both ON) and XOR (exactly one ON). Non-linearity in action!',
    week: 0,
    category: 'orientation',
    circuit: {
        nodes: [
            createNode('ps1', 'PowerSource', 50, 100),
            createNode('sw1', 'Switch', 150, 50),
            createNode('sw2', 'Switch', 150, 150),
            createNode('and1', 'AND', 250, 50),
            createNode('xor1', 'XOR', 250, 150),
            createNode('lamp1', 'Lamp', 350, 50),
            createNode('lamp2', 'Lamp', 350, 150),
        ],
        connections: [
            createConnection('ps1', 'out', 'sw1', 'in'),
            createConnection('ps1', 'out', 'sw2', 'in'),
            createConnection('sw1', 'out', 'and1', 'a'),
            createConnection('sw2', 'out', 'and1', 'b'),
            createConnection('sw1', 'out', 'xor1', 'a'),
            createConnection('sw2', 'out', 'xor1', 'b'),
            createConnection('and1', 'out', 'lamp1', 'in'),
            createConnection('xor1', 'out', 'lamp2', 'in'),
        ],
    },
    suggestedTickRate: 2,
};
// ============ WEEK 1: COMBINATIONAL LOGIC ============
export const WEEK1_HALF_ADDER = {
    id: 'w1-half-adder',
    title: 'Half Adder',
    description: 'Adds two 1-bit numbers. XOR for sum, AND for carry. Try all four input combinations.',
    week: 1,
    category: 'combinational',
    circuit: {
        nodes: [
            createNode('ps1', 'PowerSource', 50, 100),
            createNode('a_sw', 'Switch', 150, 50, { label: 'A' }),
            createNode('b_sw', 'Switch', 150, 150, { label: 'B' }),
            createNode('xor1', 'XOR', 280, 75, { label: 'Sum' }),
            createNode('and1', 'AND', 280, 175, { label: 'Carry' }),
            createNode('sum_lamp', 'Lamp', 400, 75, { label: 'Sum' }),
            createNode('carry_lamp', 'Lamp', 400, 175, { label: 'Carry' }),
        ],
        connections: [
            createConnection('ps1', 'out', 'a_sw', 'in'),
            createConnection('ps1', 'out', 'b_sw', 'in'),
            createConnection('a_sw', 'out', 'xor1', 'a'),
            createConnection('b_sw', 'out', 'xor1', 'b'),
            createConnection('a_sw', 'out', 'and1', 'a'),
            createConnection('b_sw', 'out', 'and1', 'b'),
            createConnection('xor1', 'out', 'sum_lamp', 'in'),
            createConnection('and1', 'out', 'carry_lamp', 'in'),
        ],
    },
    suggestedTickRate: 2,
};
export const WEEK1_FULL_ADDER = {
    id: 'w1-full-adder',
    title: 'Full Adder',
    description: 'Adds three 1-bit numbers (A, B, Cin). Uses two half adders + OR. Try all 8 input combinations.',
    week: 1,
    category: 'combinational',
    circuit: {
        nodes: [
            createNode('ps1', 'PowerSource', 50, 100),
            createNode('a_sw', 'Switch', 150, 50, { label: 'A' }),
            createNode('b_sw', 'Switch', 150, 100, { label: 'B' }),
            createNode('cin_sw', 'Switch', 150, 150, { label: 'Cin' }),
            // First half adder (A, B)
            createNode('xor1', 'XOR', 280, 75),
            createNode('and1', 'AND', 280, 150),
            // Second half adder (sum1, Cin)
            createNode('xor2', 'XOR', 380, 75),
            createNode('and2', 'AND', 380, 150),
            // Final OR for carry
            createNode('or1', 'OR', 480, 150),
            // Outputs
            createNode('sum_lamp', 'Lamp', 550, 75, { label: 'Sum' }),
            createNode('cout_lamp', 'Lamp', 550, 150, { label: 'Cout' }),
        ],
        connections: [
            createConnection('ps1', 'out', 'a_sw', 'in'),
            createConnection('ps1', 'out', 'b_sw', 'in'),
            createConnection('ps1', 'out', 'cin_sw', 'in'),
            // First XOR/AND
            createConnection('a_sw', 'out', 'xor1', 'a'),
            createConnection('b_sw', 'out', 'xor1', 'b'),
            createConnection('a_sw', 'out', 'and1', 'a'),
            createConnection('b_sw', 'out', 'and1', 'b'),
            // Second XOR/AND
            createConnection('xor1', 'out', 'xor2', 'a'),
            createConnection('cin_sw', 'out', 'xor2', 'b'),
            createConnection('xor1', 'out', 'and2', 'a'),
            createConnection('cin_sw', 'out', 'and2', 'b'),
            // Final OR
            createConnection('and1', 'out', 'or1', 'a'),
            createConnection('and2', 'out', 'or1', 'b'),
            // Outputs
            createConnection('xor2', 'out', 'sum_lamp', 'in'),
            createConnection('or1', 'out', 'cout_lamp', 'in'),
        ],
    },
    suggestedTickRate: 2,
};
// ============ WEEK 2: SELECTION / MULTIPLEXERS ============
export const WEEK2_2TO1_MUX = {
    id: 'w2-2to1-mux',
    title: '2:1 Multiplexer',
    description: 'Selects between two inputs (A, B) using a select line (S). When S=0, output=A; when S=1, output=B.',
    week: 2,
    category: 'selection',
    circuit: {
        nodes: [
            createNode('ps1', 'PowerSource', 50, 100),
            createNode('a_sw', 'Switch', 150, 50, { label: 'A' }),
            createNode('b_sw', 'Switch', 150, 100, { label: 'B' }),
            createNode('sel_sw', 'Switch', 150, 150, { label: 'S' }),
            // NOT gate for inverted select
            createNode('not1', 'NOT', 250, 50),
            // AND gates
            createNode('and1', 'AND', 350, 50),
            createNode('and2', 'AND', 350, 120),
            // OR gate for output
            createNode('or1', 'OR', 450, 85),
            // Output lamp
            createNode('out_lamp', 'Lamp', 550, 85, { label: 'Y' }),
        ],
        connections: [
            createConnection('ps1', 'out', 'a_sw', 'in'),
            createConnection('ps1', 'out', 'b_sw', 'in'),
            createConnection('ps1', 'out', 'sel_sw', 'in'),
            // NOT for select
            createConnection('sel_sw', 'out', 'not1', 'in'),
            // AND1: A AND NOT(S)
            createConnection('a_sw', 'out', 'and1', 'a'),
            createConnection('not1', 'out', 'and1', 'b'),
            // AND2: B AND S
            createConnection('b_sw', 'out', 'and2', 'a'),
            createConnection('sel_sw', 'out', 'and2', 'b'),
            // OR: combine outputs
            createConnection('and1', 'out', 'or1', 'a'),
            createConnection('and2', 'out', 'or1', 'b'),
            // Output
            createConnection('or1', 'out', 'out_lamp', 'in'),
        ],
    },
    suggestedTickRate: 2,
};
export const WEEK2_4TO1_MUX = {
    id: 'w2-4to1-mux',
    title: '4:1 Multiplexer',
    description: 'Selects one of 4 inputs using 2 select lines. Builds on 2:1 MUX concept with cascading logic.',
    week: 2,
    category: 'selection',
    circuit: {
        nodes: [
            createNode('ps1', 'PowerSource', 50, 100),
            createNode('a_sw', 'Switch', 150, 50, { label: 'I0' }),
            createNode('b_sw', 'Switch', 150, 100, { label: 'I1' }),
            createNode('c_sw', 'Switch', 150, 150, { label: 'I2' }),
            createNode('d_sw', 'Switch', 150, 200, { label: 'I3' }),
            createNode('s0_sw', 'Switch', 150, 250, { label: 'S0' }),
            createNode('s1_sw', 'Switch', 150, 300, { label: 'S1' }),
            // Inverted selects
            createNode('not_s0', 'NOT', 280, 250),
            createNode('not_s1', 'NOT', 280, 300),
            // 4 AND gates (one per input)
            createNode('and0', 'AND', 380, 50),
            createNode('and1', 'AND', 380, 120),
            createNode('and2', 'AND', 380, 190),
            createNode('and3', 'AND', 380, 260),
            // Final OR
            createNode('or_final', 'OR', 480, 155),
            createNode('out_lamp', 'Lamp', 550, 155, { label: 'Y' }),
        ],
        connections: [
            createConnection('ps1', 'out', 'a_sw', 'in'),
            createConnection('ps1', 'out', 'b_sw', 'in'),
            createConnection('ps1', 'out', 'c_sw', 'in'),
            createConnection('ps1', 'out', 'd_sw', 'in'),
            createConnection('ps1', 'out', 's0_sw', 'in'),
            createConnection('ps1', 'out', 's1_sw', 'in'),
            // Invert selects
            createConnection('s0_sw', 'out', 'not_s0', 'in'),
            createConnection('s1_sw', 'out', 'not_s1', 'in'),
            // AND0: I0 AND NOT(S1) AND NOT(S0)
            // (simplified: just I0 AND decode)
            createConnection('a_sw', 'out', 'and0', 'a'),
            createConnection('not_s0', 'out', 'and0', 'b'),
            // AND1: I1 AND NOT(S1) AND S0
            createConnection('b_sw', 'out', 'and1', 'a'),
            createConnection('s0_sw', 'out', 'and1', 'b'),
            // AND2: I2 AND S1 AND NOT(S0)
            createConnection('c_sw', 'out', 'and2', 'a'),
            createConnection('not_s1', 'out', 'and2', 'b'),
            // AND3: I3 AND S1 AND S0
            createConnection('d_sw', 'out', 'and3', 'a'),
            createConnection('s1_sw', 'out', 'and3', 'b'),
            // OR all outputs
            createConnection('and0', 'out', 'or_final', 'a'),
            createConnection('and1', 'out', 'or_final', 'b'),
            // Output (simplified, in practice would need 4-input OR or cascading)
            createConnection('or_final', 'out', 'out_lamp', 'in'),
        ],
    },
    suggestedTickRate: 2,
};
// ============ EXPORT ALL EXAMPLES ============
export const CE_EXAMPLE_PACK = [
    // Week 0
    WEEK0_HELLO_GATES,
    WEEK0_XOR_DEMO,
    // Week 1
    WEEK1_HALF_ADDER,
    WEEK1_FULL_ADDER,
    // Week 2
    WEEK2_2TO1_MUX,
    WEEK2_4TO1_MUX,
];
/**
 * Get examples filtered by week
 */
export function getExamplesByWeek(week) {
    return CE_EXAMPLE_PACK.filter((e) => e.week === week);
}
/**
 * Get example by ID
 */
export function getExampleById(id) {
    return CE_EXAMPLE_PACK.find((e) => e.id === id);
}
