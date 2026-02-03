// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
export function generateReadme(project, options = {}) {
    const { includeCircuitStats = true, includeCheckpoints = true, includeBoardMapping = true, includeProbes = true, } = options;
    const lines = [];
    // Header
    lines.push(`# ${project.name}`);
    lines.push('');
    if (project.description) {
        lines.push(project.description);
        lines.push('');
    }
    // Metadata
    lines.push('## Project Info');
    lines.push('');
    lines.push(`- **Project ID**: \`${project.projectId}\``);
    lines.push(`- **Schema Version**: ${project.schemaVersion}`);
    lines.push(`- **Created**: ${new Date(project.createdAt).toLocaleString()}`);
    lines.push(`- **Updated**: ${new Date(project.updatedAt).toLocaleString()}`);
    lines.push('');
    // Circuit stats
    if (includeCircuitStats && project.circuit) {
        const { nodes, connections, customChips } = project.circuit;
        lines.push('## Circuit');
        lines.push('');
        lines.push(`- **Nodes**: ${nodes.length}`);
        lines.push(`- **Connections**: ${connections.length}`);
        if (customChips && customChips.length > 0) {
            lines.push(`- **Custom Chips**: ${customChips.length}`);
            lines.push('');
            lines.push('### Custom Chips');
            lines.push('');
            customChips.forEach((chip) => {
                lines.push(`- **${chip.name}** (\`${chip.id}\`)`);
                lines.push(`  - Inputs: ${chip.inputPins.join(', ')}`);
                lines.push(`  - Outputs: ${chip.outputPins.join(', ')}`);
            });
        }
        lines.push('');
        // Component breakdown
        const componentCounts = new Map();
        nodes.forEach((node) => {
            componentCounts.set(node.type, (componentCounts.get(node.type) || 0) + 1);
        });
        if (componentCounts.size > 0) {
            lines.push('### Components');
            lines.push('');
            const sorted = Array.from(componentCounts.entries()).sort((a, b) => b[1] - a[1]);
            sorted.forEach(([type, count]) => {
                lines.push(`- ${type}: ${count}`);
            });
            lines.push('');
        }
    }
    // Simulation
    lines.push('## Simulation');
    lines.push('');
    lines.push(`- **Tick Rate**: ${project.simulation.tickRate} Hz`);
    lines.push(`- **Current Tick**: ${project.simulation.currentTick}`);
    if (project.simulation.breakpoints && project.simulation.breakpoints.length > 0) {
        lines.push(`- **Breakpoints**: ${project.simulation.breakpoints.join(', ')}`);
    }
    lines.push('');
    // Probes
    if (includeProbes && project.simulation.probes.length > 0) {
        lines.push('### Probes');
        lines.push('');
        project.simulation.probes.forEach((probe) => {
            lines.push(`- **${probe.label || probe.signal}** (${probe.signal}) — ${probe.color || 'default'}`);
        });
        lines.push('');
    }
    // Board mapping
    if (includeBoardMapping && project.boardMap) {
        lines.push('## Board Mapping');
        lines.push('');
        lines.push(`- **Board Profile**: \`${project.boardMap.boardProfileId}\``);
        const pinCount = Object.keys(project.boardMap.signalToPinMap).length;
        lines.push(`- **Mapped Signals**: ${pinCount}`);
        if (pinCount > 0) {
            lines.push('');
            lines.push('### Signal → Pin');
            lines.push('');
            Object.entries(project.boardMap.signalToPinMap).forEach(([signal, pin]) => {
                lines.push(`- \`${signal}\` → \`${pin}\``);
            });
        }
        lines.push('');
        if (project.boardMap.virtualIOState) {
            const { switches, buttons } = project.boardMap.virtualIOState;
            lines.push('### Virtual IO State');
            lines.push('');
            if (switches.length > 0) {
                lines.push(`- **Switches**: ${switches.map((s) => (s ? '1' : '0')).join(' ')}`);
            }
            if (buttons && buttons.length > 0) {
                lines.push(`- **Buttons**: ${buttons.map((b) => (b ? '1' : '0')).join(' ')}`);
            }
            lines.push('');
        }
    }
    // Lab spec
    if (includeCheckpoints && project.labSpec) {
        lines.push('## Lab Spec');
        lines.push('');
        lines.push(`- **Lab ID**: \`${project.labSpec.labId}\``);
        if (project.labSpec.title) {
            lines.push(`- **Title**: ${project.labSpec.title}`);
        }
        if (project.labSpec.description) {
            lines.push(`- **Description**: ${project.labSpec.description}`);
        }
        const checkpoints = project.labSpec.checkpoints || [];
        if (checkpoints.length > 0) {
            lines.push(`- **Checkpoints**: ${checkpoints.length}`);
            lines.push('');
            lines.push('### Checkpoints');
            lines.push('');
            checkpoints.forEach((cp, idx) => {
                lines.push(`${idx + 1}. **${cp.label || cp.id}** (${cp.type})`);
                if (cp.description) {
                    lines.push(`   ${cp.description}`);
                }
            });
            lines.push('');
        }
    }
    // Evidence
    lines.push('## Evidence');
    lines.push('');
    lines.push(`- **Actions Logged**: ${project.evidence.actions.length}`);
    lines.push(`- **Snapshots**: ${project.evidence.snapshots.length}`);
    if (project.evidence.manifest) {
        lines.push(`- **Integrity**: ${project.evidence.manifest.files.length} files verified`);
    }
    lines.push('');
    // Summary statistics
    const nodeCount = project.circuit?.nodes?.length || 0;
    const connectionCount = project.circuit?.connections?.length || 0;
    const actionCount = project.evidence?.actions?.length || 0;
    const snapshotCount = project.evidence?.snapshots?.length || 0;
    lines.push('## Summary');
    lines.push('');
    lines.push('**Project Composition:**');
    lines.push('');
    lines.push(`- ${nodeCount} nodes`);
    lines.push(`- ${connectionCount} connections`);
    lines.push(`- ${actionCount} action${actionCount !== 1 ? 's' : ''}`);
    lines.push(`- ${snapshotCount} snapshot${snapshotCount !== 1 ? 's' : ''}`);
    lines.push('');
    // Footer
    lines.push('---');
    lines.push('');
    lines.push('Generated by RedByte Lab Engine');
    lines.push(`Export date: ${new Date().toISOString()}`);
    lines.push('');
    return lines.join('\n');
}
