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
  {
    id: 1,
    title: 'Build a Lamp Circuit',
    description: 'Learn the basics by connecting a switch to a lamp. Click and drag to create wires.',
    exampleCircuit: '01_wire-lamp.json',
    docsLink: '/docs/logic/lesson-01',
  },
  {
    id: 2,
    title: 'Add an AND Gate',
    description: 'Combine inputs with an AND gate. Both inputs must be ON for the output to be ON.',
    exampleCircuit: '02_and-gate.json',
    docsLink: '/docs/logic/lesson-02',
  },
  {
    id: 3,
    title: 'Build a Counter',
    description: 'Create a 4-bit counter using flip-flops. Watch binary counting in action!',
    exampleCircuit: '04_4bit-counter.json',
    docsLink: '/docs/logic/lesson-03',
  },
  {
    id: 4,
    title: 'Load a Simple CPU',
    description: 'Explore a basic CPU architecture. See how instructions flow through the system.',
    exampleCircuit: '05_simple-cpu.json',
    docsLink: '/docs/logic/lesson-04',
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
