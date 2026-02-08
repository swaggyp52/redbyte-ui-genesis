// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
const findClosestSample = (samples, time) => {
    let closest = samples[0];
    let minDelta = Math.abs(samples[0].timestamp - time);
    for (let i = 1; i < samples.length; i += 1) {
        const delta = Math.abs(samples[i].timestamp - time);
        if (delta < minDelta) {
            minDelta = delta;
            closest = samples[i];
        }
    }
    return closest;
};
export const getOscilloscopeHoverInfo = ({ x, y, width, height, timeScale, voltageScale, windowEndTime, probes, probeData, maxDistance = 6, }) => {
    if (width <= 0 || height <= 0)
        return null;
    const timeOffset = ((width - x) / width) * timeScale;
    const hoverTime = windowEndTime - timeOffset;
    let best = null;
    probes.forEach((probe) => {
        if (!probe.enabled)
            return;
        const data = probeData.get(probe.id);
        if (!data || data.samples.length === 0)
            return;
        const sample = findClosestSample(data.samples, hoverTime);
        const traceY = height / 2 - (sample.value * voltageScale * height) / 4;
        const distance = Math.abs(y - traceY);
        if (distance <= maxDistance && (!best || distance < Math.abs(best.y - y))) {
            best = {
                x,
                y: traceY,
                label: probe.label,
                value: sample.value,
                time: sample.timestamp,
                color: probe.color,
            };
        }
    });
    return best;
};
