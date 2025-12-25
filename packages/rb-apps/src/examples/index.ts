// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { SerializedCircuitV1 } from '@redbyte/rb-logic-core';
import example01 from './01_wire-lamp.json';
import example02 from './02_and-gate.json';
import example03 from './03_half-adder.json';
import example04 from './04_4bit-counter.json';
import example05 from './05_simple-cpu.json';
import example06 from './06_xor-gate.json';
import example07 from './07_2to1-mux.json';
import example08 from './08_full-adder.json';
import example09 from './09_4bit-adder.json';
import example10 from './10_sr-latch.json';
import example11 from './11_d-flipflop.json';
import example12 from './12_2to4-decoder.json';
import example13 from './13_4to1-mux.json';
import example14 from './14_4bit-register.json';

export type ExampleId =
  | '01_wire-lamp'
  | '02_and-gate'
  | '03_half-adder'
  | '04_4bit-counter'
  | '05_simple-cpu'
  | '06_xor-gate'
  | '07_2to1-mux'
  | '08_full-adder'
  | '09_4bit-adder'
  | '10_sr-latch'
  | '11_d-flipflop'
  | '12_2to4-decoder'
  | '13_4to1-mux'
  | '14_4bit-register';

export type CircuitLayer = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface ExampleMetadata {
  id: ExampleId;
  name: string;
  description: string;
  layer: CircuitLayer;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

const examples: Record<ExampleId, { data: SerializedCircuitV1; metadata: ExampleMetadata }> = {
  // Layer 0: Foundation - Basic gates and wires
  '01_wire-lamp': {
    data: example01 as SerializedCircuitV1,
    metadata: {
      id: '01_wire-lamp',
      name: 'Wire + Lamp',
      description: 'Basic power source connected to a lamp',
      layer: 0,
      difficulty: 'beginner',
    },
  },
  '02_and-gate': {
    data: example02 as SerializedCircuitV1,
    metadata: {
      id: '02_and-gate',
      name: 'AND Gate',
      description: 'Two switches controlling a lamp through an AND gate',
      layer: 0,
      difficulty: 'beginner',
    },
  },

  // Layer 1: Combinational Logic - Simple patterns
  '03_half-adder': {
    data: example03 as SerializedCircuitV1,
    metadata: {
      id: '03_half-adder',
      name: 'Half Adder',
      description: '1-bit half adder with sum and carry outputs',
      layer: 1,
      difficulty: 'beginner',
    },
  },
  '06_xor-gate': {
    data: example06 as SerializedCircuitV1,
    metadata: {
      id: '06_xor-gate',
      name: 'XOR Gate from NANDs',
      description: 'Build XOR using three NAND gates - see the pattern emerge',
      layer: 1,
      difficulty: 'beginner',
    },
  },
  '07_2to1-mux': {
    data: example07 as SerializedCircuitV1,
    metadata: {
      id: '07_2to1-mux',
      name: '2-to-1 Multiplexer',
      description: 'Choose between two inputs using a select signal',
      layer: 1,
      difficulty: 'intermediate',
    },
  },

  // Layer 2: Arithmetic & Logic - Reusable chips
  '08_full-adder': {
    data: example08 as SerializedCircuitV1,
    metadata: {
      id: '08_full-adder',
      name: 'Full Adder',
      description: '1-bit full adder with carry-in support for chaining',
      layer: 2,
      difficulty: 'intermediate',
    },
  },
  '09_4bit-adder': {
    data: example09 as SerializedCircuitV1,
    metadata: {
      id: '09_4bit-adder',
      name: '4-bit Ripple Carry Adder',
      description: 'Chain four full adders to add 4-bit numbers - this does math!',
      layer: 2,
      difficulty: 'intermediate',
    },
  },

  // Layer 3: Memory & State - Sequential logic
  '10_sr-latch': {
    data: example10 as SerializedCircuitV1,
    metadata: {
      id: '10_sr-latch',
      name: 'SR Latch (Memory)',
      description: 'First memory circuit - stores 1 bit using feedback loops',
      layer: 3,
      difficulty: 'intermediate',
    },
  },
  '11_d-flipflop': {
    data: example11 as SerializedCircuitV1,
    metadata: {
      id: '11_d-flipflop',
      name: 'D Flip-Flop',
      description: 'Clock-controlled memory - the foundation of registers',
      layer: 3,
      difficulty: 'advanced',
    },
  },
  '04_4bit-counter': {
    data: example04 as SerializedCircuitV1,
    metadata: {
      id: '04_4bit-counter',
      name: '4-bit Counter',
      description: 'Clock-driven 4-bit binary counter - watch it count!',
      layer: 3,
      difficulty: 'advanced',
    },
  },

  // Layer 4: Control & Coordination - Decoders, multiplexers, control units
  '12_2to4-decoder': {
    data: example12 as SerializedCircuitV1,
    metadata: {
      id: '12_2to4-decoder',
      name: '2-to-4 Decoder',
      description: 'Decodes 2-bit input into 4 output lines - basis of memory addressing',
      layer: 4,
      difficulty: 'intermediate',
    },
  },
  '13_4to1-mux': {
    data: example13 as SerializedCircuitV1,
    metadata: {
      id: '13_4to1-mux',
      name: '4-to-1 Multiplexer',
      description: 'Selects one of four inputs using 2 control signals - data routing!',
      layer: 4,
      difficulty: 'advanced',
    },
  },

  // Layer 5: Memory Systems - Registers, RAM, ROM
  '14_4bit-register': {
    data: example14 as SerializedCircuitV1,
    metadata: {
      id: '14_4bit-register',
      name: '4-bit Register',
      description: 'Stores 4 bits simultaneously - the building block of CPU registers',
      layer: 5,
      difficulty: 'advanced',
    },
  },

  // Layer 6: Simple Processors - 8-bit computers
  '05_simple-cpu': {
    data: example05 as SerializedCircuitV1,
    metadata: {
      id: '05_simple-cpu',
      name: 'Simple CPU',
      description: 'Basic CPU with registers and ALU - runs real programs',
      layer: 6,
      difficulty: 'advanced',
    },
  },
};

export function listExamples(): ExampleMetadata[] {
  return Object.values(examples).map((ex) => ex.metadata);
}

export function listExamplesByLayer(layer: CircuitLayer): ExampleMetadata[] {
  return Object.values(examples)
    .filter((ex) => ex.metadata.layer === layer)
    .map((ex) => ex.metadata);
}

export function getExamplesByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): ExampleMetadata[] {
  return Object.values(examples)
    .filter((ex) => ex.metadata.difficulty === difficulty)
    .map((ex) => ex.metadata);
}

export function getLayerDescription(layer: CircuitLayer): string {
  const descriptions: Record<CircuitLayer, string> = {
    0: 'Foundation - Learn basic gates and how electricity flows',
    1: 'Combinational Logic - Combine gates to create new behaviors',
    2: 'Arithmetic & Logic - Build circuits that do math',
    3: 'Memory & State - Create circuits that remember things',
    4: 'Control & Coordination - Build CPU building blocks',
    5: 'Memory Systems - Design RAM and ROM',
    6: 'Simple Processors - Build complete 8-bit computers',
  };
  return descriptions[layer];
}

export async function loadExample(id: ExampleId): Promise<SerializedCircuitV1> {
  const example = examples[id];
  if (!example) {
    throw new Error(`Example not found: ${id}`);
  }
  return Promise.resolve(example.data);
}
