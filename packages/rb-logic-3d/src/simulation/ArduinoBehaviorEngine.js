// Minimal Arduino Behavioral Model
// Replaces full AVR emulation for MVP
export class ArduinoBehaviorEngine {
    graph;
    pins = new Map();
    pinValues = new Map();
    millisCounter = 0;
    TICK_MS = 50; // Simulation step size (20Hz) - deterministic unit
    constructor(graph) {
        this.graph = graph;
        this.setup();
    }
    // Mapping: "D13" -> NetId
    getNetForPin(nodeId, pinId) {
        // Find wire connected to this pin
        // In MVP, we just search wires. 
        // Real implementation: Store maintains a netlist. 
        // For MVP, simplified: just see if wire exists.
        return undefined; // TODO: Real netlist lookup
    }
    setup() {
        // User code "setup()" would run here
        this.pinMode(13, 'OUTPUT');
    }
    loop() {
        // User code "loop()" runs here
        // BLINK SKETCH
        this.digitalWrite(13, 'HIGH');
        this.delay(1000);
        this.digitalWrite(13, 'LOW');
        this.delay(1000);
    }
    // --- Arduino API ---
    pinMode(pin, mode) {
        this.pins.set(`D${pin}`, mode);
        console.log(`[SIM] pinMode D${pin} = ${mode}`);
    }
    digitalWrite(pin, val) {
        this.pinValues.set(`D${pin}`, val === 'HIGH' ? 1 : 0);
        // Emulate Net update here -> Propagate to connected components (LED)
    }
    delay(ms) {
        // This is tricky. In a real loop, delay blocks.
        // In our step-based engine, we need a state machine or coroutine.
        // For MVP, we will implement a simple tick-based state machine manually.
    }
}
// Deterministic Runner
export class BlinkController {
    tick = 0;
    // Hardcoded Blink Logic for MVP
    // Tick Rate: 20Hz (50ms per tick)
    // 1000ms = 20 ticks
    step() {
        this.tick++;
        const cycle = 40; // 20 ticks high, 20 ticks low (1s on, 1s off)
        const phase = this.tick % cycle;
        const d13State = phase < 20 ? 1 : 0;
        return {
            D13: d13State
        };
    }
}
