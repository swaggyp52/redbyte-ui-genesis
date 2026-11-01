import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DESIGN_TOOLBAR_COMMAND_IDS,
  DESIGN_TOOLBAR_COMMAND_GROUPS,
  IDE_COMMAND_IDS,
  createIdeCommandRegistry,
  listDesignToolbarCommandGroupOrder,
  moveDesignToolbarCommandGroup,
  type IdeCommand,
} from '../ideCommandRegistry';

interface TestContext {
  canSave: boolean;
  showAdvanced: boolean;
}

function createCommands(spies?: { save?: ReturnType<typeof vi.fn> }): IdeCommand<TestContext>[] {
  return [
    {
      id: IDE_COMMAND_IDS.fitDesignCanvas,
      title: 'Fit canvas',
      category: 'design',
      keywords: ['center view', 'zoom', 'center view'],
      shortcut: { key: 'f', label: 'F' },
      execute: () => undefined,
    },
    {
      id: IDE_COMMAND_IDS.saveProject,
      title: 'Save project',
      category: 'project',
      keywords: ['persist', 'write'],
      shortcut: { key: 's', modifiers: ['primary'], label: 'Ctrl+S' },
      availability: (context) =>
        context.canSave
          ? { state: 'available' }
          : { state: 'disabled', reason: 'No project changes to save.' },
      execute: async () => {
        spies?.save?.();
      },
    },
    {
      id: IDE_COMMAND_IDS.restoreRecoverySnapshot,
      title: 'Restore recovery snapshot',
      category: 'project',
      keywords: ['backup', 'recover'],
      availability: (context) =>
        context.showAdvanced
          ? { state: 'available' }
          : { state: 'hidden', reason: 'No recovery snapshot is available.' },
      execute: () => undefined,
    },
  ];
}

describe('IDE command registry', () => {
  it('reorders complete Design toolbar groups without dropping commands', () => {
    expect(listDesignToolbarCommandGroupOrder(DEFAULT_DESIGN_TOOLBAR_COMMAND_IDS)).toEqual([
      'mode',
      'history',
      'canvas',
    ]);

    const reordered = moveDesignToolbarCommandGroup(
      DEFAULT_DESIGN_TOOLBAR_COMMAND_IDS,
      'canvas',
      'up'
    );
    expect(listDesignToolbarCommandGroupOrder(reordered)).toEqual([
      'mode',
      'canvas',
      'history',
    ]);
    expect(new Set(reordered)).toEqual(new Set(DEFAULT_DESIGN_TOOLBAR_COMMAND_IDS));
    expect(reordered).toHaveLength(DEFAULT_DESIGN_TOOLBAR_COMMAND_IDS.length);
    expect(DESIGN_TOOLBAR_COMMAND_GROUPS.map((group) => group.id)).toEqual([
      'mode',
      'history',
      'canvas',
    ]);
  });

  it('keeps stable command IDs unique and normalizes searchable metadata', () => {
    const registry = createIdeCommandRegistry(createCommands());

    expect(registry.list()).toHaveLength(3);
    expect(registry.get(IDE_COMMAND_IDS.fitDesignCanvas)?.keywords).toEqual([
      'center view',
      'zoom',
    ]);
    expect(Object.isFrozen(registry.list())).toBe(true);

    expect(
      () =>
        createIdeCommandRegistry([
          createCommands()[0],
          { ...createCommands()[0], title: 'A duplicate' },
        ])
    ).toThrow(/Duplicate IDE command id/);
  });

  it('searches titles, keywords, categories, shortcuts, and fuzzy subsequences', () => {
    const registry = createIdeCommandRegistry(createCommands());
    const context = { canSave: false, showAdvanced: false };

    expect(registry.search('fit canvas', context)[0]?.command.id).toBe(
      IDE_COMMAND_IDS.fitDesignCanvas
    );
    expect(registry.search('center view', context)[0]?.command.id).toBe(
      IDE_COMMAND_IDS.fitDesignCanvas
    );
    expect(registry.search('ft cv', context)[0]?.command.id).toBe(
      IDE_COMMAND_IDS.fitDesignCanvas
    );
    expect(registry.search('ctrl s', context)[0]?.command.id).toBe(
      IDE_COMMAND_IDS.saveProject
    );
    expect(registry.search('project', context).map((match) => match.command.id)).toEqual([
      IDE_COMMAND_IDS.saveProject,
    ]);
  });

  it('filters context-aware availability and preserves disabled reasons', () => {
    const registry = createIdeCommandRegistry(createCommands());
    const context = { canSave: false, showAdvanced: false };

    const projectCommands = registry.filter(context, { categories: ['project'] });
    expect(projectCommands).toHaveLength(1);
    expect(projectCommands[0]?.command.id).toBe(IDE_COMMAND_IDS.saveProject);
    expect(projectCommands[0]?.availability).toEqual({
      state: 'disabled',
      reason: 'No project changes to save.',
    });

    expect(
      registry.filter(context, { categories: ['project'], includeDisabled: false })
    ).toEqual([]);
    expect(
      registry.filter(context, { categories: ['project'], includeHidden: true })
    ).toHaveLength(2);
  });

  it('executes only the current available authority callback', async () => {
    const save = vi.fn();
    const registry = createIdeCommandRegistry(createCommands({ save }));

    await expect(
      registry.execute(IDE_COMMAND_IDS.saveProject, { canSave: false, showAdvanced: false })
    ).resolves.toEqual({
      status: 'disabled',
      id: IDE_COMMAND_IDS.saveProject,
      reason: 'No project changes to save.',
    });
    expect(save).not.toHaveBeenCalled();

    await expect(
      registry.execute(IDE_COMMAND_IDS.saveProject, { canSave: true, showAdvanced: false })
    ).resolves.toEqual({ status: 'executed', id: IDE_COMMAND_IDS.saveProject });
    expect(save).toHaveBeenCalledTimes(1);

    await expect(
      registry.execute(IDE_COMMAND_IDS.restoreRecoverySnapshot, {
        canSave: true,
        showAdvanced: false,
      })
    ).resolves.toEqual({
      status: 'hidden',
      id: IDE_COMMAND_IDS.restoreRecoverySnapshot,
      reason: 'No recovery snapshot is available.',
    });

    await expect(
      registry.execute('missing.command', { canSave: true, showAdvanced: true })
    ).resolves.toEqual({ status: 'not-found', id: 'missing.command' });
  });
});
