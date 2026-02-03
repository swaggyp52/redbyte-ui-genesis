// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
export function toLogicPlaygroundModel(project, viewConfig) {
    return {
        circuit: project.circuit,
        tickRate: project.simulation.tickRate,
        currentTick: project.simulation.currentTick,
        probes: project.simulation.probes.map((p) => ({
            id: `probe-${p.signal}`,
            signal: p.signal,
            label: p.label,
            color: p.color,
        })),
        selectedNodes: viewConfig.selectedNodes,
    };
}
/**
 * Apply Logic Playground edits back to project
 */
export function fromLogicPlaygroundEdits(project, edits) {
    const updated = { ...project };
    if (edits.circuit) {
        updated.circuit = edits.circuit;
    }
    if (edits.tickRate !== undefined) {
        updated.simulation = { ...updated.simulation, tickRate: edits.tickRate };
    }
    if (edits.currentTick !== undefined) {
        updated.simulation = { ...updated.simulation, currentTick: edits.currentTick };
    }
    if (edits.probes) {
        updated.simulation = {
            ...updated.simulation,
            probes: edits.probes.map((p, idx) => ({
                id: p.id || `probe-${idx}`,
                signal: p.signal,
                label: p.label,
                color: p.color,
            })),
        };
    }
    return updated;
}
export function toLab2DModel(project) {
    // Extract board IO state
    const switches = project.boardMap?.virtualIOState?.switches || [];
    const buttons = project.boardMap?.virtualIOState?.buttons || [];
    const leds = []; // TODO: compute from circuit outputs
    return {
        circuit: project.circuit,
        simulation: {
            tickRate: project.simulation.tickRate,
            currentTick: project.simulation.currentTick,
            isRunning: false, // TODO: track this in project or store
        },
        boardIO: {
            switches,
            buttons,
            leds,
        },
        labSpec: project.labSpec
            ? {
                labId: project.labSpec.labId,
                title: project.labSpec.title,
                checkpoints: (project.labSpec.checkpoints || []).map((cp) => ({
                    id: cp.id,
                    label: cp.label,
                    type: cp.type,
                    isPassed: undefined, // TODO: derive from evidence
                })),
            }
            : undefined,
    };
}
/**
 * Apply 2D Lab edits back to project
 */
export function fromLab2DEdits(project, edits) {
    const updated = { ...project };
    if (edits.circuit) {
        updated.circuit = edits.circuit;
    }
    if (edits.simulation) {
        updated.simulation = {
            ...updated.simulation,
            tickRate: edits.simulation.tickRate ?? updated.simulation.tickRate,
            currentTick: edits.simulation.currentTick ?? updated.simulation.currentTick,
        };
    }
    if (edits.boardIO) {
        updated.boardMap = updated.boardMap || {
            boardProfileId: 'generic',
            signalToPinMap: {},
        };
        updated.boardMap.virtualIOState = {
            switches: edits.boardIO.switches,
            buttons: edits.boardIO.buttons,
        };
    }
    return updated;
}
export function toVirtualLab3DModel(project) {
    const boardMap = project.boardMap || {
        boardProfileId: 'generic',
        signalToPinMap: {},
        virtualIOState: { switches: [], buttons: [] },
    };
    return {
        boardProfileId: boardMap.boardProfileId,
        signalToPinMap: boardMap.signalToPinMap,
        ioState: {
            switches: boardMap.virtualIOState?.switches || [],
            buttons: boardMap.virtualIOState?.buttons || [],
            leds: [], // TODO: compute from circuit outputs + pin mapping
        },
        circuit: project.circuit,
    };
}
/**
 * Apply Virtual Lab edits back to project
 */
export function fromVirtualLab3DEdits(project, edits) {
    const updated = { ...project };
    if (edits.boardProfileId || edits.signalToPinMap || edits.ioState) {
        updated.boardMap = updated.boardMap || {
            boardProfileId: 'generic',
            signalToPinMap: {},
        };
        if (edits.boardProfileId) {
            updated.boardMap.boardProfileId = edits.boardProfileId;
        }
        if (edits.signalToPinMap) {
            updated.boardMap.signalToPinMap = edits.signalToPinMap;
        }
        if (edits.ioState) {
            updated.boardMap.virtualIOState = {
                switches: edits.ioState.switches,
                buttons: edits.ioState.buttons,
            };
        }
    }
    if (edits.circuit) {
        updated.circuit = edits.circuit;
    }
    return updated;
}
