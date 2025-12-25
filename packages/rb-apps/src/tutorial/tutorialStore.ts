// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';

export interface TutorialStep {
  id: number;
  title: string;
  description: string;
  exampleCircuit?: string;
  docsLink?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  // Layer 0: Foundation - First win for 6th graders
  {
    id: 1,
    title: 'Build a Lamp Circuit',
    description: 'Learn the basics by connecting a switch to a lamp. Click and drag to create wires.',
    exampleCircuit: '01_wire-lamp.json',
    docsLink: '/docs/logic/lesson-01',
  },
  {
    id: 2,
    title: 'Try an AND Gate',
    description: 'Combine two switches with an AND gate. Both must be ON for the lamp to light up.',
    exampleCircuit: '02_and-gate.json',
    docsLink: '/docs/logic/lesson-02',
  },

  // Layer 1: Combinational Logic - Pattern recognition
  {
    id: 3,
    title: 'Build an XOR Gate',
    description: 'Create an XOR gate from NANDs - one input OR the other, but not both. See the pattern emerge!',
    exampleCircuit: '06_xor-gate.json',
    docsLink: '/docs/logic/lesson-03',
  },
  {
    id: 4,
    title: 'Make a Half Adder',
    description: 'Combine gates to add two bits together. This is how computers do math!',
    exampleCircuit: '03_half-adder.json',
    docsLink: '/docs/logic/lesson-04',
  },

  // Layer 2: Arithmetic - "I built something that does math!"
  {
    id: 5,
    title: 'Chain a Full Adder',
    description: 'Add a carry input to build a Full Adder - the building block of real calculators.',
    exampleCircuit: '08_full-adder.json',
    docsLink: '/docs/logic/lesson-05',
  },
  {
    id: 6,
    title: 'Build a 4-bit Adder',
    description: 'Chain four Full Adders to create a 4-bit adder. Watch it add numbers up to 15!',
    exampleCircuit: '09_4bit-adder.json',
    docsLink: '/docs/logic/lesson-06',
  },

  // Layer 3: Memory - The "aha" moment with feedback loops
  {
    id: 7,
    title: 'Create an SR Latch',
    description: 'Build your first memory circuit using feedback loops. It remembers a bit!',
    exampleCircuit: '10_sr-latch.json',
    docsLink: '/docs/logic/lesson-07',
  },
  {
    id: 8,
    title: 'Make a D Flip-Flop',
    description: 'Add clock control to create synchronized memory - the foundation of all computer memory.',
    exampleCircuit: '11_d-flipflop.json',
    docsLink: '/docs/logic/lesson-08',
  },

  // Special: Chip System Introduction
  {
    id: 9,
    title: 'Save Your First Chip',
    description: 'Build a Half Adder, then click "Save as Chip" to make it reusable. Chips are the key to building complex systems!',
    exampleCircuit: '03_half-adder.json',
    docsLink: '/docs/logic/lesson-09',
  },

  // Layer 4: Control & Coordination - Data routing and selection
  {
    id: 10,
    title: 'Build a 2-to-4 Decoder',
    description: 'Create a decoder that converts 2 bits into 4 output lines - the basis of memory addressing.',
    exampleCircuit: '12_2to4-decoder.json',
    docsLink: '/docs/logic/lesson-10',
  },
  {
    id: 11,
    title: 'Make a 4-to-1 Multiplexer',
    description: 'Build a circuit that selects one of four inputs - essential for data routing in CPUs.',
    exampleCircuit: '13_4to1-mux.json',
    docsLink: '/docs/logic/lesson-11',
  },

  // Layer 5: Memory Systems - Combining latches into registers
  {
    id: 12,
    title: 'Create a 4-bit Register',
    description: 'Combine four D flip-flops to store 4 bits at once - this is how CPUs remember numbers!',
    exampleCircuit: '14_4bit-register.json',
    docsLink: '/docs/logic/lesson-12',
  },

  // Layer 6: Full CPU - The ultimate "I understand computers" moment
  {
    id: 13,
    title: 'Explore a Simple CPU',
    description: 'See how everything comes together - a complete CPU that runs real programs!',
    exampleCircuit: '05_simple-cpu.json',
    docsLink: '/docs/logic/lesson-13',
  },
];

export interface TutorialState {
  step: number;
  active: boolean;
  start: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
  goToStep: (step: number) => void;
}

export const useTutorialStore = create<TutorialState>((set, get) => ({
  step: 0,
  active: false,

  start: () => {
    set({ active: true, step: 0 });
  },

  next: () => {
    const { step } = get();
    if (step < TUTORIAL_STEPS.length - 1) {
      set({ step: step + 1 });
    } else {
      // End of tutorial
      set({ active: false, step: 0 });
    }
  },

  prev: () => {
    const { step } = get();
    if (step > 0) {
      set({ step: step - 1 });
    }
  },

  stop: () => {
    set({ active: false, step: 0 });
  },

  goToStep: (step: number) => {
    if (step >= 0 && step < TUTORIAL_STEPS.length) {
      set({ step });
    }
  },
}));
