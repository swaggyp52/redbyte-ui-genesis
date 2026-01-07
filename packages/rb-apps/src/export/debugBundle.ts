// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit } from '@redbyte/rb-logic-core';
import type { RunRecord, ProofPack } from '../recording/runRecord';
import type { HealthIssue } from '../logic/circuitHealth';
import type { RBProject } from './projectFormat';
import { netlistFromCircuit } from './netlistExport';
import { verilogFromNetlist } from './verilogExport';

export interface CircuitHealthReport {
  issues: HealthIssue[];
}

export interface DebugBundle {
  kind: 'rb-debug-bundle';
  version: 1;
  createdAt: string;
  project: RBProject;
  netlist: ReturnType<typeof netlistFromCircuit>;
  verilog: string;
  proofPack?: ProofPack;
  health?: CircuitHealthReport;
  runRecord?: RunRecord;
}

export const buildDebugBundle = (params: {
  project: RBProject;
  circuit: Circuit;
  proofPack?: ProofPack;
  health?: CircuitHealthReport;
  runRecord?: RunRecord;
}): DebugBundle => {
  const netlist = netlistFromCircuit(params.circuit);
  return {
    kind: 'rb-debug-bundle',
    version: 1,
    createdAt: new Date().toISOString(),
    project: params.project,
    netlist,
    verilog: verilogFromNetlist(netlist),
    proofPack: params.proofPack,
    health: params.health,
    runRecord: params.runRecord,
  };
};
