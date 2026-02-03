import { useLabStore } from '../store';
import { validateLabGraph } from '../validators';
console.log("Loading store...");
const store = useLabStore;
console.log("Store loaded. Resetting...");
store.getState().reset();
console.log("Reset complete. Validating graph...");
const state = store.getState();
const valid = validateLabGraph(state.graph);
console.log("Graph Valid:", valid.valid);
if (!valid.valid)
    console.error(valid.errors);
console.log("Adding Node...");
store.getState().addNode({ id: "n1", type: "arduino-nano", pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }, properties: {} });
console.log("Node Added.");
const valid2 = validateLabGraph(store.getState().graph);
console.log("Graph Valid 2:", valid2.valid);
console.log("Done.");
