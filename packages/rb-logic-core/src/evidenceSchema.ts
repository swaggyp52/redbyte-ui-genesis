// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Evidence schema stub for Track 5.1 compatibility
 * Full implementation in rb-apps, this is a minimal type-only export for rb-logic-core
 */

export type EvidenceBundle = {
  schemaVersion: "1.0";
  exportedAtIso: string;
  app: {
    repoSha?: string;
    version?: string;
  };
  context: {
    selectedExampleId?: string | null;
    activePerspective?: string;
  };
  circuitSnapshot: unknown;
  simulationSnapshot: {
    isRunning: boolean;
    tick: number;
    tickRate?: number;
  };
  probes?: Array<{
    id?: string;
    name?: string;
    label?: string;
    source?: string;
  }>;
  ticks?: Array<unknown>;
  oscilloscopeSnapshot?: {
    settings: unknown;
    traces: unknown;
    stats?: {
      tickRange?: [number, number];
      sampleCount?: number;
    };
  };
  integrity?: {
    hashAlg: "fnv1a32" | "crc32" | "sha256" | "djb2";
    integrityHash: string;
    hashedBytes: number;
  };
};
