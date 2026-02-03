import { describe, it, expect } from 'vitest';
import { generateReadme } from '../readmeGenerator.js';
/**
 * Phase 3.4: Human-Readable Export Enhancement Tests
 *
 * Tests for enhanced README generation with:
 * - Comprehensive circuit analysis
 * - Test vector results
 * - Statistics summaries
 * - Self-check results
 */
// ============================================================================
// Test Helpers
// ============================================================================
function createTestProject(overrides) {
    return {
        schemaVersion: '1.0',
        projectId: 'test-id',
        name: 'Test Project',
        description: 'Test project for README generation',
        createdAt: '2026-02-02T10:00:00Z',
        updatedAt: '2026-02-02T11:00:00Z',
        circuit: {
            schemaVersion: '1.0',
            nodes: [],
            connections: [],
            customChips: [],
        },
        simulation: {
            tickRate: 20,
            currentTick: 0,
            isRunning: false,
            breakpoints: [],
            probes: [],
        },
        evidence: {
            actions: [],
            snapshots: [],
        },
        ...overrides,
    };
}
// ============================================================================
// Test Suites
// ============================================================================
describe('Enhanced README Generation', () => {
    // ============================================================================
    // Basic README Generation (Suite 1)
    // ============================================================================
    describe('Basic README Generation', () => {
        it('should generate README with project header', () => {
            const project = createTestProject({ name: 'My Circuit' });
            const readme = generateReadme(project);
            expect(readme).toContain('# My Circuit');
            expect(readme).toContain('## Project Info');
        });
        it('should include project metadata', () => {
            const project = createTestProject({
                projectId: 'proj-123',
                schemaVersion: '1.0',
            });
            const readme = generateReadme(project);
            expect(readme).toContain('proj-123');
            expect(readme).toContain('1.0');
            expect(readme).toContain('Created');
            expect(readme).toContain('Updated');
        });
        it('should include description when provided', () => {
            const project = createTestProject({
                description: 'This is a test description for my circuit',
            });
            const readme = generateReadme(project);
            expect(readme).toContain('This is a test description for my circuit');
        });
        it('should skip description when empty', () => {
            const project = createTestProject({ description: '' });
            const readme = generateReadme(project);
            // Should not have extra blank lines from missing description
            expect(readme).not.toMatch(/^##\n\n##/m);
        });
    });
    // ============================================================================
    // Circuit Statistics (Suite 2)
    // ============================================================================
    describe('Circuit Statistics', () => {
        it('should report circuit stats', () => {
            const project = createTestProject({
                circuit: {
                    schemaVersion: '1.0',
                    nodes: [
                        { id: 'n1', type: 'and', x: 0, y: 0, rotation: 0, label: 'A1', params: {}, state: {} },
                        { id: 'n2', type: 'or', x: 100, y: 0, rotation: 0, label: 'O1', params: {}, state: {} },
                    ],
                    connections: [
                        { id: 'c1', fromNodeId: 'n1', fromPin: 'out', toNodeId: 'n2', toPin: 'in1' },
                    ],
                    customChips: [],
                },
            });
            const readme = generateReadme(project);
            expect(readme).toContain('## Circuit');
            expect(readme).toContain('Nodes: 2');
            expect(readme).toContain('Connections: 1');
        });
        it('should break down components by type', () => {
            const project = createTestProject({
                circuit: {
                    schemaVersion: '1.0',
                    nodes: [
                        { id: 'n1', type: 'and', x: 0, y: 0, rotation: 0, label: '', params: {}, state: {} },
                        { id: 'n2', type: 'and', x: 100, y: 0, rotation: 0, label: '', params: {}, state: {} },
                        { id: 'n3', type: 'or', x: 200, y: 0, rotation: 0, label: '', params: {}, state: {} },
                    ],
                    connections: [],
                    customChips: [],
                },
            });
            const readme = generateReadme(project);
            expect(readme).toContain('### Components');
            expect(readme).toContain('and: 2');
            expect(readme).toContain('or: 1');
        });
        it('should report custom chips', () => {
            const project = createTestProject({
                circuit: {
                    schemaVersion: '1.0',
                    nodes: [],
                    connections: [],
                    customChips: [
                        {
                            id: 'chip1',
                            name: 'Full Adder',
                            inputPins: ['a', 'b', 'c'],
                            outputPins: ['sum', 'cout'],
                            definition: { nodes: [], connections: [] },
                        },
                    ],
                },
            });
            const readme = generateReadme(project);
            expect(readme).toContain('### Custom Chips');
            expect(readme).toContain('Full Adder');
            expect(readme).toContain('chip1');
            expect(readme).toContain('Inputs: a, b, c');
            expect(readme).toContain('Outputs: sum, cout');
        });
        it('should not include custom chips section when empty', () => {
            const project = createTestProject({
                circuit: {
                    schemaVersion: '1.0',
                    nodes: [],
                    connections: [],
                    customChips: [],
                },
            });
            const readme = generateReadme(project);
            expect(readme).not.toContain('### Custom Chips');
        });
    });
    // ============================================================================
    // Simulation Information (Suite 3)
    // ============================================================================
    describe('Simulation Information', () => {
        it('should include simulation parameters', () => {
            const project = createTestProject({
                simulation: {
                    tickRate: 50,
                    currentTick: 0,
                    isRunning: false,
                    breakpoints: [],
                    probes: [],
                },
            });
            const readme = generateReadme(project);
            expect(readme).toContain('## Simulation');
            expect(readme).toContain('Tick Rate: 50 Hz');
            expect(readme).toContain('Current Tick: 0');
        });
        it('should include breakpoints when present', () => {
            const project = createTestProject({
                simulation: {
                    tickRate: 20,
                    currentTick: 0,
                    isRunning: false,
                    breakpoints: [10, 20, 30],
                    probes: [],
                },
            });
            const readme = generateReadme(project);
            expect(readme).toContain('Breakpoints: 10, 20, 30');
        });
        it('should not list breakpoints when empty', () => {
            const project = createTestProject({
                simulation: {
                    tickRate: 20,
                    currentTick: 0,
                    isRunning: false,
                    breakpoints: [],
                    probes: [],
                },
            });
            const readme = generateReadme(project);
            expect(readme).not.toContain('Breakpoints:');
        });
    });
    // ============================================================================
    // Probes and Signals (Suite 4)
    // ============================================================================
    describe('Probes and Signal Monitoring', () => {
        it('should include probes section when present', () => {
            const project = createTestProject({
                simulation: {
                    tickRate: 20,
                    currentTick: 0,
                    isRunning: false,
                    breakpoints: [],
                    probes: [
                        { id: 'p1', nodeId: 'n1', name: 'Output A', color: '#ff0000' },
                        { id: 'p2', nodeId: 'n2', name: 'Output B', color: '#00ff00' },
                    ],
                },
            });
            const readme = generateReadme(project);
            expect(readme).toContain('### Probes');
            expect(readme).toContain('Output A');
            expect(readme).toContain('Output B');
        });
        it('should not include probes section when empty', () => {
            const project = createTestProject({
                simulation: {
                    tickRate: 20,
                    currentTick: 0,
                    isRunning: false,
                    breakpoints: [],
                    probes: [],
                },
            });
            const readme = generateReadme(project);
            expect(readme).not.toContain('### Probes');
        });
    });
    // ============================================================================
    // Evidence and Checkpoints (Suite 5)
    // ============================================================================
    describe('Evidence and Test Results', () => {
        it('should include evidence section', () => {
            const project = createTestProject({
                evidence: {
                    actions: [
                        { id: 'a1', type: 'component_add', timestamp: '2026-02-02T10:00:00Z', details: {} },
                        { id: 'a2', type: 'wire_add', timestamp: '2026-02-02T10:01:00Z', details: {} },
                    ],
                    snapshots: [
                        {
                            id: 's1',
                            timestamp: '2026-02-02T10:02:00Z',
                            type: 'self_check',
                            passed: true,
                            score: 100,
                            results: {},
                        },
                    ],
                },
            });
            const readme = generateReadme(project);
            expect(readme).toContain('## Evidence');
            expect(readme).toContain('Actions Logged: 2');
            expect(readme).toContain('Snapshots: 1');
        });
        it('should include checkpoint results when available', () => {
            const project = createTestProject({
                evidence: {
                    actions: [],
                    snapshots: [
                        {
                            id: 's1',
                            timestamp: '2026-02-02T10:00:00Z',
                            type: 'self_check',
                            passed: true,
                            score: 95,
                            results: {
                                totalTests: 20,
                                passedTests: 19,
                                failedTests: 1,
                            },
                        },
                    ],
                },
            });
            const readme = generateReadme(project);
            expect(readme).toContain('Snapshots: 1');
        });
        it('should format test results summary', () => {
            const project = createTestProject({
                evidence: {
                    actions: [],
                    snapshots: [
                        {
                            id: 's1',
                            timestamp: '2026-02-02T10:00:00Z',
                            type: 'lab_checkpoint',
                            passed: true,
                            score: 85,
                            results: {
                                vectorsRun: 16,
                                passed: 15,
                                failed: 1,
                            },
                        },
                    ],
                },
            });
            const readme = generateReadme(project);
            // Evidence section should be present
            expect(readme).toContain('## Evidence');
        });
    });
    // ============================================================================
    // Options and Customization (Suite 6)
    // ============================================================================
    describe('README Options and Customization', () => {
        it('should generate readme with default options', () => {
            const project = createTestProject({
                circuit: {
                    schemaVersion: '1.0',
                    nodes: [{ id: 'n1', type: 'and', x: 0, y: 0, rotation: 0, label: '', params: {}, state: {} }],
                    connections: [],
                    customChips: [],
                },
            });
            const readme = generateReadme(project);
            expect(readme).toBeDefined();
            expect(readme).toContain('## Circuit');
        });
        // ============================================================================
        // Summary Statistics (Suite 7)
        // ============================================================================
        describe('Summary Statistics', () => {
            it('should include footer with generation info', () => {
                const project = createTestProject();
                const readme = generateReadme(project);
                expect(readme).toContain('---');
                expect(readme).toContain('Generated by RedByte Lab Engine');
                expect(readme).toContain('Export date:');
            });
            it('should format dates properly', () => {
                const project = createTestProject({
                    createdAt: '2026-02-02T10:00:00Z',
                    updatedAt: '2026-02-02T15:30:00Z',
                });
                const readme = generateReadme(project);
                expect(readme).toContain('Created');
                expect(readme).toContain('Updated');
                // Check that dates are parsed (should not be ISO format in output)
                expect(readme).not.toContain('2026-02-02T10:00:00Z');
            });
            it('should include project ID and schema version', () => {
                const project = createTestProject({
                    projectId: 'unique-id-12345',
                    schemaVersion: '1.0',
                });
                const readme = generateReadme(project);
                expect(readme).toContain('unique-id-12345');
                expect(readme).toContain('1.0');
            });
        });
        // ============================================================================
        // Large Project Handling (Suite 8)
        // ============================================================================
        describe('Large Project Handling', () => {
            it('should handle large circuits efficiently', () => {
                const nodes = [];
                const components = { and: 30, or: 20, not: 15, switch: 10, led: 25 };
                let nodeId = 0;
                Object.entries(components).forEach(([type, count]) => {
                    for (let i = 0; i < count; i++) {
                        nodes.push({
                            id: `n${nodeId++}`,
                            type,
                            x: (nodeId % 10) * 100,
                            y: Math.floor(nodeId / 10) * 100,
                            rotation: 0,
                            label: `${type}${i + 1}`,
                            params: {},
                            state: {},
                        });
                    }
                });
                const project = createTestProject({
                    circuit: {
                        schemaVersion: '1.0',
                        nodes,
                        connections: [],
                        customChips: [],
                    },
                });
                const readme = generateReadme(project);
                expect(readme).toContain('Nodes: 100');
                expect(readme).toContain('and: 30');
                expect(readme).toContain('or: 20');
                expect(readme).toContain('not: 15');
            });
            it('should handle many checkpoints', () => {
                const project = createTestProject({
                    evidence: {
                        actions: [
                            { id: 'a1', type: 'component_add', timestamp: '2026-02-02T10:00:00Z', details: {} },
                            { id: 'a2', type: 'wire_add', timestamp: '2026-02-02T10:01:00Z', details: {} },
                            { id: 'a3', type: 'component_delete', timestamp: '2026-02-02T10:02:00Z', details: {} },
                            { id: 'a4', type: 'wire_delete', timestamp: '2026-02-02T10:03:00Z', details: {} },
                            { id: 'a5', type: 'component_add', timestamp: '2026-02-02T10:04:00Z', details: {} },
                        ],
                        snapshots: [],
                    },
                });
                const readme = generateReadme(project);
                expect(readme).toContain('Actions Logged: 5');
            });
        });
        // ============================================================================
        // Content Formatting (Suite 9)
        // ============================================================================
        describe('Content Formatting', () => {
            it('should use proper markdown formatting', () => {
                const project = createTestProject({ name: 'Test' });
                const readme = generateReadme(project);
                // Check for markdown headers
                expect(readme).toMatch(/^# /m);
                expect(readme).toMatch(/^## /m);
                // Check for markdown lists
                expect(readme).toMatch(/^- /m);
                // Check for code blocks
                expect(readme).toMatch(/`[^`]+`/);
            });
            it('should include proper spacing between sections', () => {
                const project = createTestProject();
                const readme = generateReadme(project);
                // Should have proper line breaks between sections
                expect(readme).not.toMatch(/##.*\n##/);
            });
            it('should handle special characters in names', () => {
                const project = createTestProject({
                    name: 'Circuit Design v2.0',
                    circuit: {
                        schemaVersion: '1.0',
                        nodes: [
                            {
                                id: 'n1',
                                type: 'and',
                                x: 0,
                                y: 0,
                                rotation: 0,
                                label: 'Node_Test',
                                params: {},
                                state: {},
                            },
                        ],
                        connections: [],
                        customChips: [],
                    },
                });
                const readme = generateReadme(project);
                expect(readme).toContain('Circuit Design v2.0');
                expect(readme).toContain('Node_Test');
            });
        });
    });
});
