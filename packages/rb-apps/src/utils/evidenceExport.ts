// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit } from '@redbyte/rb-logic-core';
import type { Probe } from '../stores/probeStore';
import { downloadBlob } from './bundleExport';
import { stableStringify } from '../export/stableStringify';

export interface EvidenceData {
    schema_version: string;
    timestamp: string;
    app_version: string;
    circuit: {
        nodes: Circuit['nodes'];
        connections: Circuit['connections'];
    };
    selected_example_id: string | null;
    probes: Array<{
        id: string;
        nodeId: string;
        portName: string;
        label: string;
        enabled: boolean;
    }>;
    oscilloscope_metadata: {
        tick_range: { min: number; max: number } | null;
        sample_count: number;
    };
    tick_count: number;
}

export interface ExportEvidenceOptions {
    circuit: Circuit;
    selectedExampleId?: string | null;
    probes: Probe[];
    tickCount: number;
    traceRecorder?: {
        getTickRange: () => { min: number; max: number } | null;
        getStats: () => { totalTicks: number };
    } | null;
}

/**
 * Export lab evidence as deterministic JSON file
 */
export function exportEvidence(options: ExportEvidenceOptions): void {
    const {
        circuit,
        selectedExampleId = null,
        probes,
        tickCount,
        traceRecorder = null,
    } = options;

    // Get app version from environment
    const appVersion =
        (import.meta as ImportMeta & { env?: { VITE_APP_VERSION?: string } }).env?.VITE_APP_VERSION ??
        'dev';

    // Get oscilloscope metadata from trace recorder (if available)
    let tickRange: { min: number; max: number } | null = null;
    let sampleCount = 0;

    if (traceRecorder) {
        try {
            tickRange = traceRecorder.getTickRange();
            const stats = traceRecorder.getStats();
            sampleCount = stats.totalTicks;
        } catch (e) {
            // Gracefully handle missing trace recorder
            console.warn('[evidenceExport] Failed to get trace metadata:', e);
        }
    }

    // Assemble evidence data with stable key ordering
    const evidence: EvidenceData = {
        schema_version: 'evidence-v1',
        timestamp: new Date().toISOString(),
        app_version: appVersion,
        circuit: {
            nodes: circuit.nodes,
            connections: circuit.connections,
        },
        selected_example_id: selectedExampleId,
        probes: probes.map((probe) => ({
            id: probe.id,
            nodeId: probe.nodeId,
            portName: probe.portName,
            label: probe.label,
            enabled: probe.enabled,
        })),
        oscilloscope_metadata: {
            tick_range: tickRange,
            sample_count: sampleCount,
        },
        tick_count: tickCount,
    };

    // Serialize deterministically
    const json = stableStringify(evidence);
    const blob = new Blob([json], { type: 'application/json' });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `evidence-${timestamp}.json`;

    // Trigger download
    downloadBlob(blob, filename);
}
