// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { netlistFromCircuit } from './netlistExport';
import { verilogFromNetlist } from './verilogExport';
export const buildDebugBundle = (params) => {
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
