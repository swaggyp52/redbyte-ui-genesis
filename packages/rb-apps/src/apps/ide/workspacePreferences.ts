import {
  DEFAULT_DESIGN_TOOLBAR_COMMAND_IDS,
  REQUIRED_DESIGN_TOOLBAR_COMMAND_IDS,
  type IdeCommandId,
} from './ideCommandRegistry';

/**
 * UI-only workbench preferences. Project, simulation, mapping, and package
 * authority must never be added to this envelope.
 */
export const WORKSPACE_PREFERENCES_STORAGE_KEY = 'rb.ide.workspace.preferences.v2';
export const WORKSPACE_PREFERENCES_VERSION = 1 as const;

export const WORKSPACE_SURFACE_IDS = [
  'project',
  'design',
  'verify',
  'hardware',
  'export',
  'import',
] as const;
export type WorkspaceSurfaceId = (typeof WORKSPACE_SURFACE_IDS)[number];

export const WORKSPACE_DOCK_IDS = ['left', 'right', 'bottom'] as const;
export type WorkspaceDockId = (typeof WORKSPACE_DOCK_IDS)[number];

export const WORKSPACE_PRESET_IDS = ['authoring', 'simulation', 'board', 'code'] as const;
export type WorkspacePresetId = (typeof WORKSPACE_PRESET_IDS)[number];

export type DesignWorkspaceView = 'canvas' | 'code' | 'split';
export type DesignCanvasAppearance = 'dark' | 'light' | 'system';
export type DesignCanvasDensity = 'comfortable' | 'compact';

export interface WorkspaceDockPreferences {
  readonly visible: boolean;
  readonly sizePx: number;
}

export interface WorkspaceSurfacePreferences {
  readonly docks: Readonly<Record<WorkspaceDockId, WorkspaceDockPreferences>>;
}

export interface DesignWorkspacePreferences {
  readonly view: DesignWorkspaceView;
  readonly toolbarCommandIds: readonly IdeCommandId[];
  readonly canvasAppearance: DesignCanvasAppearance;
  readonly canvasDensity: DesignCanvasDensity;
}

export interface WorkspacePreferencesV1 {
  readonly version: typeof WORKSPACE_PREFERENCES_VERSION;
  /** Null means a student manually changed at least one dock after applying a preset. */
  readonly activePresetId: WorkspacePresetId | null;
  readonly surfaces: Readonly<Record<WorkspaceSurfaceId, WorkspaceSurfacePreferences>>;
  readonly design: DesignWorkspacePreferences;
}

export interface WorkspacePresetDefinition {
  readonly id: WorkspacePresetId;
  readonly name: string;
  readonly description: string;
  /** Presets change presentation only; Design view and project semantics are preserved. */
  readonly surfaces: Readonly<Record<WorkspaceSurfaceId, WorkspaceSurfacePreferences>>;
}

export interface WorkspaceDockUpdate {
  readonly visible?: boolean;
  readonly sizePx?: number;
}

export type WorkspacePreferencesStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type WorkspacePreferencesListener = (preferences: WorkspacePreferencesV1) => void;

export const WORKSPACE_DOCK_SIZE_LIMITS: Readonly<
  Record<WorkspaceDockId, { readonly min: number; readonly max: number }>
> = Object.freeze({
  left: Object.freeze({ min: 180, max: 480 }),
  right: Object.freeze({ min: 220, max: 520 }),
  bottom: Object.freeze({ min: 140, max: 440 }),
});

const AUTHORING_SURFACES = createSurfacePreferences({
  project: {
    left: { visible: true, sizePx: 248 },
    right: { visible: true, sizePx: 288 },
  },
  design: {
    left: { visible: true, sizePx: 220 },
    right: { visible: true, sizePx: 280 },
  },
  verify: {
    left: { visible: true, sizePx: 240 },
    bottom: { visible: false, sizePx: 260 },
  },
  hardware: { right: { visible: true, sizePx: 300 } },
  export: { left: { visible: true, sizePx: 240 } },
  import: { right: { visible: true, sizePx: 300 } },
});

export const WORKSPACE_PRESETS: Readonly<Record<WorkspacePresetId, WorkspacePresetDefinition>> =
  deepFreeze({
    authoring: {
      id: 'authoring',
      name: 'Authoring',
      description: 'Keep project tools and Design authoring support close to the main work object.',
      surfaces: AUTHORING_SURFACES,
    },
    simulation: {
      id: 'simulation',
      name: 'Simulation',
      description: 'Give waveform, replay, and problems more room without changing simulation state.',
      surfaces: createSurfacePreferences({
        ...toOverrides(AUTHORING_SURFACES),
        design: {
          left: { visible: false, sizePx: 220 },
          right: { visible: true, sizePx: 280 },
          bottom: { visible: true, sizePx: 300 },
        },
        verify: {
          left: { visible: true, sizePx: 240 },
          right: { visible: false, sizePx: 300 },
          bottom: { visible: true, sizePx: 340 },
        },
      }),
    },
    board: {
      id: 'board',
      name: 'Board',
      description: 'Prioritize board resources, assignments, and constraint consequences.',
      surfaces: createSurfacePreferences({
        ...toOverrides(AUTHORING_SURFACES),
        design: {
          left: { visible: true, sizePx: 240 },
          right: { visible: true, sizePx: 320 },
          bottom: { visible: false, sizePx: 220 },
        },
        hardware: {
          left: { visible: true, sizePx: 280 },
          right: { visible: true, sizePx: 340 },
          bottom: { visible: false, sizePx: 220 },
        },
      }),
    },
    code: {
      id: 'code',
      name: 'Code',
      description: 'Return support-rail width to the source and generated-code workspace.',
      surfaces: createSurfacePreferences({
        ...toOverrides(AUTHORING_SURFACES),
        design: {
          left: { visible: false, sizePx: 220 },
          right: { visible: false, sizePx: 280 },
          bottom: { visible: true, sizePx: 220 },
        },
      }),
    },
  });

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferencesV1 = deepFreeze({
  version: WORKSPACE_PREFERENCES_VERSION,
  activePresetId: 'authoring',
  surfaces: cloneSurfacePreferences(WORKSPACE_PRESETS.authoring.surfaces),
  design: {
    view: 'canvas',
    toolbarCommandIds: [...DEFAULT_DESIGN_TOOLBAR_COMMAND_IDS],
    // Default to a light technical canvas so Design reads as one instrument
    // inside the light Studio shell rather than a separate dark application.
    canvasAppearance: 'light',
    canvasDensity: 'compact',
  },
});

export function parseWorkspacePreferences(raw: string | null | undefined): WorkspacePreferencesV1 {
  if (!raw) return createDefaultWorkspacePreferences();
  try {
    return normalizeWorkspacePreferences(JSON.parse(raw));
  } catch {
    return createDefaultWorkspacePreferences();
  }
}

export function normalizeWorkspacePreferences(value: unknown): WorkspacePreferencesV1 {
  const defaults = createDefaultWorkspacePreferences();
  if (!isRecord(value) || value.version !== WORKSPACE_PREFERENCES_VERSION) return defaults;

  const rawSurfaces = isRecord(value.surfaces) ? value.surfaces : {};
  const surfaces = {} as Record<WorkspaceSurfaceId, WorkspaceSurfacePreferences>;
  for (const surfaceId of WORKSPACE_SURFACE_IDS) {
    surfaces[surfaceId] = normalizeSurfacePreferences(
      rawSurfaces[surfaceId],
      defaults.surfaces[surfaceId]
    );
  }

  const rawDesign = isRecord(value.design) ? value.design : {};
  const activePresetId = isWorkspacePresetId(value.activePresetId)
    ? value.activePresetId
    : value.activePresetId === null
      ? null
      : defaults.activePresetId;

  return deepFreeze({
    version: WORKSPACE_PREFERENCES_VERSION,
    activePresetId,
    surfaces,
    design: {
      view: isDesignWorkspaceView(rawDesign.view) ? rawDesign.view : defaults.design.view,
      toolbarCommandIds: normalizeToolbarCommandIds(rawDesign.toolbarCommandIds),
      canvasAppearance: isDesignCanvasAppearance(rawDesign.canvasAppearance)
        ? rawDesign.canvasAppearance
        : defaults.design.canvasAppearance,
      canvasDensity: isDesignCanvasDensity(rawDesign.canvasDensity)
        ? rawDesign.canvasDensity
        : defaults.design.canvasDensity,
    },
  });
}

export function readWorkspacePreferences(
  storage: WorkspacePreferencesStorage | null | undefined
): WorkspacePreferencesV1 {
  if (!storage) return createDefaultWorkspacePreferences();
  try {
    return parseWorkspacePreferences(storage.getItem(WORKSPACE_PREFERENCES_STORAGE_KEY));
  } catch {
    return createDefaultWorkspacePreferences();
  }
}

export function writeWorkspacePreferences(
  storage: WorkspacePreferencesStorage | null | undefined,
  preferences: WorkspacePreferencesV1
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(
      WORKSPACE_PREFERENCES_STORAGE_KEY,
      JSON.stringify(normalizeWorkspacePreferences(preferences))
    );
    return true;
  } catch {
    // Private browsing, quota, or policy failures must not break the workbench.
    return false;
  }
}

export class WorkspacePreferencesStore {
  #preferences: WorkspacePreferencesV1;
  readonly #storage: WorkspacePreferencesStorage | null;
  readonly #listeners = new Set<WorkspacePreferencesListener>();

  constructor(storage: WorkspacePreferencesStorage | null = resolveBrowserStorage()) {
    this.#storage = storage;
    this.#preferences = readWorkspacePreferences(storage);
  }

  getSnapshot = (): WorkspacePreferencesV1 => this.#preferences;

  subscribe = (listener: WorkspacePreferencesListener): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  applyPreset(presetId: WorkspacePresetId): WorkspacePreferencesV1 {
    const preset = WORKSPACE_PRESETS[presetId];
    return this.#replace({
      ...this.#preferences,
      activePresetId: presetId,
      surfaces: cloneSurfacePreferences(preset.surfaces),
    });
  }

  setDock(
    surfaceId: WorkspaceSurfaceId,
    dockId: WorkspaceDockId,
    update: WorkspaceDockUpdate
  ): WorkspacePreferencesV1 {
    const currentDock = this.#preferences.surfaces[surfaceId].docks[dockId];
    const nextDock = normalizeDockPreferences(
      {
        visible: update.visible ?? currentDock.visible,
        sizePx: update.sizePx ?? currentDock.sizePx,
      },
      dockId,
      currentDock
    );

    return this.#replace({
      ...this.#preferences,
      activePresetId: null,
      surfaces: {
        ...this.#preferences.surfaces,
        [surfaceId]: {
          docks: {
            ...this.#preferences.surfaces[surfaceId].docks,
            [dockId]: nextDock,
          },
        },
      },
    });
  }

  setDesignView(view: DesignWorkspaceView): WorkspacePreferencesV1 {
    return this.#replace({
      ...this.#preferences,
      design: { ...this.#preferences.design, view },
    });
  }

  setDesignToolbarCommandIds(commandIds: readonly IdeCommandId[]): WorkspacePreferencesV1 {
    return this.#replace({
      ...this.#preferences,
      design: {
        ...this.#preferences.design,
        toolbarCommandIds: normalizeToolbarCommandIds(commandIds),
      },
    });
  }

  setDesignCanvasAppearance(canvasAppearance: DesignCanvasAppearance): WorkspacePreferencesV1 {
    return this.#replace({
      ...this.#preferences,
      design: { ...this.#preferences.design, canvasAppearance },
    });
  }

  setDesignCanvasDensity(canvasDensity: DesignCanvasDensity): WorkspacePreferencesV1 {
    return this.#replace({
      ...this.#preferences,
      design: { ...this.#preferences.design, canvasDensity },
    });
  }

  restoreDesignToolbarDefaults(): WorkspacePreferencesV1 {
    return this.setDesignToolbarCommandIds(DEFAULT_DESIGN_TOOLBAR_COMMAND_IDS);
  }

  reset(): WorkspacePreferencesV1 {
    return this.#replace(createDefaultWorkspacePreferences());
  }

  #replace(value: unknown): WorkspacePreferencesV1 {
    this.#preferences = normalizeWorkspacePreferences(value);
    writeWorkspacePreferences(this.#storage, this.#preferences);
    for (const listener of this.#listeners) listener(this.#preferences);
    return this.#preferences;
  }
}

export function createWorkspacePreferencesStore(
  storage: WorkspacePreferencesStorage | null = resolveBrowserStorage()
): WorkspacePreferencesStore {
  return new WorkspacePreferencesStore(storage);
}

/** Shared UI-only preference authority for the mounted IDE workbench. */
export const workspacePreferencesStore = createWorkspacePreferencesStore();

export function createDefaultWorkspacePreferences(): WorkspacePreferencesV1 {
  return deepFreeze({
    version: WORKSPACE_PREFERENCES_VERSION,
    activePresetId: DEFAULT_WORKSPACE_PREFERENCES.activePresetId,
    surfaces: cloneSurfacePreferences(DEFAULT_WORKSPACE_PREFERENCES.surfaces),
    design: {
      view: DEFAULT_WORKSPACE_PREFERENCES.design.view,
      toolbarCommandIds: [...DEFAULT_WORKSPACE_PREFERENCES.design.toolbarCommandIds],
      canvasAppearance: DEFAULT_WORKSPACE_PREFERENCES.design.canvasAppearance,
      canvasDensity: DEFAULT_WORKSPACE_PREFERENCES.design.canvasDensity,
    },
  });
}

function normalizeSurfacePreferences(
  value: unknown,
  fallback: WorkspaceSurfacePreferences
): WorkspaceSurfacePreferences {
  const rawDocks = isRecord(value) && isRecord(value.docks) ? value.docks : {};
  const docks = {} as Record<WorkspaceDockId, WorkspaceDockPreferences>;
  for (const dockId of WORKSPACE_DOCK_IDS) {
    docks[dockId] = normalizeDockPreferences(rawDocks[dockId], dockId, fallback.docks[dockId]);
  }
  return deepFreeze({ docks });
}

function normalizeDockPreferences(
  value: unknown,
  dockId: WorkspaceDockId,
  fallback: WorkspaceDockPreferences
): WorkspaceDockPreferences {
  const record = isRecord(value) ? value : {};
  const visible = typeof record.visible === 'boolean' ? record.visible : fallback.visible;
  const sizePx = typeof record.sizePx === 'number' && Number.isFinite(record.sizePx)
    ? clampDockSize(dockId, record.sizePx)
    : fallback.sizePx;
  return Object.freeze({ visible, sizePx });
}

function normalizeToolbarCommandIds(value: unknown): readonly IdeCommandId[] {
  if (!Array.isArray(value)) return Object.freeze([...DEFAULT_DESIGN_TOOLBAR_COMMAND_IDS]);

  const requested = [...new Set(value.filter(isIdeCommandId))];
  const required = REQUIRED_DESIGN_TOOLBAR_COMMAND_IDS.filter((id) => !requested.includes(id));
  const normalized = [...required, ...requested];
  return Object.freeze(
    normalized.length > 0 ? normalized : [...DEFAULT_DESIGN_TOOLBAR_COMMAND_IDS]
  );
}

function clampDockSize(dockId: WorkspaceDockId, sizePx: number): number {
  const limits = WORKSPACE_DOCK_SIZE_LIMITS[dockId];
  return Math.min(limits.max, Math.max(limits.min, Math.round(sizePx)));
}

function createSurfacePreferences(
  overrides: Partial<
    Record<WorkspaceSurfaceId, Partial<Record<WorkspaceDockId, WorkspaceDockPreferences>>>
  > = {}
): Readonly<Record<WorkspaceSurfaceId, WorkspaceSurfacePreferences>> {
  const surfaces = {} as Record<WorkspaceSurfaceId, WorkspaceSurfacePreferences>;
  for (const surfaceId of WORKSPACE_SURFACE_IDS) {
    const surfaceOverrides = overrides[surfaceId] ?? {};
    surfaces[surfaceId] = {
      docks: {
        left: surfaceOverrides.left ?? { visible: false, sizePx: 220 },
        right: surfaceOverrides.right ?? { visible: false, sizePx: 280 },
        bottom: surfaceOverrides.bottom ?? { visible: false, sizePx: 220 },
      },
    };
  }
  return deepFreeze(surfaces);
}

function cloneSurfacePreferences(
  surfaces: Readonly<Record<WorkspaceSurfaceId, WorkspaceSurfacePreferences>>
): Readonly<Record<WorkspaceSurfaceId, WorkspaceSurfacePreferences>> {
  const clone = {} as Record<WorkspaceSurfaceId, WorkspaceSurfacePreferences>;
  for (const surfaceId of WORKSPACE_SURFACE_IDS) {
    clone[surfaceId] = {
      docks: {
        left: { ...surfaces[surfaceId].docks.left },
        right: { ...surfaces[surfaceId].docks.right },
        bottom: { ...surfaces[surfaceId].docks.bottom },
      },
    };
  }
  return deepFreeze(clone);
}

function toOverrides(
  surfaces: Readonly<Record<WorkspaceSurfaceId, WorkspaceSurfacePreferences>>
): Record<WorkspaceSurfaceId, Record<WorkspaceDockId, WorkspaceDockPreferences>> {
  const overrides = {} as Record<
    WorkspaceSurfaceId,
    Record<WorkspaceDockId, WorkspaceDockPreferences>
  >;
  for (const surfaceId of WORKSPACE_SURFACE_IDS) {
    overrides[surfaceId] = {
      left: { ...surfaces[surfaceId].docks.left },
      right: { ...surfaces[surfaceId].docks.right },
      bottom: { ...surfaces[surfaceId].docks.bottom },
    };
  }
  return overrides;
}

function resolveBrowserStorage(): WorkspacePreferencesStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isWorkspacePresetId(value: unknown): value is WorkspacePresetId {
  return typeof value === 'string' && WORKSPACE_PRESET_IDS.includes(value as WorkspacePresetId);
}

function isDesignWorkspaceView(value: unknown): value is DesignWorkspaceView {
  return value === 'canvas' || value === 'code' || value === 'split';
}

function isDesignCanvasAppearance(value: unknown): value is DesignCanvasAppearance {
  return value === 'dark' || value === 'light' || value === 'system';
}

function isDesignCanvasDensity(value: unknown): value is DesignCanvasDensity {
  return value === 'comfortable' || value === 'compact';
}

function isIdeCommandId(value: unknown): value is IdeCommandId {
  return typeof value === 'string' && /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
