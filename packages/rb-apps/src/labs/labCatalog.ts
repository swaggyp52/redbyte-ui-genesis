// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * labCatalog.ts — Single source of truth for all lab template definitions.
 *
 * Labs are circuit templates + rubric overlays that load INTO the IDE.
 * They are not a course. They are not a progress tracker.
 * No "completed", "active", or "locked" status lives here — those are
 * transient UI states managed elsewhere (or not at all).
 */

export interface StarterInstructions {
  labId: string;
  title: string;
  timeEstimate: string;
  learningGoal: string;
  steps: string[];
  commonMistakes: string[];
  submit: string[];
  rubric: string[];
}

export interface LabDefinition {
  id: string;
  number: string;
  title: string;
  description: string;
  tags: string[];
  timeEstimate: string;
  appId: string;
  starterInstructions?: StarterInstructions;
}

export const LAB_CATALOG: LabDefinition[] = [
  {
    id: 'lab-01',
    number: '01',
    title: 'Gates & Wires',
    description: 'Basic logic gates. Build the foundation of every digital system.',
    timeEstimate: '45 min',
    appId: 'logic-playground',
    tags: ['AND', 'OR', 'NOT'],
  },
  {
    id: 'lab-02',
    number: '02',
    title: 'Combinational Logic',
    description: 'Multiplexers, decoders, and combinational truth tables.',
    timeEstimate: '60 min',
    appId: 'logic-playground',
    tags: ['MUX', 'DECODER'],
  },
  {
    id: 'lab-03',
    number: '03',
    title: 'Sequential Circuits',
    description: 'Latches, flip-flops, and state. Your first clocked circuit.',
    timeEstimate: '75 min',
    appId: 'logic-playground',
    tags: ['D-FF', 'LATCH'],
  },
  {
    id: 'lab-04',
    number: '04',
    title: 'ALU — Opcode Control',
    description: 'Wire a 4-bit ALU datapath and define 4 operations via opcode decoder.',
    timeEstimate: '90 min',
    appId: 'logic-playground',
    tags: ['ALU', 'ADDER', 'MUX', 'DECODER'],
    starterInstructions: {
      labId: 'lab-04',
      title: 'Lab 4 — ALU with Opcode Control',
      timeEstimate: '90 min',
      learningGoal:
        'Wire a 4-bit ALU datapath using pre-verified subcomponents and define operation selection via opcode decoder',
      steps: [
        'Inspect the pre-built subcomponents: 4-bit ripple-carry adder, 4-to-1 MUX, 2-to-4 decoder',
        'Connect the adder output to the MUX data inputs',
        'Route the 2-bit opcode lines to the decoder',
        'Connect decoder outputs to MUX select lines',
        'Route carry-out and zero flags to LED outputs',
        'Verify all 4 operations pass the test vector table',
        'Export VHDL + XDC for Vivado',
      ],
      commonMistakes: [
        'Opcode bits connected in wrong order (MSB/LSB swap)',
        'Carry-out not routed to LED output',
        'MUX select lines connected to wrong decoder output',
      ],
      submit: [
        'Click "Export for Basys3" in the Export tab',
        'Submit rb-submission.zip to Canvas',
      ],
      rubric: [
        'All 4 ALU operations pass simulation (40%)',
        'VHDL entity ports match XDC constraints (30%)',
        'Correct signal names in generated VHDL (20%)',
        'Evidence bundle included in submission (10%)',
      ],
    },
  },
  {
    id: 'lab-05',
    number: '05',
    title: 'Finite State Machines',
    description: 'Design a Moore FSM for traffic light control.',
    timeEstimate: '90 min',
    appId: 'logic-playground',
    tags: ['FSM', 'STATE'],
  },
  {
    id: 'lab-06',
    number: '06',
    title: 'Memory & Registers',
    description: 'Register files, RAM arrays, and read/write control logic.',
    timeEstimate: '90 min',
    appId: 'logic-playground',
    tags: ['RAM', 'REGISTER'],
  },
  {
    id: 'lab-07',
    number: '07',
    title: 'Datapath Design',
    description: 'Integrate ALU + registers into a full datapath with control unit.',
    timeEstimate: '120 min',
    appId: 'logic-playground',
    tags: ['DATAPATH', 'CONTROL'],
  },
  {
    id: 'lab-08',
    number: '08',
    title: 'Final Project — CPU',
    description: 'Build a minimal 4-bit CPU and deploy it to the Basys3 board.',
    timeEstimate: '180 min',
    appId: 'logic-playground',
    tags: ['CPU', 'FPGA'],
  },
];
