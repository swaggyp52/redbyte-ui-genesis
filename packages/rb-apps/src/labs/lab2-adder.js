export const LAB2_ADDER_PRESETS = {
    id: 'lab2_adder_truth_table',
    title: 'Adder Truth Table',
    description: 'Validates all 4-bit addition combinations for inputs A, B, and Cin.',
    presets: [
        {
            name: "Zero + Zero",
            inputs: { SW: "000000000" }, // Cin(1) + B(4) + A(4) -> 0_0000_0000
            expectedOutputs: { LED: "00000" } // Cout(1) + Sum(4) -> 0_0000
        },
        {
            name: "1 + 1",
            inputs: { SW: "000010001" }, // B=1, A=1
            expectedOutputs: { LED: "00010" } // Sum=2
        },
        {
            name: "15 + 1 (Overflow)",
            inputs: { SW: "000011111" }, // B=1, A=15
            expectedOutputs: { LED: "10000" } // Cout=1, Sum=0
        },
        {
            name: "5 + 5 (Comparator)",
            inputs: { SW: "001010101" }, // B=5, A=5
            expectedOutputs: { LED: "01010" } // Sum=10 (Verify Comparator LED15 separately or include here if mapped)
        }
    ]
};
export const LAB_2_ADDER_CONTENT = {
    id: 'lab2_adder',
    title: 'Lab 2: 4-Bit Adder with Comparator',
    objectives: [
        'Design a 1-bit full adder using basic logic gates (XOR, AND, OR).',
        'Cascade four 1-bit adders to create a 4-bit ripple-carry adder.',
        'Implement a magnitude comparator to detect specific sum values.',
        'Verify the design on the Basys3 FPGA board using switches and LEDs.'
    ],
    steps: [
        {
            id: 'intro',
            title: 'Lab Overview',
            description: 'In this lab, you will build a 4-bit adder from scratch. You will start by understanding the Full Adder logic, then chain them together. Finally, you will add a unique feature: a comparator that lights up a specific LED when the sum equals 10 (0xA).',
            markdown: `
# Lab 2 Overview

Digital addition is fundamental to all computing. In this lab, we move beyond single gates to build combinational circuits that perform arithmetic.

**Key Concepts:**
- **Half Adder vs. Full Adder**: Handling the carry bit.
- **Ripple Carry**: How bits propagate through the chain.
- **Comparators**: Detecting specific binary patterns.
      `
        },
        {
            id: 'design_fa',
            title: 'Step 1: 1-Bit Full Adder',
            description: 'Create a custom chip named "FullAdder" that handles A, B, and Cin.',
            checklist: [
                'Create new Custom Chip "FullAdder"',
                'Inputs: A, B, Cin',
                'Outputs: Sum, Cout',
                'Logic: Sum = A ⊕ B ⊕ Cin',
                'Logic: Cout = (A·B) + (Cin·(A⊕B))',
                'Verify truth table with simulation'
            ]
        },
        {
            id: 'build_4bit',
            title: 'Step 2: 4-Bit Ripple Carry',
            description: 'On the main canvas, place four "FullAdder" chips and chain them.',
            checklist: [
                'Place 4 FullAdder chips',
                'Connect Carry Chain (Cout -> Cin)',
                'Connect Inputs A[0-3] to SW[0-3]',
                'Connect Inputs B[0-3] to SW[4-7]',
                'Connect Sum[0-3] to LED[0-3]',
                'Connect Final Cout to LED[4]'
            ]
        },
        {
            id: 'comparator',
            title: 'Step 3: Magnitude Comparator',
            description: 'Add logic to detect when the Sum is equal to 10 (Binary 1010).',
            checklist: [
                'Analyze binary for 10: (Sum3=1, Sum2=0, Sum1=1, Sum0=0)',
                'Implement AND gate logic to detect this specific pattern',
                'Connect comparator output to LED15 (Blue RGB or separate LED)'
            ]
        },
        {
            id: 'verification',
            title: 'Step 4: Hardware Verification',
            description: 'Connect your Basys3 board and verify the physical behavior.',
            checklist: [
                'Connect Basys3 Board',
                'Toggle input switches to test 5 + 5 = 10 (Comparator should light up)',
                'Test overflow case: 15 + 1 = 0 (with Carry Out)',
                'Export Evidence (Trace + Video)'
            ]
        }
    ],
    constraints: {
        disallowComponents: ['adder-4bit', 'alu-4bit'],
        requiredIoMapping: {
            inputs: [
                { pattern: 'SW[0-3]', role: 'Operand A' },
                { pattern: 'SW[4-7]', role: 'Operand B' }
            ],
            outputs: [
                { pattern: 'LED[0-3]', role: 'Sum Result' },
                { pattern: 'LED[4]', role: 'Carry Out' },
                { pattern: 'LED[15]', role: 'Comparator Match (10)' }
            ]
        }
    },
    metadata: {
        hardwareRequired: true,
        board: 'basys3',
        difficulty: 'intermediate',
        estimatedDurationMin: 45
    },
    presets: [LAB2_ADDER_PRESETS]
};
