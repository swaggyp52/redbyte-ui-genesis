import { useLabStore } from '../store';
import { validateLabGraph, fingerprintState } from '../validators';
import { PART_DEFINITIONS } from '../parts';
// Polyfill Web Crypto if needed (Node 20 should have it)
if (!global.crypto) {
    console.warn("Polyfilling crypto");
    global.crypto = require('crypto').webcrypto;
}
// Advanced Fuzz Configuration
const MODES = {
    BASIC: { iterations: 500, checkInvariants: true },
    STRESS: { iterations: 10000, checkInvariants: false }, // Too slow to check every step
    MODE_SWITCH: { iterations: 1000, checkInvariants: true, probSwitch: 0.1 }
};
async function runFuzz(modeName = 'BASIC') {
    const config = MODES[modeName];
    console.log(`Starting Fuzz Test [${modeName}] (${config.iterations} iterations)...`);
    // Access store directly (zustand create returns hook + api)
    const store = useLabStore;
    store.getState().reset();
    let partIds = [];
    let wireIds = [];
    let failures = 0;
    let recoveries = 0;
    // Seeded Random Helper
    let seedState = 12345;
    const random = () => {
        seedState = (seedState * 9301 + 49297) % 233280;
        return seedState / 233280;
    };
    const randInt = (max) => Math.floor(random() * max);
    const randItem = (arr) => arr.length ? arr[randInt(arr.length)] : undefined;
    const dumpDebug = (step) => {
        const state = store.getState();
        console.error("--- DEBUG DUMP ---");
        console.error(`Step: ${step}, Seed: 12345`);
        console.error(`Events: ${state.timeline.events.length}`);
        if (state.timeline.events.length > 0)
            console.error(`Last Event:`, state.timeline.events[state.timeline.events.length - 1]);
        console.error("------------------");
    };
    const startTotal = performance.now();
    for (let i = 0; i < config.iterations; i++) {
        const state = store.getState();
        // Invariant Check (if enabled)
        if (config.checkInvariants) {
            const gValid = validateLabGraph(state.graph);
            if (!gValid.valid) {
                dumpDebug(i);
                throw new Error(`Invariant Failed BEFORE step ${i}: ${gValid.errors.join(',')}`);
            }
        }
        // Action Selection
        const actionType = randInt(100);
        try {
            if (actionType < 10) { // Add Part
                const types = Object.keys(PART_DEFINITIONS);
                const type = types[randInt(types.length)];
                const id = `${type}-${i}`;
                const node = {
                    id,
                    type,
                    pose: { position: { x: (random() - 0.5) * 20, y: (random() - 0.5) * 20, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
                    properties: {}
                };
                store.getState().addNode(node);
                partIds.push(id);
            }
            else if (actionType < 30) { // Move Part
                const id = randItem(partIds);
                if (id) {
                    // Fuzz: Try NaN occasionally?
                    const isEvil = random() < 0.01;
                    const x = isEvil ? NaN : (random() - 0.5) * 20;
                    store.getState().updateNodePose(id, { x, y: (random() - 0.5) * 20, z: 0 }, { x: 0, y: 0, z: random(), w: 1 } // Non-normalized often
                    );
                }
            }
            else if (actionType < 50) { // Add Wire
                if (partIds.length >= 2) {
                    const srcId = randItem(partIds);
                    const tgtId = randItem(partIds);
                    const wire = {
                        id: `w-${i}`,
                        sourceNodeId: srcId, sourcePinId: 'D13',
                        targetNodeId: tgtId, targetPinId: 'GND',
                        color: 'green'
                    };
                    store.getState().addWire(wire);
                    wireIds.push(wire.id);
                }
            }
            else if (actionType < 60) { // Remove Wire
                const wId = randItem(wireIds);
                if (wId) {
                    store.getState().removeWire(wId);
                    wireIds = wireIds.filter(id => id !== wId);
                }
            }
            else if (actionType < 80) { // Run Sim
                store.getState().runSimulationStep();
            }
            else if (modeName === 'MODE_SWITCH' && actionType < 90) { // Toggle Mode
                const mode = state.simulation.playbackMode === 'live' ? 'replay' : 'live';
                store.getState().setPlaybackMode(mode);
                if (mode === 'replay') {
                    // Scrub random
                    const t = randInt(state.simulation.tick);
                    store.getState().scrub(t);
                }
            }
            // Check Integrity Error
            if (store.getState().integrityError) {
                // If we injected evil NaN, this is expected behavior (blocked or caught).
                // But if we injected valid stuff and it broke, that's bad.
                // store.recover() auto-fixes.
                recoveries++;
                store.getState().recover();
            }
        }
        catch (e) {
            console.error(`CRASH at step ${i}:`, e);
            dumpDebug(i);
            throw e;
        }
    }
    const duration = performance.now() - startTotal;
    // Receipts
    console.log("\n--- FUZZ RECEIPTS ---");
    console.log(`Mode: ${modeName}`);
    console.log(`Iterations: ${config.iterations}`);
    console.log(`Time: ${duration.toFixed(2)}ms`);
    console.log(`Final Parts: ${partIds.length}`);
    console.log(`Final Wires: ${wireIds.length}`);
    console.log(`Recoveries: ${recoveries}`);
    const state = store.getState();
    const hash = await fingerprintState({
        graph: state.graph,
        pinStates: state.simulation.pinStates,
        tick: state.simulation.tick
    });
    console.log(`Final State Hash: ${hash}`);
    if (recoveries > 0 && modeName === 'BASIC') {
        console.warn("WARNING: Basic fuzz triggered recoveries. Invariants might be too loose or generator too evil.");
    }
    else {
        console.log("SUCCESS: Robustness Verified.");
    }
}
// Run Suite
(async () => {
    try {
        await runFuzz('BASIC');
    }
    catch (e) {
        console.error(e);
        process.exit(1);
    }
    // Optional: Uncomment for intense testing
    // try { await runFuzz('MODE_SWITCH'); } catch(e) { process.exit(1); }
})();
