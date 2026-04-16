import { describe, expect, it } from 'vitest';
import type { Node } from '@redbyte/rb-logic-core';
import { getDesignChipMetadataForNode, normalizeRegisterWidth } from '../registerFamilyChipMetadata';

describe('registerFamilyChipMetadata', () => {
  it('expands bus register ports from width in node config', () => {
    const node: Node = {
      id: 'rb1',
      type: 'RegisterBus',
      position: { x: 0, y: 0 },
      rotation: 0,
      config: { width: 3 },
      state: {},
    };
    const meta = getDesignChipMetadataForNode(node);
    expect(meta?.inputs.some((p) => p.id === 'D[0]')).toBe(true);
    expect(meta?.inputs.some((p) => p.id === 'D[2]')).toBe(true);
    expect(meta?.inputs.some((p) => p.id === 'D[3]')).toBe(false);
    expect(meta?.outputs.some((p) => p.id === 'Q[2]')).toBe(true);
    expect(meta?.name).toContain('3b');
  });

  it('does not add bit ports for Register1', () => {
    const node: Node = {
      id: 'r1',
      type: 'Register1',
      position: { x: 0, y: 0 },
      rotation: 0,
      config: { width: 1 },
      state: {},
    };
    const meta = getDesignChipMetadataForNode(node);
    expect(meta?.inputs.some((p) => p.id === 'D[0]')).toBe(false);
    expect(meta?.outputs.some((p) => p.id === 'Q[0]')).toBe(false);
  });

  it('normalizes register width with sane bounds', () => {
    expect(normalizeRegisterWidth('Register1', { width: 99 })).toBe(32);
    expect(normalizeRegisterWidth('RegisterBus', { width: 0 })).toBe(8);
  });
});
