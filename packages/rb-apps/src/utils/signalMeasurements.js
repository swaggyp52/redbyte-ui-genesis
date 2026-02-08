// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Calculate comprehensive signal measurements from samples
 */
export function calculateMeasurements(samples) {
    if (samples.length < 2) {
        return {
            frequency: null,
            period: null,
            dutyCycle: null,
            highTime: null,
            lowTime: null,
            risingEdges: 0,
            fallingEdges: 0,
        };
    }
    // Find all edges
    const edges = [];
    for (let i = 1; i < samples.length; i++) {
        const prev = samples[i - 1].value;
        const curr = samples[i].value;
        if (prev === 0 && curr === 1) {
            edges.push({ timestamp: samples[i].timestamp, type: 'rising' });
        }
        else if (prev === 1 && curr === 0) {
            edges.push({ timestamp: samples[i].timestamp, type: 'falling' });
        }
    }
    const risingEdges = edges.filter((e) => e.type === 'rising');
    const fallingEdges = edges.filter((e) => e.type === 'falling');
    // Calculate period (time between consecutive rising edges)
    let period = null;
    if (risingEdges.length >= 2) {
        const periods = [];
        for (let i = 1; i < risingEdges.length; i++) {
            periods.push(risingEdges[i].timestamp - risingEdges[i - 1].timestamp);
        }
        // Average period for more stable measurement
        period = periods.reduce((sum, p) => sum + p, 0) / periods.length;
    }
    // Calculate frequency
    const frequency = period !== null && period > 0 ? 1 / period : null;
    // Calculate high/low times and duty cycle
    let totalHighTime = 0;
    let totalLowTime = 0;
    // Calculate time spent in each state
    for (let i = 1; i < samples.length; i++) {
        const dt = samples[i].timestamp - samples[i - 1].timestamp;
        if (samples[i - 1].value === 1) {
            totalHighTime += dt;
        }
        else {
            totalLowTime += dt;
        }
    }
    const totalTime = totalHighTime + totalLowTime;
    const dutyCycle = totalTime > 0 ? (totalHighTime / totalTime) * 100 : null;
    return {
        frequency,
        period,
        dutyCycle,
        highTime: totalHighTime,
        lowTime: totalLowTime,
        risingEdges: risingEdges.length,
        fallingEdges: fallingEdges.length,
    };
}
/**
 * Detect trigger condition in samples
 */
export function detectTrigger(samples, triggerType, edge, level) {
    if (samples.length < 2)
        return null;
    if (triggerType === 'edge') {
        for (let i = 1; i < samples.length; i++) {
            const prev = samples[i - 1].value;
            const curr = samples[i].value;
            if (edge === 'rising' && prev === 0 && curr === 1) {
                return samples[i].timestamp;
            }
            else if (edge === 'falling' && prev === 1 && curr === 0) {
                return samples[i].timestamp;
            }
        }
    }
    else {
        // Level trigger
        for (let i = 1; i < samples.length; i++) {
            const prev = samples[i - 1].value;
            const curr = samples[i].value;
            if (prev < level && curr >= level) {
                return samples[i].timestamp;
            }
        }
    }
    return null;
}
