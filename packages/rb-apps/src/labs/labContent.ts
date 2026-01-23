// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

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
        title: 'Lab 2: Combinational Logic',
        markdown: `
# Lab 2: Logic Gates (AND/XOR)

In this lab, you will implement basic combinational logic using switches and LEDs.

**Objectives:**
1. Implement an **AND** gate (SW0 & SW1 -> LED0).
2. Implement an **XOR** gate (SW2 ^ SW3 -> LED1).
        `
    },
    {
        id: 'and_gate',
        title: 'Task 1: AND Gate',
        markdown: `
# Task 1: The AND Gate

Connect **SW0** and **SW1** such that **LED0** turns ON only when **BOTH** switches are ON.

**Truth Table:**
| SW0 | SW1 | LED0 |
|---|---|---|
| 0 | 0 | 0 |
| 0 | 1 | 0 |
| 1 | 0 | 0 |
| 1 | 1 | 1 |

Click **Verify** when you have set **SW0=1, SW1=1**.
        `,
        checkpoint: {
            signal: 'LED0',
            expectedValue: 1,
            description: 'Verify LED0 is ON (High) when SW0 & SW1 are ON'
        }
    },
    {
        id: 'completion',
        title: 'Lab Completion',
        markdown: `
# Lab 2 Complete!

You have implemented combinational logic.
Click **Export Evidence** to submit your work.
        `
    }
];

export const LABS: Record<string, LabStep[]> = {
    'lab-1': LAB_1_CONTENT,
    'lab-2': LAB_2_CONTENT
};

