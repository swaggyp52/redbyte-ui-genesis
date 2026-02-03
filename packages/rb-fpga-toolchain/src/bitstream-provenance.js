// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { circuitToVerilog, generateConstraints } from './verilog-generator';
// Local stable hash implementation (avoids circular dependency with rb-apps)
async function stableHash(obj) {
    const sortKeys = (value) => {
        if (value === null || typeof value !== 'object')
            return value;
        if (Array.isArray(value))
            return value.map(sortKeys);
        const sorted = {};
        Object.keys(value).sort().forEach(key => {
            sorted[key] = sortKeys(value[key]);
        });
        return sorted;
    };
    const json = JSON.stringify(sortKeys(obj), null, 2);
    const encoder = new TextEncoder();
    const data = encoder.encode(json);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
/**
 * Generate Verilog and provenance metadata from project
 */
export async function generateBitstreamArtifacts(project) {
    const timestamp = new Date().toISOString();
    // Generate Verilog
    const verilogOutput = circuitToVerilog(project.circuit, project.ioMapping, { moduleName: 'redbyte_top', targetBoard: 'basys3' });
    // Generate constraints
    const constraints = project.ioMapping
        ? generateConstraints(project.ioMapping, 'basys3')
        : undefined;
    // Compute hashes
    const circuitHash = await stableHash(JSON.stringify(project.circuit));
    const verilogHash = await stableHash(verilogOutput.verilog);
    const constraintsHash = constraints ? await stableHash(constraints) : undefined;
    const ioMappingHash = project.ioMapping
        ? await stableHash(JSON.stringify(project.ioMapping))
        : undefined;
    const metadata = {
        schemaVersion: '1.0',
        timestamp,
        projectId: project.projectId,
        projectName: project.name,
        circuitHash,
        nodeCount: project.circuit.nodes.length,
        connectionCount: project.circuit.connections.length,
        verilogHash,
        verilogLines: verilogOutput.verilog.split('\n').length,
        constraintsHash,
        boardProfile: project.boardMap?.boardProfileId || 'basys3',
        ioMappingHash,
        warnings: verilogOutput.warnings,
        unsupportedNodes: verilogOutput.unsupportedNodes,
    };
    return {
        verilog: verilogOutput.verilog,
        constraints,
        metadata,
    };
}
/**
 * Verify bitstream provenance (check hashes match)
 */
export async function verifyBitstreamProvenance(artifacts) {
    const mismatches = [];
    // Re-hash verilog
    const currentVerilogHash = await stableHash(artifacts.verilog);
    if (currentVerilogHash !== artifacts.metadata.verilogHash) {
        mismatches.push(`Verilog hash mismatch: expected ${artifacts.metadata.verilogHash}, got ${currentVerilogHash}`);
    }
    // Re-hash constraints
    if (artifacts.constraints && artifacts.metadata.constraintsHash) {
        const currentConstraintsHash = await stableHash(artifacts.constraints);
        if (currentConstraintsHash !== artifacts.metadata.constraintsHash) {
            mismatches.push(`Constraints hash mismatch: expected ${artifacts.metadata.constraintsHash}, got ${currentConstraintsHash}`);
        }
    }
    return {
        valid: mismatches.length === 0,
        mismatches,
    };
}
