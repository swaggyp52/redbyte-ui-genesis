import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeRBProject, encodeRBProject } from '../export/projectFormat';
import { labProjectToRBProject } from '../utils/labProjectRbprojAdapter';
const FIXTURE_PROJECT_PATH = join(process.cwd(), 'packages/rb-lab-engine/src/services/__tests__/fixtures/rbx-evidence-determinism.fixture.project.json');
/**
 * Phase 4 Gate: Lab Workflow Export-Verify
 *
 * This gate validates the complete student workflow:
 * 1. Load existing lab project fixture (project.json)
 * 2. Convert to RBProject via adapters
 * 3. Re-export to evidence capsule
 * 4. Re-import and verify:
 *    - Project snapshot equality
 *    - Deterministic metadata (no hidden randomness)
 *    - Stable results
 *
 * Pure, deterministic test (no browser, no UI, no timers).
 */
async function loadLabFixture(projectPath) {
    const projectText = readFileSync(projectPath, 'utf-8');
    return JSON.parse(projectText);
}
function normalizeForComparison(project) {
    // Exclude fields that legitimately vary on re-export:
    // - updatedAt (current timestamp)
    // - meta.appVersion / meta.gitCommit (build metadata)
    const { meta, updatedAt: _updatedAt, createdAt: _createdAt, circuit, ...rest } = project;
    const metaSafe = meta
        ? Object.fromEntries(Object.entries({ ...meta, appVersion: undefined, gitCommit: undefined }).filter(([, value]) => value !== undefined))
        : undefined;
    const nodes = [...(circuit?.nodes ?? [])]
        .map((node) => ({
        id: node.id,
        type: node.type,
        x: node.x,
        y: node.y,
        rotation: node.rotation ?? 0,
        config: node.config ?? {},
        params: node.params ?? {},
        state: node.state ?? {},
    }))
        .sort((a, b) => a.id.localeCompare(b.id));
    const connections = [...(circuit?.connections ?? [])]
        .map((connection) => ({
        from: { nodeId: connection.from.nodeId, portName: connection.from.portName },
        to: { nodeId: connection.to.nodeId, portName: connection.to.portName },
    }))
        .sort((a, b) => {
        const left = `${a.from.nodeId}.${a.from.portName}->${a.to.nodeId}.${a.to.portName}`;
        const right = `${b.from.nodeId}.${b.from.portName}->${b.to.nodeId}.${b.to.portName}`;
        return left.localeCompare(right);
    });
    return {
        ...rest,
        meta: metaSafe,
        circuit: { nodes, connections },
    };
}
describe('Phase 4: Lab Workflow Export-Verify Gate', () => {
    it('loads fixture, converts to RBProject, and verifies roundtrip stability', async () => {
        // Step 1: Load lab fixture
        const labProject = await loadLabFixture(FIXTURE_PROJECT_PATH);
        expect(labProject).toBeDefined();
        expect(labProject.circuit).toBeDefined();
        // Step 2: Convert to RBProject
        const rbProject = labProjectToRBProject(labProject);
        expect(rbProject.kind).toBe('rb-project');
        expect(rbProject.version).toBe(1);
        expect(rbProject.circuit).toBeDefined();
        // Step 3: Export to string
        const exported1 = encodeRBProject(rbProject);
        expect(typeof exported1).toBe('string');
        expect(exported1.length).toBeGreaterThan(0);
        // Step 4: Re-import
        const reimported = decodeRBProject(exported1);
        expect(reimported.kind).toBe('rb-project');
        // Step 5: Re-export
        const exported2 = encodeRBProject(reimported);
        // Step 6: Verify idempotence (export is deterministic)
        expect(exported2).toBe(exported1);
    });
    it('verifies project snapshot equality after roundtrip (no data loss)', async () => {
        const labProject = await loadLabFixture(FIXTURE_PROJECT_PATH);
        const rbProject = labProjectToRBProject(labProject);
        const exported = encodeRBProject(rbProject);
        const reimported = decodeRBProject(exported);
        // Normalize both for comparison
        const norm1 = normalizeForComparison(rbProject);
        const norm2 = normalizeForComparison(reimported);
        expect(norm2).toEqual(norm1);
    });
    it('verifies metadata is deterministic (no hidden timestamps or randomness)', async () => {
        const labProject = await loadLabFixture(FIXTURE_PROJECT_PATH);
        const rbProject1 = labProjectToRBProject(labProject);
        const rbProject2 = labProjectToRBProject(labProject);
        // Same lab input should produce identical normalized projects
        const norm1 = normalizeForComparison(rbProject1);
        const norm2 = normalizeForComparison(rbProject2);
        expect(norm2).toEqual(norm1);
    });
    it('verifies circuit structure stability (nodes and connections preserved)', async () => {
        const labProject = await loadLabFixture(FIXTURE_PROJECT_PATH);
        const rbProject = labProjectToRBProject(labProject);
        const exported = encodeRBProject(rbProject);
        const reimported = decodeRBProject(exported);
        // Verify circuit structure
        expect(reimported.circuit.nodes.length).toBe(rbProject.circuit.nodes.length);
        expect(reimported.circuit.connections.length).toBe(rbProject.circuit.connections.length);
        // Verify node IDs are stable
        const originalNodeIds = rbProject.circuit.nodes.map((n) => n.id).sort();
        const reimportedNodeIds = reimported.circuit.nodes.map((n) => n.id).sort();
        expect(reimportedNodeIds).toEqual(originalNodeIds);
        // Verify connection structure stable
        const originalConnections = rbProject.circuit.connections
            .map((c) => `${c.from.nodeId}.${c.from.portName}->${c.to.nodeId}.${c.to.portName}`)
            .sort();
        const reimportedConnections = reimported.circuit.connections
            .map((c) => `${c.from.nodeId}.${c.from.portName}->${c.to.nodeId}.${c.to.portName}`)
            .sort();
        expect(reimportedConnections).toEqual(originalConnections);
    });
});
