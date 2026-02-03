// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { describe, it, expect } from 'vitest';
import { getOscilloscopeHoverInfo } from '../utils/oscilloscopeHover';
describe('oscilloscope hover helper', () => {
    it('returns hover info when near a trace', () => {
        const samples = [
            { timestamp: 4, value: 0 },
            { timestamp: 5, value: 1 },
            { timestamp: 6, value: 0 },
        ];
        const probeData = new Map([['p1', { samples }]]);
        const probes = [{ id: 'p1', label: 'Probe A', color: '#00ffff', enabled: true }];
        const width = 100;
        const height = 100;
        const timeScale = 10;
        const windowEndTime = 10;
        const voltageScale = 1.5;
        const x = 50; // ~5s
        const y = height / 2 - (1 * voltageScale * height) / 4;
        const hover = getOscilloscopeHoverInfo({
            x,
            y,
            width,
            height,
            timeScale,
            voltageScale,
            windowEndTime,
            probes,
            probeData,
        });
        expect(hover).toBeTruthy();
        expect(hover?.label).toBe('Probe A');
        expect(hover?.value).toBe(1);
        expect(hover?.time).toBeCloseTo(5, 1);
    });
});
