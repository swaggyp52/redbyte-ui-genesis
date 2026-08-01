/**
 * Stable command identifiers for the shared IDE command system.
 *
 * The registry deliberately owns no product state. Commands execute callbacks
 * supplied by the current surface authority so the palette and visible
 * controls cannot create a second mutation path.
 */
export type IdeCommandId = `${string}.${string}`;

/** Browser-local bridge used by a mounted surface to execute its own authority callback. */
export const IDE_COMMAND_EVENT_NAME = 'redbyte:ide-command' as const;

export const IDE_COMMAND_IDS = {
  openCommandPalette: 'workbench.command-palette.open',
  openProjectSurface: 'surface.project.open',
  openDesignSurface: 'surface.design.open',
  openSimulateSurface: 'surface.simulate.open',
  openBoardSurface: 'surface.board.open',
  openExportSurface: 'surface.export.open',
  openImportRecover: 'surface.import-recover.open',
  saveProject: 'project.save',
  saveProjectAs: 'project.save-as',
  duplicateProject: 'project.duplicate',
  openProject: 'project.open',
  buildFreshProject: 'project.build-fresh',
  restoreRecoverySnapshot: 'project.recovery.restore',
  undoDesignEdit: 'edit.undo',
  redoDesignEdit: 'edit.redo',
  selectDesignTool: 'design.tool.select',
  selectWireTool: 'design.tool.wire',
  arrangeDesign: 'design.arrange',
  fitDesignCanvas: 'design.canvas.fit',
  zoomInDesignCanvas: 'design.canvas.zoom-in',
  zoomOutDesignCanvas: 'design.canvas.zoom-out',
  showDesignCanvas: 'design.view.canvas',
  showDesignCode: 'design.view.code',
  showDesignSplit: 'design.view.split',
  toggleWorkspacePanel: 'workspace.panel.toggle',
  resetWorkspaceLayout: 'workspace.layout.reset',
  useAuthoringPreset: 'workspace.preset.authoring',
  useSimulationPreset: 'workspace.preset.simulation',
  useBoardPreset: 'workspace.preset.board',
  useCodePreset: 'workspace.preset.code',
  runSimulation: 'simulation.run',
  openReplay: 'simulation.replay.open',
  assignBoardResource: 'board.resource.assign',
  buildExportPackage: 'export.package.build',
  useLightTheme: 'theme.light',
  useDarkTheme: 'theme.dark',
  useSystemTheme: 'theme.system',
  openHelp: 'help.open',
} as const satisfies Record<string, IdeCommandId>;

export type BuiltInIdeCommandId = (typeof IDE_COMMAND_IDS)[keyof typeof IDE_COMMAND_IDS];

export const DEFAULT_DESIGN_TOOLBAR_COMMAND_IDS = [
  IDE_COMMAND_IDS.selectDesignTool,
  IDE_COMMAND_IDS.selectWireTool,
  IDE_COMMAND_IDS.undoDesignEdit,
  IDE_COMMAND_IDS.redoDesignEdit,
  IDE_COMMAND_IDS.arrangeDesign,
  IDE_COMMAND_IDS.fitDesignCanvas,
  IDE_COMMAND_IDS.zoomOutDesignCanvas,
  IDE_COMMAND_IDS.zoomInDesignCanvas,
] as const satisfies readonly IdeCommandId[];

/** Commands that stay directly reachable even after toolbar customization. */
export const REQUIRED_DESIGN_TOOLBAR_COMMAND_IDS = [
  IDE_COMMAND_IDS.selectDesignTool,
  IDE_COMMAND_IDS.undoDesignEdit,
  IDE_COMMAND_IDS.redoDesignEdit,
] as const satisfies readonly IdeCommandId[];

export const DESIGN_TOOLBAR_COMMAND_GROUPS = [
  {
    id: 'mode',
    label: 'Mode tools',
    commandIds: [IDE_COMMAND_IDS.selectDesignTool, IDE_COMMAND_IDS.selectWireTool],
  },
  {
    id: 'history',
    label: 'History tools',
    commandIds: [IDE_COMMAND_IDS.undoDesignEdit, IDE_COMMAND_IDS.redoDesignEdit],
  },
  {
    id: 'canvas',
    label: 'Canvas tools',
    commandIds: [
      IDE_COMMAND_IDS.arrangeDesign,
      IDE_COMMAND_IDS.fitDesignCanvas,
      IDE_COMMAND_IDS.zoomOutDesignCanvas,
      IDE_COMMAND_IDS.zoomInDesignCanvas,
    ],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  commandIds: readonly IdeCommandId[];
}[];

export type DesignToolbarCommandGroupId = (typeof DESIGN_TOOLBAR_COMMAND_GROUPS)[number]['id'];

/** Resolve visible group order from the persisted command sequence. */
export function listDesignToolbarCommandGroupOrder(
  commandIds: readonly IdeCommandId[]
): DesignToolbarCommandGroupId[] {
  return DESIGN_TOOLBAR_COMMAND_GROUPS
    .map((group, defaultIndex) => {
      const indexes = group.commandIds
        .map((commandId) => commandIds.indexOf(commandId))
        .filter((index) => index >= 0);
      return {
        id: group.id,
        defaultIndex,
        firstCommandIndex: indexes.length > 0 ? Math.min(...indexes) : Number.POSITIVE_INFINITY,
      };
    })
    .sort(
      (left, right) =>
        left.firstCommandIndex - right.firstCommandIndex || left.defaultIndex - right.defaultIndex
    )
    .map((group) => group.id);
}

/** Move a whole toolbar command group while preserving command visibility and intra-group order. */
export function moveDesignToolbarCommandGroup(
  commandIds: readonly IdeCommandId[],
  groupId: DesignToolbarCommandGroupId,
  direction: 'up' | 'down'
): IdeCommandId[] {
  const groupOrder = listDesignToolbarCommandGroupOrder(commandIds);
  const currentIndex = groupOrder.indexOf(groupId);
  const targetIndex = currentIndex + (direction === 'up' ? -1 : 1);
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= groupOrder.length) {
    return [...commandIds];
  }

  [groupOrder[currentIndex], groupOrder[targetIndex]] = [
    groupOrder[targetIndex],
    groupOrder[currentIndex],
  ];
  const groupedCommandIds = new Set(
    DESIGN_TOOLBAR_COMMAND_GROUPS.flatMap((group) => [...group.commandIds])
  );
  const commandsByGroup = new Map(
    DESIGN_TOOLBAR_COMMAND_GROUPS.map((group) => [
      group.id,
      commandIds.filter((commandId) =>
        (group.commandIds as readonly IdeCommandId[]).includes(commandId)
      ),
    ])
  );
  return [
    ...groupOrder.flatMap((id) => commandsByGroup.get(id) ?? []),
    ...commandIds.filter((commandId) => !groupedCommandIds.has(commandId)),
  ];
}

export type IdeCommandCategory =
  | 'navigation'
  | 'project'
  | 'edit'
  | 'design'
  | 'simulation'
  | 'board'
  | 'export'
  | 'workspace'
  | 'theme'
  | 'help';

export type IdeCommandShortcutModifier = 'primary' | 'shift' | 'alt';

export interface IdeCommandShortcut {
  /** Physical key, for example `k` or `Enter`. */
  readonly key: string;
  /** `primary` means Ctrl on Windows/Linux and Command on macOS. */
  readonly modifiers?: readonly IdeCommandShortcutModifier[];
  /** Platform-neutral label displayed by the command palette. */
  readonly label: string;
}

export type IdeCommandAvailability =
  | { readonly state: 'available' }
  | { readonly state: 'disabled'; readonly reason: string }
  | { readonly state: 'hidden'; readonly reason?: string };

export const IDE_COMMAND_AVAILABLE: IdeCommandAvailability = Object.freeze({
  state: 'available',
});

export interface IdeCommand<TContext> {
  readonly id: IdeCommandId;
  readonly title: string;
  readonly category: IdeCommandCategory;
  readonly keywords: readonly string[];
  readonly shortcut?: IdeCommandShortcut;
  readonly availability?: (context: TContext) => IdeCommandAvailability;
  readonly execute: (context: TContext) => void | Promise<void>;
}

export interface ResolvedIdeCommand<TContext> {
  readonly command: IdeCommand<TContext>;
  readonly availability: IdeCommandAvailability;
}

export interface IdeCommandFilter {
  readonly categories?: readonly IdeCommandCategory[];
  readonly includeDisabled?: boolean;
  readonly includeHidden?: boolean;
}

export interface IdeCommandSearchMatch<TContext> extends ResolvedIdeCommand<TContext> {
  readonly score: number;
}

export type IdeCommandExecutionResult =
  | { readonly status: 'executed'; readonly id: IdeCommandId }
  | { readonly status: 'disabled'; readonly id: IdeCommandId; readonly reason: string }
  | { readonly status: 'hidden'; readonly id: IdeCommandId; readonly reason?: string }
  | { readonly status: 'not-found'; readonly id: IdeCommandId };

export function resolveIdeCommandAvailability<TContext>(
  command: IdeCommand<TContext>,
  context: TContext
): IdeCommandAvailability {
  const availability = command.availability?.(context) ?? IDE_COMMAND_AVAILABLE;
  if (availability.state === 'disabled' && !availability.reason.trim()) {
    throw new Error(`Disabled command "${command.id}" must provide a reason.`);
  }
  return availability;
}

export function filterIdeCommands<TContext>(
  commands: readonly IdeCommand<TContext>[],
  context: TContext,
  filter: IdeCommandFilter = {}
): readonly ResolvedIdeCommand<TContext>[] {
  const categories = filter.categories ? new Set(filter.categories) : null;

  return commands.flatMap((command) => {
    if (categories && !categories.has(command.category)) return [];
    const availability = resolveIdeCommandAvailability(command, context);
    if (availability.state === 'hidden' && !filter.includeHidden) return [];
    if (availability.state === 'disabled' && filter.includeDisabled === false) return [];
    return [{ command, availability }];
  });
}

export function searchIdeCommands<TContext>(
  commands: readonly IdeCommand<TContext>[],
  query: string,
  context: TContext,
  filter: IdeCommandFilter = {}
): readonly IdeCommandSearchMatch<TContext>[] {
  const resolved = filterIdeCommands(commands, context, filter);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return resolved.map((entry) => ({ ...entry, score: 0 }));
  }

  return resolved
    .flatMap((entry) => {
      const score = scoreCommand(entry.command, normalizedQuery);
      return score === null ? [] : [{ ...entry, score }];
    })
    .sort(compareCommandMatches);
}

export async function executeIdeCommand<TContext>(
  command: IdeCommand<TContext>,
  context: TContext
): Promise<IdeCommandExecutionResult> {
  const availability = resolveIdeCommandAvailability(command, context);
  if (availability.state === 'disabled') {
    return { status: 'disabled', id: command.id, reason: availability.reason };
  }
  if (availability.state === 'hidden') {
    return { status: 'hidden', id: command.id, reason: availability.reason };
  }

  await command.execute(context);
  return { status: 'executed', id: command.id };
}

/**
 * Immutable registry assembled at the shell boundary from existing authority
 * callbacks. Feature packages can create registries in tests without relying
 * on a browser-global singleton.
 */
export class IdeCommandRegistry<TContext> {
  readonly #commands: readonly IdeCommand<TContext>[];
  readonly #commandsById: ReadonlyMap<IdeCommandId, IdeCommand<TContext>>;

  constructor(commands: readonly IdeCommand<TContext>[]) {
    const commandsById = new Map<IdeCommandId, IdeCommand<TContext>>();
    const normalizedCommands = commands.map((command) => normalizeCommand(command));

    for (const command of normalizedCommands) {
      if (commandsById.has(command.id)) {
        throw new Error(`Duplicate IDE command id: ${command.id}`);
      }
      commandsById.set(command.id, command);
    }

    this.#commands = Object.freeze(normalizedCommands);
    this.#commandsById = commandsById;
  }

  list(): readonly IdeCommand<TContext>[] {
    return this.#commands;
  }

  get(id: IdeCommandId): IdeCommand<TContext> | undefined {
    return this.#commandsById.get(id);
  }

  filter(context: TContext, filter: IdeCommandFilter = {}): readonly ResolvedIdeCommand<TContext>[] {
    return filterIdeCommands(this.#commands, context, filter);
  }

  search(
    query: string,
    context: TContext,
    filter: IdeCommandFilter = {}
  ): readonly IdeCommandSearchMatch<TContext>[] {
    return searchIdeCommands(this.#commands, query, context, filter);
  }

  async execute(id: IdeCommandId, context: TContext): Promise<IdeCommandExecutionResult> {
    const command = this.get(id);
    if (!command) return { status: 'not-found', id };
    return executeIdeCommand(command, context);
  }
}

export function createIdeCommandRegistry<TContext>(
  commands: readonly IdeCommand<TContext>[]
): IdeCommandRegistry<TContext> {
  return new IdeCommandRegistry(commands);
}

function normalizeCommand<TContext>(command: IdeCommand<TContext>): IdeCommand<TContext> {
  if (!isIdeCommandId(command.id)) {
    throw new Error(`IDE command id must be a lower-case dotted namespace: ${command.id}`);
  }
  const title = command.title.trim();
  if (!title) throw new Error(`IDE command "${command.id}" must provide a title.`);

  const keywords = Object.freeze(
    [...new Set(command.keywords.map((keyword) => keyword.trim()).filter(Boolean))]
  );
  const shortcut = command.shortcut
    ? Object.freeze({
        ...command.shortcut,
        key: command.shortcut.key.trim(),
        label: command.shortcut.label.trim(),
        modifiers: command.shortcut.modifiers
          ? Object.freeze([...command.shortcut.modifiers])
          : undefined,
      })
    : undefined;

  if (shortcut && (!shortcut.key || !shortcut.label)) {
    throw new Error(`IDE command "${command.id}" has an incomplete shortcut.`);
  }

  return Object.freeze({ ...command, title, keywords, shortcut });
}

function isIdeCommandId(value: string): value is IdeCommandId {
  return /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(value);
}

function scoreCommand<TContext>(
  command: IdeCommand<TContext>,
  normalizedQuery: string
): number | null {
  const title = normalizeSearchText(command.title);
  const id = normalizeSearchText(command.id.replaceAll('.', ' '));
  const category = normalizeSearchText(command.category);
  const keywords = command.keywords.map(normalizeSearchText);
  const shortcut = command.shortcut ? normalizeSearchText(command.shortcut.label) : '';

  if (title === normalizedQuery) return 1_000;
  if (title.startsWith(normalizedQuery)) return 900 - Math.min(title.length, 100);
  if (title.includes(normalizedQuery)) return 800 - title.indexOf(normalizedQuery);

  let total = 0;
  for (const token of normalizedQuery.split(' ')) {
    const tokenScores = [
      scoreField(title, token, 180),
      ...keywords.map((keyword) => scoreField(keyword, token, 150)),
      scoreField(id, token, 110),
      scoreField(category, token, 90),
      scoreField(shortcut, token, 70),
    ];
    const best = Math.max(...tokenScores);
    if (best <= 0) return null;
    total += best;
  }
  return total;
}

function scoreField(field: string, token: string, weight: number): number {
  if (!field) return 0;
  if (field === token) return weight + 30;
  if (field.startsWith(token)) return weight + 20;
  const containedAt = field.indexOf(token);
  if (containedAt >= 0) return weight + 10 - Math.min(containedAt, 9);

  const fuzzyPenalty = fuzzySubsequencePenalty(field, token);
  return fuzzyPenalty === null ? 0 : Math.max(1, weight - 40 - fuzzyPenalty);
}

function fuzzySubsequencePenalty(field: string, token: string): number | null {
  let fieldIndex = 0;
  let firstMatch = -1;
  let lastMatch = -1;
  for (const character of token) {
    const match = field.indexOf(character, fieldIndex);
    if (match < 0) return null;
    if (firstMatch < 0) firstMatch = match;
    lastMatch = match;
    fieldIndex = match + 1;
  }
  return firstMatch + Math.max(0, lastMatch - firstMatch - token.length + 1);
}

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function compareCommandMatches<TContext>(
  left: IdeCommandSearchMatch<TContext>,
  right: IdeCommandSearchMatch<TContext>
): number {
  if (left.score !== right.score) return right.score - left.score;
  const titleOrder = compareText(left.command.title, right.command.title);
  return titleOrder || compareText(left.command.id, right.command.id);
}

function compareText(left: string, right: string): number {
  const normalizedLeft = left.toLocaleLowerCase('en-US');
  const normalizedRight = right.toLocaleLowerCase('en-US');
  return normalizedLeft < normalizedRight ? -1 : normalizedLeft > normalizedRight ? 1 : 0;
}
