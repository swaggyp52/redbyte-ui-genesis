// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { LAB_2_ADDER_CONTENT, type LabDefinition } from './lab2-adder';
export type { LabDefinition } from './lab2-adder';

export type LabContent = LabStep[] | LabDefinition;

export interface LabStep {
    id: string;
    title: string;
    markdown: string;
    checkpoint?: {
        signal: string;
        expectedValue: number;
        description: string;
    };
}

export const LAB_1_CONTENT: LabStep[] = [
    {
        id: 'intro',
        title: 'Introduction to Digital Logic',
        markdown: `
# Welcome to Lab 1

In this lab, you will verify the basic operation of your FPGA board's input/output (I/O) capabilities.

**Objectives:**
1. Connect your hardware board.
2. Manipulate physical switches.
3. Observe LED output in the **RedByte** interface.
        `
    },
    {
        id: 'setup',
        title: 'Hardware Setup',
        markdown: `
# Hardware Setup

1. Ensure your board (Basys3 or Spartan-3E) is plugged in.
2. In the **RedByte** app toolbar, verify the connection status is **Ready**.
3. If not connected, click **Connect** in the Hardware panel on the right.

*Note: If you are simulating, just ensuring the "Sim-Only" or "Mock" driver is active is sufficient.*
        `
    },
    {
        id: 'task1',
        title: 'Task 1: The Switch-LED Link',
        markdown: `
# Task 1: Basic I/O

The default design loaded on your board connects each **Switch (SW)** directly to its corresponding **LED**.

**Action:**
1. Flip **SW0** to the **ON** (up/1) position.
2. Observe **LED0** turning **ON**.

Click **Verify** below when you have set SW0 to 1.
        `,
        checkpoint: {
            signal: 'LED0',
            expectedValue: 1,
            description: 'Ensure LED0 is ON (High)'
        }
    },
    {
        id: 'completion',
        title: 'Lab Completion',
        markdown: `
# Congratulations!

You have successfully verified the hardware link.

**Final Step:**
Click **Export Evidence** to save a snapshot of your work (Trace + Report) to the file system. You can submit this capsule as proof of completion.
        `
    }
];

export const LAB_2_CONTENT: LabStep[] = [
    {
        id: 'intro',
        title: 'Lab 2: 4-Bit Binary Adder',
        markdown: `
# Lab 2: 4-Bit Binary Adder

In this lab, you will design and implement a 4-bit ripple-carry adder and verify it on hardware. You will also integrate an analog light sensor (LDR) using a hardware comparator.

**Objectives:**
1. Design a 4-bit adder using logic gates (or Full Adder components).
2. Simulate the adder to verify correctness (Truth Table).
3. Connect the LDR sensor input via a hardware comparator.
4. Deployment to FPGA and hardware verification.
        `
    },
    {
        id: 'design',
        title: 'Task 1: Circuit Design',
        markdown: `
# Task 1: 4-Bit Adder Design

Construct a 4-bit adder that adds two 4-bit numbers **A** and **B** to produce a 4-bit **Sum** and a **Carry Out**.

**Requirements:**
- Inputs: **A[3:0]**, **B[3:0]**, **Cin**
- Outputs: **Sum[3:0]**, **Cout**
- Use Full Adders cascaded together.

**Board Mapping:**
- A[0-3] -> SW0-SW3
- B[0-3] -> SW4-SW7
- Cin -> SW15 (Optional manual carry)
- Sum[0-3] -> LED0-LED3
- Cout -> LED4
        `
    },
    {
        id: 'simulation',
        title: 'Task 2: Simulation Verification',
        markdown: `
# Task 2: Simulation Verification

Verify your design by testing the following cases:

1. **0 + 0**: Set all switches to 0. Correct Sum = 0.
2. **1 + 1**: Set A=1, B=1. Correct Sum = 2 (LED1 ON).
3. **15 + 1**: Set A=1111 (15), B=0001 (1). Correct Sum = 0, Cout = 1.
4. **General Case**: Try 3 + 5 = 8.

Click **Run Self-Check** to automatically verify all combinations.
        `,
        checkpoint: {
            signal: 'Cout',
            expectedValue: 1,
            description: 'Verify 15 + 1 produces Carry Out'
        }
    },
    {
        id: 'sensor',
        title: 'Task 3: Analog Sensor Integration',
        markdown: `
# Task 3: LDR Sensor Integration

Integrate the Light Dependent Resistor (LDR) circuit.

1. Build the LDR + LM358 comparator circuit on your breadboard.
2. Connect the LM358 output to **JB1** (or designated input pin).
3. Map this input to influence your adder (e.g. use it as **Cin** instead of SW15).

**Observation:**
- Cover the LDR -> Comparator Low -> Cin=0
- Shine light -> Comparator High -> Cin=1
- Verify that light levels change your add result (e.g. 5+5+1 vs 5+5+0).
        `
    },
    {
        id: 'hardware',
        title: 'Task 4: Hardware Deployment',
        markdown: `
# Task 4: FPGA Verification

1. Connect your Basys3 board.
2. Click **Program FPGA** in the Hardware tab.
3. Once programmed, manipulate the physical switches and observe the physical LEDs.
4. Verify the LDR sensor interaction on real hardware.
        `
    },
    {
        id: 'submit',
        title: 'Lab Submission',
        markdown: `
# Lab Completion

You have successfully built and tested a mixed-signal digital system!

**Submission:**
Click **Export Project** to generate your .rbx.zip submission file. This file contains your circuit, test results, and hardware configuration.
        `
    }
];

export const LABS: Record<string, LabContent> = {
    'lab-1': LAB_1_CONTENT,
    'lab-2': LAB_2_CONTENT,
    'lab2_adder': LAB_2_ADDER_CONTENT
};

// ---------------------------------------------------------------------------
// Metadata helper — extracts title, objectives, step count from any lab format
// ---------------------------------------------------------------------------

export interface LabMetadata {
    title: string;
    objectives: string[];
    stepCount: number;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
}

const LAB_META_OVERRIDES: Record<string, Partial<LabMetadata>> = {
    'lab-1': { title: 'Lab 1: Introduction to Digital Logic', difficulty: 'beginner', objectives: ['Connect hardware board', 'Manipulate physical switches', 'Observe LED output'] },
    'lab-2': { title: 'Lab 2: 4-Bit Binary Adder', difficulty: 'intermediate', objectives: ['Design a 4-bit adder', 'Simulate and verify', 'Integrate analog sensor', 'Deploy to FPGA'] },
    'lab2_adder': { title: 'Lab 2: 4-Bit Adder (Extended)', difficulty: 'intermediate', objectives: ['Build ripple-carry adder', 'Magnitude comparator', 'Hardware verification'] },
};

export function getLabMetadata(labId: string): LabMetadata {
    const content = LABS[labId];
    const overrides = LAB_META_OVERRIDES[labId] ?? {};

    if (!content) {
        return { title: labId, objectives: [], stepCount: 0, difficulty: 'beginner', ...overrides };
    }

    const isArray = Array.isArray(content);
    const stepCount = isArray ? content.length : content.steps.length;

    // Extract title from first step if not overridden
    let title = overrides.title ?? labId;
    if (!overrides.title) {
        if (isArray && content.length > 0) {
            title = content[0].title;
        } else if (!isArray) {
            title = content.title ?? labId;
        }
    }

    // Extract objectives from the LabDefinition format or use overrides
    let objectives = overrides.objectives ?? [];
    if (!overrides.objectives && !isArray && content.objectives) {
        objectives = content.objectives;
    }

    return {
        title,
        objectives,
        stepCount,
        difficulty: overrides.difficulty ?? 'beginner',
    };
}

export function getLabStepTitles(labId: string): string[] {
    const content = LABS[labId];
    if (!content) return [];
    if (Array.isArray(content)) return content.map((s) => s.title);
    return content.steps.map((s: any) => s.title ?? s.id ?? 'Step');
}
