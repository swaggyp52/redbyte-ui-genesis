// Evidence schema for minimal deterministic lab export (Track 5.1)
// TypeScript type definition

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
  circuitSnapshot: unknown; // To be filled with canonical circuit JSON
  simulationSnapshot: {
    isRunning: boolean;
    tick: number;
    tickRate?: number;
  };
  probesSnapshot: Array<{
    id: string;
    label?: string;
    source?: string;
  }>;
  oscilloscopeSnapshot: {
    settings: unknown;
    traces: unknown;
    stats?: {
      tickRange?: [number, number];
      sampleCount?: number;
    };
  };
  integrity: {
    hashAlg: "fnv1a32" | "crc32";
    integrityHash: string;
    hashedBytes: number;
  };
};
