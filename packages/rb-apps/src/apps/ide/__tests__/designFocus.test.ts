import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDesignFocusRequest,
  _resetDesignFocusRequestIdsForTests,
} from '../designFocus';

describe('designFocus', () => {
  beforeEach(() => {
    _resetDesignFocusRequestIdsForTests();
  });

  it('issues monotonic request ids so effect consumers can dedupe', () => {
    const a = createDesignFocusRequest('macro', 'm1', 'Adder4');
    const b = createDesignFocusRequest('macro', 'm1', 'Adder4');
    expect(a.requestId).toBe(1);
    expect(b.requestId).toBe(2);
  });

  it('preserves kind, targetId, and displayName', () => {
    const req = createDesignFocusRequest('custom-component', 'ALU', 'ALU');
    expect(req.kind).toBe('custom-component');
    expect(req.targetId).toBe('ALU');
    expect(req.displayName).toBe('ALU');
  });

  it('distinguishes macro from custom-component requests', () => {
    const macro = createDesignFocusRequest('macro', 'm1', 'Adder4');
    const comp = createDesignFocusRequest('custom-component', 'ALU', 'ALU');
    expect(macro.kind).not.toBe(comp.kind);
  });
});
