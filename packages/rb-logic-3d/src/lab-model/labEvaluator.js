import { PART_DEFINITIONS } from './parts';
import { evaluateNetRequirements, resolveSelectorPins } from './labTemplate';
const buildPinKey = (nodeId, pinId) => `${nodeId}:${pinId}`;
const collectPinTransitions = (timeline, maxTick) => {
    const transitions = new Map();
    const events = [...timeline.events].filter((event) => event.tick <= maxTick);
    events.sort((a, b) => a.seq - b.seq);
    for (const event of events) {
        if (event.type !== 'SIM_PIN_DIFF')
            continue;
        Object.entries(event.pinDiffs).forEach(([key, value]) => {
            if (!transitions.has(key))
                transitions.set(key, []);
            transitions.get(key).push({ tick: event.tick, value });
        });
    }
    return transitions;
};
const getValueAtTick = (entries, tick) => {
    let current = 0;
    for (const entry of entries) {
        if (entry.tick > tick)
            break;
        current = entry.value;
    }
    return current;
};
const maxConsecutiveTicksAtValue = (entries, targetValue, maxTick) => {
    let currentValue = 0;
    let lastTick = 0;
    let maxSpan = 0;
    let maxStart = 0;
    let maxEnd = 0;
    let segmentStart = 0;
    for (const entry of entries) {
        if (entry.tick > maxTick)
            break;
        const span = entry.tick - lastTick;
        if (currentValue === targetValue) {
            if (span >= maxSpan) {
                maxSpan = span;
                maxStart = segmentStart;
                maxEnd = entry.tick;
            }
        }
        currentValue = entry.value;
        lastTick = entry.tick;
        segmentStart = entry.tick;
    }
    const finalSpan = maxTick - lastTick + 1;
    if (currentValue === targetValue && finalSpan >= maxSpan) {
        maxSpan = finalSpan;
        maxStart = segmentStart;
        maxEnd = maxTick;
    }
    return { span: maxSpan, startTick: maxStart, endTick: maxEnd };
};
const evaluateBlink = (pinEntries, maxTick, period, tolerance, minCycles) => {
    const risingEdges = [];
    let lastValue = 0;
    for (const entry of pinEntries) {
        if (entry.tick > maxTick)
            break;
        if (lastValue === 0 && entry.value === 1) {
            risingEdges.push(entry.tick);
        }
        lastValue = entry.value;
    }
    if (risingEdges.length < 2) {
        return { pass: false, details: 'Not enough edges to measure period.' };
    }
    const periods = [];
    for (let i = 1; i < risingEdges.length; i += 1) {
        periods.push(risingEdges[i] - risingEdges[i - 1]);
    }
    const requiredCycles = minCycles ?? 1;
    if (periods.length < requiredCycles) {
        return { pass: false, details: `Only ${periods.length} cycles observed.` };
    }
    const withinTolerance = periods.slice(0, requiredCycles).every((delta) => {
        return Math.abs(delta - period) <= tolerance;
    });
    return {
        pass: withinTolerance,
        details: withinTolerance
            ? `Measured periods: ${periods.slice(0, requiredCycles).join(', ')}`
            : `Observed periods outside tolerance: ${periods.join(', ')}`,
        evidence: {
            fromTick: risingEdges[0],
            toTick: risingEdges[risingEdges.length - 1],
            cycles: periods.length
        }
    };
};
const evaluateSerialMatches = (timeline, pinEntries, maxTick, onText, offText) => {
    const events = timeline.events.filter((event) => event.type === 'SERIAL_OUTPUT' && event.tick <= maxTick);
    if (events.length === 0) {
        return { pass: false, details: 'No serial output recorded.' };
    }
    for (const event of events) {
        if (event.type !== 'SERIAL_OUTPUT')
            continue;
        const trimmed = event.text.trim();
        const pinValue = getValueAtTick(pinEntries, event.tick);
        const expected = pinValue ? onText : offText;
        if (trimmed !== expected) {
            return {
                pass: false,
                details: `Serial mismatch at tick ${event.tick}: "${trimmed}" != "${expected}"`,
                evidence: { fromTick: event.tick, toTick: event.tick }
            };
        }
    }
    return {
        pass: true,
        details: `Matched ${events.length} serial lines.`,
        evidence: { fromTick: events[0].tick, toTick: events[events.length - 1].tick }
    };
};
const evaluateBehaviorCheck = (graph, timeline, maxTick, check) => {
    const candidates = resolveSelectorPins(graph, check.pin);
    if (candidates.length === 0) {
        return { status: 'fail', details: 'No matching pins in graph.' };
    }
    const transitions = collectPinTransitions(timeline, maxTick);
    for (const pinKey of candidates) {
        const entries = transitions.get(pinKey) ?? [];
        if (check.type === 'blink') {
            const result = evaluateBlink(entries, maxTick, check.period_ticks, check.tolerance_ticks, check.min_cycles);
            if (result.pass) {
                return {
                    status: 'pass',
                    details: result.details,
                    evidence: { pinKey, ...result.evidence }
                };
            }
        }
        if (check.type === 'digital_level') {
            const { span, startTick, endTick } = maxConsecutiveTicksAtValue(entries, check.value, maxTick);
            const minTicks = check.min_ticks ?? 1;
            if (span >= minTicks) {
                return {
                    status: 'pass',
                    details: `Held value ${check.value} for ${span} ticks.`,
                    evidence: { pinKey, span, fromTick: startTick, toTick: endTick }
                };
            }
        }
        if (check.type === 'serial_matches_pin') {
            const result = evaluateSerialMatches(timeline, entries, maxTick, check.on_text, check.off_text);
            if (result.pass) {
                return {
                    status: 'pass',
                    details: result.details,
                    evidence: { pinKey, ...result.evidence }
                };
            }
        }
    }
    return { status: 'fail', details: 'Behavior not observed.' };
};
export const evaluateParts = (graph, template) => {
    const counts = new Map();
    graph.nodes.forEach((node) => counts.set(node.type, (counts.get(node.type) ?? 0) + 1));
    return template.required_parts.map((part) => {
        const present = counts.get(part.type) ?? 0;
        const max = part.max ?? Infinity;
        const label = PART_DEFINITIONS[part.type]?.name ?? part.type;
        let status = 'pass';
        if (present < part.min)
            status = 'missing';
        else if (present > max)
            status = 'partial';
        return {
            id: `parts:${part.type}`,
            category: 'parts',
            label,
            status,
            details: `Have ${present}, need ${part.min}${part.max ? `-${part.max}` : ''}.`
        };
    });
};
export const evaluateWiring = (graph, template) => {
    const { results } = evaluateNetRequirements(graph, template);
    return results.map((result) => {
        const net = template.required_nets.find((entry) => entry.id === result.id);
        return {
            id: `wiring:${result.id}`,
            category: 'wiring',
            label: result.label,
            status: result.satisfied ? 'pass' : 'missing',
            evidence: { matchedPins: result.matched_pins },
            hint: net?.hint
        };
    });
};
export const evaluateBehavior = (graph, timeline, template, tick) => {
    if (!template.behavior_checks || template.behavior_checks.length === 0)
        return [];
    return template.behavior_checks.map((check) => {
        const result = evaluateBehaviorCheck(graph, timeline, tick, check);
        return {
            id: `behavior:${check.id}`,
            category: 'behavior',
            label: check.id,
            status: result.status,
            details: result.details,
            evidence: result.evidence,
            hint: check.hint
        };
    });
};
export const evaluateAtTick = (graph, timeline, template, templateHash, tick) => {
    const partChecks = evaluateParts(graph, template);
    const wiringChecks = evaluateWiring(graph, template);
    const behaviorChecks = evaluateBehavior(graph, timeline, template, tick);
    const checks = [...partChecks, ...wiringChecks, ...behaviorChecks];
    const passCount = checks.filter((check) => check.status === 'pass').length;
    const score = checks.length > 0 ? Math.round((passCount / checks.length) * 100) : 0;
    return {
        templateId: template.lab_id,
        templateVersion: template.lab_version,
        templateHash,
        tick,
        score,
        checks,
        evidence: {
            wiring: wiringChecks.filter((check) => check.status === 'pass').length,
            behavior: behaviorChecks.filter((check) => check.status === 'pass').length
        }
    };
};
