/**
 * Lab 0 Golden Run Test
 *
 * Deterministic proof that the Lab 0 "Hardware Proof" template evaluator
 * produces a 100% score when the graph contains the required parts and
 * the timeline contains pin events satisfying all behavior checks.
 *
 * This test runs without hardware — it synthetically constructs the
 * graph and timeline, then asserts the evaluator produces the correct
 * GradeReport.
 */
import { describe, it, expect } from 'vitest';
import { evaluateAtTick, evaluateParts, evaluateBehavior } from '../labEvaluator';
// ---------------------------------------------------------------------------
// Lab 0 template (inlined to avoid import path coupling)
// ---------------------------------------------------------------------------
const LAB0_TEMPLATE = {
    template_version: 'virtual-lab.v1',
    lab_id: 'lab0_hardware_proof',
    lab_version: '1.0.0',
    name: 'Lab 0: Hardware Proof',
    summary: 'Validate your RedByte Hardware Kit (Basys 3 + Arduino Uno).',
    hardware_target: 'basys3',
    required_parts: [
        { type: 'fpga-basys3', min: 1, max: 1 },
        { type: 'arduino-uno', min: 1, max: 1 },
    ],
    required_nets: [],
    behavior_checks: [
        {
            id: 'sw0_high',
            type: 'digital_level',
            pin: { part: 'fpga-basys3', pins: ['SW0'] },
            value: 1,
            min_ticks: 5,
            hint: 'Flip physical Switch 0 on your Basys 3 board.',
        },
        {
            id: 'blink_uno',
            type: 'blink',
            pin: { part: 'arduino-uno', pins: ['D13'] },
            period_ticks: 40,
            tolerance_ticks: 6,
            min_cycles: 2,
            hint: 'Ensure the Arduino Blink sketch is running.',
        },
    ],
};
// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const DEFAULT_POSE = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
};
function makeNode(id, type) {
    return { id, type, pose: DEFAULT_POSE, properties: {} };
}
function makeGraph() {
    return {
        nodes: [
            makeNode('basys3-1', 'fpga-basys3'),
            makeNode('uno-1', 'arduino-uno'),
        ],
        wires: [],
        net: {},
    };
}
/**
 * Build a timeline that satisfies both Lab 0 behavior checks:
 * 1. SW0 held HIGH for at least 5 ticks (ticks 10-20)
 * 2. D13 blinks with period ~40 ticks for at least 2 cycles
 */
function makePassingTimeline() {
    let seq = 0;
    const events = [];
    const pin = (tick, diffs) => ({
        type: 'SIM_PIN_DIFF',
        tick,
        seq: seq++,
        source: 'engine',
        pinDiffs: diffs,
    });
    // SW0 goes HIGH at tick 10, stays until tick 20
    events.push(pin(10, { 'basys3-1:SW0': 1 }));
    events.push(pin(20, { 'basys3-1:SW0': 0 }));
    // D13 blinks: rising edges at 50, 90, 130 → periods of 40 ticks each
    events.push(pin(50, { 'uno-1:D13': 1 }));
    events.push(pin(70, { 'uno-1:D13': 0 }));
    events.push(pin(90, { 'uno-1:D13': 1 }));
    events.push(pin(110, { 'uno-1:D13': 0 }));
    events.push(pin(130, { 'uno-1:D13': 1 }));
    events.push(pin(150, { 'uno-1:D13': 0 }));
    return { events, snapshots: [] };
}
function makeFailingTimeline() {
    // Empty timeline — nothing happens
    return { events: [], snapshots: [] };
}
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Lab 0 Golden Run', () => {
    const graph = makeGraph();
    const TEMPLATE_HASH = 'test-hash-lab0';
    const EVAL_TICK = 200;
    it('scores 100% with correct parts and passing behavior', () => {
        const timeline = makePassingTimeline();
        const report = evaluateAtTick(graph, timeline, LAB0_TEMPLATE, TEMPLATE_HASH, EVAL_TICK);
        expect(report.templateId).toBe('lab0_hardware_proof');
        expect(report.score).toBe(100);
        expect(report.checks.every((c) => c.status === 'pass')).toBe(true);
    });
    it('produces correct number of checks (2 parts + 2 behavior)', () => {
        const timeline = makePassingTimeline();
        const report = evaluateAtTick(graph, timeline, LAB0_TEMPLATE, TEMPLATE_HASH, EVAL_TICK);
        const partChecks = report.checks.filter((c) => c.category === 'parts');
        const behaviorChecks = report.checks.filter((c) => c.category === 'behavior');
        const wiringChecks = report.checks.filter((c) => c.category === 'wiring');
        expect(partChecks).toHaveLength(2);
        expect(behaviorChecks).toHaveLength(2);
        expect(wiringChecks).toHaveLength(0); // Lab 0 has no required_nets
    });
    it('fails behavior checks with empty timeline', () => {
        const timeline = makeFailingTimeline();
        const report = evaluateAtTick(graph, timeline, LAB0_TEMPLATE, TEMPLATE_HASH, EVAL_TICK);
        // Parts still pass
        const partChecks = report.checks.filter((c) => c.category === 'parts');
        expect(partChecks.every((c) => c.status === 'pass')).toBe(true);
        // Behaviors fail
        const behaviorChecks = report.checks.filter((c) => c.category === 'behavior');
        expect(behaviorChecks.every((c) => c.status === 'fail')).toBe(true);
        // Score is 50% (2 parts pass, 2 behaviors fail)
        expect(report.score).toBe(50);
    });
    it('fails parts check when graph is missing a required part', () => {
        const incompleteGraph = {
            nodes: [makeNode('basys3-1', 'fpga-basys3')],
            wires: [],
            net: {},
        };
        const results = evaluateParts(incompleteGraph, LAB0_TEMPLATE);
        const unoCheck = results.find((r) => r.id === 'parts:arduino-uno');
        expect(unoCheck?.status).toBe('missing');
    });
    it('detects SW0 held for exactly min_ticks threshold', () => {
        let seq = 0;
        const events = [
            { type: 'SIM_PIN_DIFF', tick: 100, seq: seq++, source: 'engine', pinDiffs: { 'basys3-1:SW0': 1 } },
            { type: 'SIM_PIN_DIFF', tick: 105, seq: seq++, source: 'engine', pinDiffs: { 'basys3-1:SW0': 0 } },
        ];
        const timeline = { events, snapshots: [] };
        const behaviorResults = evaluateBehavior(graph, timeline, LAB0_TEMPLATE, 200);
        const sw0 = behaviorResults.find((r) => r.id === 'behavior:sw0_high');
        expect(sw0?.status).toBe('pass');
    });
    it('detects blink with period within tolerance', () => {
        let seq = 0;
        // Period of 43 (within tolerance of 6 from target 40)
        const events = [
            { type: 'SIM_PIN_DIFF', tick: 10, seq: seq++, source: 'engine', pinDiffs: { 'uno-1:D13': 1 } },
            { type: 'SIM_PIN_DIFF', tick: 30, seq: seq++, source: 'engine', pinDiffs: { 'uno-1:D13': 0 } },
            { type: 'SIM_PIN_DIFF', tick: 53, seq: seq++, source: 'engine', pinDiffs: { 'uno-1:D13': 1 } },
            { type: 'SIM_PIN_DIFF', tick: 73, seq: seq++, source: 'engine', pinDiffs: { 'uno-1:D13': 0 } },
            { type: 'SIM_PIN_DIFF', tick: 96, seq: seq++, source: 'engine', pinDiffs: { 'uno-1:D13': 1 } },
        ];
        const timeline = { events, snapshots: [] };
        const behaviorResults = evaluateBehavior(graph, timeline, LAB0_TEMPLATE, 200);
        const blink = behaviorResults.find((r) => r.id === 'behavior:blink_uno');
        expect(blink?.status).toBe('pass');
    });
    it('rejects blink with period outside tolerance', () => {
        let seq = 0;
        // Period of 60 (outside tolerance of 6 from target 40)
        const events = [
            { type: 'SIM_PIN_DIFF', tick: 10, seq: seq++, source: 'engine', pinDiffs: { 'uno-1:D13': 1 } },
            { type: 'SIM_PIN_DIFF', tick: 30, seq: seq++, source: 'engine', pinDiffs: { 'uno-1:D13': 0 } },
            { type: 'SIM_PIN_DIFF', tick: 70, seq: seq++, source: 'engine', pinDiffs: { 'uno-1:D13': 1 } },
            { type: 'SIM_PIN_DIFF', tick: 90, seq: seq++, source: 'engine', pinDiffs: { 'uno-1:D13': 0 } },
            { type: 'SIM_PIN_DIFF', tick: 130, seq: seq++, source: 'engine', pinDiffs: { 'uno-1:D13': 1 } },
        ];
        const timeline = { events, snapshots: [] };
        const behaviorResults = evaluateBehavior(graph, timeline, LAB0_TEMPLATE, 200);
        const blink = behaviorResults.find((r) => r.id === 'behavior:blink_uno');
        expect(blink?.status).toBe('fail');
    });
    it('report includes evidence metadata', () => {
        const timeline = makePassingTimeline();
        const report = evaluateAtTick(graph, timeline, LAB0_TEMPLATE, TEMPLATE_HASH, EVAL_TICK);
        expect(report.templateVersion).toBe('1.0.0');
        expect(report.templateHash).toBe(TEMPLATE_HASH);
        expect(report.tick).toBe(EVAL_TICK);
        expect(report.evidence).toBeDefined();
        expect(report.evidence.behavior).toBe(2);
    });
});
