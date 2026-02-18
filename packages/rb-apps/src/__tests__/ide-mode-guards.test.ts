import { describe, expect, it, vi } from 'vitest';
import type { RBProject } from '../export/projectFormat';
import {
  evaluateModeMutationBoundary,
  formatModeGuardMessage,
  logModeGuardViolation,
} from '../apps/ide/modeGuards';

const buildProject = (overrides: Partial<RBProject> = {}): RBProject => ({
  kind: 'rb-project',
  version: 1,
  createdAt: '2026-02-19T00:00:00.000Z',
  updatedAt: '2026-02-19T00:00:00.000Z',
  name: 'Mode Guard Fixture',
  circuit: { nodes: [], connections: [] },
  ...overrides,
});

describe('ide mode mutation guards', () => {
  it('allows changes to fields explicitly allowed for the current mode', () => {
    const before = buildProject();
    const after = buildProject({
      updatedAt: '2026-02-19T00:05:00.000Z',
      layout: { perspectiveId: 'design', splitRatio: 0.7, dock: { open: true, tab: 'inspect' } },
      submodules: [
        {
          id: 'chip-1',
          name: 'MyChip',
          type: 'custom-chip',
          inputPins: ['A'],
          outputPins: ['Y'],
        },
      ],
    });

    const result = evaluateModeMutationBoundary('design', before, after);

    expect(result.ok).toBe(true);
    expect(result.disallowedFields).toEqual([]);
    expect(result.changedFields).toContain('layout');
    expect(result.changedFields).toContain('submodules');
    expect(result.changedFields).toContain('updatedAt');
  });

  it('blocks illegal mutation and emits a deterministic violation payload', () => {
    const before = buildProject({ name: 'Before Name' });
    const after = buildProject({
      name: 'After Name',
      updatedAt: '2026-02-19T00:10:00.000Z',
    });

    const result = evaluateModeMutationBoundary('design', before, after);
    const logger = vi.fn();

    expect(result.ok).toBe(false);
    expect(result.disallowedFields).toContain('name');

    const message = formatModeGuardMessage(result);
    expect(message).toContain('mode=design');
    expect(message).toContain('name');

    logModeGuardViolation(logger, result);
    expect(logger).toHaveBeenCalledTimes(1);
    expect(logger.mock.calls[0]?.[0]).toMatchObject({
      mode: 'design',
      disallowedFields: ['name'],
    });
  });
});
