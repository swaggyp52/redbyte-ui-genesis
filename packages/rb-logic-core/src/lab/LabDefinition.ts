// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

export interface TestVector {
  id: string;
  name: string;
  inputs: Record<string, 0 | 1>;
  expectedOutputs: Record<string, 0 | 1>;
}

export interface CheckpointDef {
  id: string;
  name: string;
  testVectors: TestVector[];
}
