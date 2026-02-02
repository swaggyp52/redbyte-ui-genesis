// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// LabRegistry.ts: Central repository for all labs.

export interface LabDefinition {
    id: string;
    title: string;
    description: string;
    hidden?: boolean;
    specPath: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export const AVAILABLE_LABS: LabDefinition[] = [
    {
        id: 'demo-lab',
        title: 'Demo Lab',
        description: 'A simple lab to get started with RedByte.',
        specPath: '/labs/demo-lab.spec.json',
        difficulty: 'beginner',
    },
    {
        id: 'lab-2',
        title: 'Lab 2 – 4-bit Adder',
        description: 'Implement a 4-bit ripple carry adder.',
        specPath: '/labs/lab-2.spec.json',
        difficulty: 'intermediate',
    },
    {
        id: 'lab-3',
        title: 'Lab 3 – Finite State Machine',
        description: 'Design a sequence detector using a Moore FSM.',
        specPath: '/labs/lab-3.spec.json',
        difficulty: 'advanced',
        hidden: true,
    },
];
