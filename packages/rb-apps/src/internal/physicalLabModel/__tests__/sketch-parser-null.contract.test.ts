import { describe, expect, it, vi } from 'vitest';
import { compileSketch, SketchRuntime } from '../sketchEngine';

describe('sketch parser failure versus optional expression', () => {
  it.each([
    'void loop() { return (); }',
    'void loop() { int value = (); }',
    'void loop() { int value; value = (); }',
  ])('preserves expression diagnostics and rejects invalid AST statements: %s', (source) => {
    const compiled = compileSketch(source);
    expect(compiled.errors.some((message) => message.includes('Unexpected token )'))).toBe(true);
    const runtime = new SketchRuntime({ tickMs: 50, stepBudget: 100 });
    const loaded = runtime.load(source);
    expect(loaded.ok).toBe(false);
    expect(loaded.error).toContain('Unexpected token )');
    const write = vi.fn(), serial = vi.fn();
    runtime.step({ tick: 1, graph: { nodes: [], wires: [], net: {} }, pinStates: {},
      onPinWrite: write, emitSerial: serial, emitError: vi.fn(), });
    expect(write).not.toHaveBeenCalled();
    expect(serial).not.toHaveBeenCalled();
  });

  it.each([
    'void loop() { return; }',
    'void loop() { return 0; }',
    'void loop() { int value; return; }',
    'void loop() { int value = 0; value = 1; }',
  ])('retains valid absent, zero, and assigned expressions: %s', (source) => {
    expect(compileSketch(source).errors).toEqual([]);
    expect(new SketchRuntime({ tickMs: 50, stepBudget: 100 }).load(source).ok).toBe(true);
  });
});
