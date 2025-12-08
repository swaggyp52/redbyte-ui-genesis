// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { SerializedCircuitV1 } from '@redbyte/rb-logic-core';
import example01 from './01_wire-lamp.json';
import example02 from './02_and-gate.json';
import example03 from './03_half-adder.json';
import example04 from './04_4bit-counter.json';
import example05 from './05_simple-cpu.json';

export type ExampleId =
  | '01_wire-lamp'
  | '02_and-gate'
  | '03_half-adder'
  | '04_4bit-counter'
  | '05_simple-cpu';

interface ExampleMetadata {
  id: ExampleId;
  name: string;
  description: string;
}

const examples: Record<ExampleId, { data: SerializedCircuitV1; metadata: ExampleMetadata }> = {
  '01_wire-lamp': {
    data: example01 as SerializedCircuitV1,
    metadata: {
      id: '01_wire-lamp',
      name: 'Wire + Lamp',
      description: 'Basic power source connected to a lamp',
    },
  },
  '02_and-gate': {
    data: example02 as SerializedCircuitV1,
    metadata: {
      id: '02_and-gate',
      name: 'AND Gate',
      description: 'Two switches controlling a lamp through an AND gate',
    },
  },
  '03_half-adder': {
    data: example03 as SerializedCircuitV1,
    metadata: {
      id: '03_half-adder',
      name: 'Half Adder',
      description: '1-bit half adder with sum and carry outputs',
    },
  },
  '04_4bit-counter': {
    data: example04 as SerializedCircuitV1,
    metadata: {
      id: '04_4bit-counter',
      name: '4-bit Counter',
      description: 'Clock-driven 4-bit binary counter',
    },
  },
  '05_simple-cpu': {
    data: example05 as SerializedCircuitV1,
    metadata: {
      id: '05_simple-cpu',
      name: 'Simple CPU',
      description: 'Basic CPU with registers and ALU',
    },
  },
};

export function listExamples(): ExampleMetadata[] {
  return Object.values(examples).map((ex) => ex.metadata);
}

export async function loadExample(id: ExampleId): Promise<SerializedCircuitV1> {
  const example = examples[id];
  if (!example) {
    throw new Error(`Example not found: ${id}`);
  }
  return Promise.resolve(example.data);
}
