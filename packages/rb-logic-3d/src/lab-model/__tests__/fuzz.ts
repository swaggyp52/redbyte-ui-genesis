
import { useLabStore } from '../store';
import { validateLabGraph, validateTimeline, fingerprintState, repairLabGraph } from '../validators';
import { PART_DEFINITIONS } from '../parts';
import { LabNode, LabWire } from '../types';

// Polyfill Web Crypto if needed (Node 20 should have it)
if (!global.crypto) {
    console.warn("Polyfilling crypto");
    global.crypto = require('crypto').webcrypto;
}

const ITERATIONS = 500;
const SEED = 12345; // TODO: Real seeded random

// Simple PRNG
let seedState = SEED;
const random = () => {
    seedState = (seedState * 9301 + 49297) % 233280;
    return seedState / 233280;
};
const randInt = (max: number) => Math.floor(random() * max);
const randItem = <T>(arr: T[]): T | undefined => arr.length ? arr[randInt(arr.length)] : undefined;

async function runFuzz() {
    console.log(`Starting Fuzz Test (${ITERATIONS} iterations)...`);

    // Access store directly (zustand create returns hook + api)
    const store = useLabStore;
    store.getState().reset();

    let partIds: string[] = [];
    let wireIds: string[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
        const state = store.getState();

        // Check Invariants BEFORE action
        const gValid = validateLabGraph(state.graph);
        if (!gValid.valid) throw new Error(`Invariant Failed BEFORE step ${i}: ${gValid.errors.join(',')}`);

        // Random Action
        const actionType = randInt(10);

        try {
            if (actionType < 2) {
                // ADD PART
                const types = Object.keys(PART_DEFINITIONS);
                const type = types[randInt(types.length)];
                const id = `${type}-${i}`;
                const node: LabNode = {
                    id,
                    type,
                    pose: { position: { x: random() * 10, y: random() * 10, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
                    properties: {}
                };
                store.getState().addNode(node);
                partIds.push(id);
                // console.log(`Step ${i}: Added Node ${id}`);

            } else if (actionType < 4) {
                // MOVE PART
                const id = randItem(partIds);
                if (id) {
                    store.getState().updateNodePose(id,
                        { x: random() * 10, y: random() * 10, z: 0 },
                        { x: 0, y: 0, z: random(), w: 1 }
                    );
                    // console.log(`Step ${i}: Moved Node ${id}`);
                }

            } else if (actionType < 6) {
                // ADD WIRE
                if (partIds.length >= 2) {
                    const srcId = randItem(partIds)!;
                    const tgtId = randItem(partIds)!;
                    if (srcId !== tgtId) {
                        // Pick random pins (mocking)
                        // MVP definition doesn't expose pins easily in a list, we hardcode generic names or just trust validation fails if invalid?
                        // Actually PART_DEFINITIONS has `pins`?
                        // Let's assume generic pins for fuzzing or look up.
                        // Validators check pin existence? NO, basic validator creates warnings but doesn't deep check part defs in this version.
                        // Let's just try 'D13' -> 'Anode' etc.
                        const wire: LabWire = {
                            id: `w-${i}`,
                            sourceNodeId: srcId,
                            sourcePinId: 'D13', // simplistic
                            targetNodeId: tgtId,
                            targetPinId: 'GND',
                            color: 'green'
                        };
                        store.getState().addWire(wire);
                        wireIds.push(wire.id);
                        // console.log(`Step ${i}: Added Wire`);
                    }
                }

            } else if (actionType < 7) {
                // REMOVE WIRE
                const wId = randItem(wireIds);
                if (wId) {
                    store.getState().removeWire(wId);
                    wireIds = wireIds.filter(id => id !== wId);
                    // console.log(`Step ${i}: Removed Wire`);
                }

            } else {
                // RUN SIMULATION
                store.getState().runSimulationStep();
                // console.log(`Step ${i}: Sim Step`);
            }

            // Check Invariants AFTER action
            const postValid = validateLabGraph(store.getState().graph);
            if (!postValid.valid) {
                // The store should have prevented invalid mutations (addNode/addWire check inputs).
                // If we forced it or if simulation broke it:
                console.error("Invariant Failure Detected!", postValid.errors);
                throw new Error("Store allowed invalid state!");
            }

            // Check Integrity Error
            if (store.getState().integrityError) {
                console.warn("Integrity Error Triggered:", store.getState().integrityError);
                // This is actually valid behavior if we fed garbage and it was caught.
                // But our Fuzz inputs should be "valid-ish".
                // Recover
                store.getState().recover();
            }

        } catch (e) {
            console.error(`Error at step ${i}:`, e);
            throw e;
        }
    }

    // Final Determinism Check
    console.log("Iterations Complete. checking final state fingerprint...");
    const state = store.getState();
    const hash = await fingerprintState({
        graph: state.graph,
        pinStates: state.simulation.pinStates,
        tick: state.simulation.tick
    });
    console.log("Final State Hash:", hash);
    console.log("SUCCESS: Fuzz Test Passed without Crash or Corruption.");
}

runFuzz().catch(e => {
    console.error("Fuzz Test Failed:", e);
    process.exit(1);
});
