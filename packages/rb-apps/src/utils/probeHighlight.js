// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { mark, measure } from '@redbyte/rb-utils';
export const getWireId = (connection) => `${connection.from.nodeId}.${connection.from.portName}-${connection.to.nodeId}.${connection.to.portName}`;
export const buildProbeWireHighlights = (circuit, probes) => {
    mark('probe-wire-highlights-start');
    const portToColors = new Map();
    probes.forEach((probe) => {
        if (!probe.enabled)
            return;
        const key = `${probe.nodeId}.${probe.portName}`;
        const colors = portToColors.get(key) ?? [];
        colors.push(probe.color);
        portToColors.set(key, colors);
    });
    const wireHighlights = new Map();
    circuit.connections.forEach((connection) => {
        const fromKey = `${connection.from.nodeId}.${connection.from.portName}`;
        const toKey = `${connection.to.nodeId}.${connection.to.portName}`;
        const colors = new Set();
        (portToColors.get(fromKey) ?? []).forEach((color) => colors.add(color));
        (portToColors.get(toKey) ?? []).forEach((color) => colors.add(color));
        if (colors.size > 0) {
            wireHighlights.set(getWireId(connection), Array.from(colors));
        }
    });
    mark('probe-wire-highlights-end');
    measure('probe-wire-highlights', 'probe-wire-highlights-start', 'probe-wire-highlights-end');
    return wireHighlights;
};
