import { describe, it, expect } from 'vitest';
import { SketchRuntime } from '../sketchEngine';
const buildGraph = () => {
    const nano = {
        id: 'nano-1',
        type: 'arduino-nano',
        pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
        properties: {}
    };
    return { nodes: [nano], wires: [], net: {} };
};
const runSketch = (source, ticks, inputs) => {
    const runtime = new SketchRuntime({ tickMs: 50, stepBudget: 1000 });
    const result = runtime.load(source);
    expect(result.ok).toBe(true);
    const graph = buildGraph();
    const pinStates = {};
    const serial = [];
    const writes = [];
    let error = null;
    for (let tick = 1; tick <= ticks; tick += 1) {
        if (inputs) {
            const updates = inputs(tick);
            Object.entries(updates).forEach(([key, value]) => {
                pinStates[key] = value;
            });
        }
        runtime.step({
            tick,
            graph,
            pinStates,
            emitSerial: (text) => serial.push(text),
            emitError: (message) => {
                error = message;
            },
            onPinWrite: (pinKey, value) => {
                pinStates[pinKey] = value;
                writes.push({ tick, pinKey, value });
            }
        });
        if (error)
            break;
    }
    return { serial, writes, error };
};
describe('SketchRuntime', () => {
    it('is deterministic for the same source', () => {
        const source = `void setup() { pinMode(13, OUTPUT); }
void loop() {
  digitalWrite(13, HIGH);
  delay(100);
  digitalWrite(13, LOW);
  delay(100);
}`;
        const first = runSketch(source, 10);
        const second = runSketch(source, 10);
        expect(first).toEqual(second);
    });
    it('reads digital inputs deterministically', () => {
        const source = `void loop() {
  if (digitalRead(2) == HIGH) {
    Serial.println("ON");
  } else {
    Serial.println("OFF");
  }
  delay(50);
}`;
        const pattern = (tick) => ({ 'nano-1:D2': tick % 2 === 1 ? 1 : 0 });
        const result = runSketch(source, 4, pattern);
        expect(result.serial).toEqual(['ON\n', 'OFF\n', 'ON\n', 'OFF\n']);
        expect(result.error).toBeNull();
    });
    it('fails safely on step budget exhaustion', () => {
        const source = `void loop() {
  while (true) {
  }
}`;
        const result = runSketch(source, 1);
        expect(result.error).toContain('step budget');
    });
});
