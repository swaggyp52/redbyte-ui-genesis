// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import type { SplitScreenMode, ViewMode } from './viewStateStore';
import type { RightDockState, RightDockTab } from '../components/RightDock';
import type { HelpSectionId } from '../components/HelpDock';

export type PerspectiveId =
  | 'build'           // Circuit + RightDock
  | 'analyze'         // Circuit + Scope
  | 'explain'         // Circuit + Schematic
  | 'explore'         // Circuit + 3D
  | 'quad'            // All four views
  | 'circuit-only'    // Circuit only
  | 'schematic-only'  // Schematic only
  | 'scope-only'      // Oscilloscope only
  | '3d-only'         // 3D only
  // Legacy perspectives (kept for compatibility)
  | 'inspect'
  | 'debug'
  | 'schematic'
  | 'learn';

interface LayoutState {
  perspective: PerspectiveId;
  splitScreenMode: SplitScreenMode;
  activeViews: ViewMode[];
  splitRatio: number;
  rightDockState: RightDockState;
  rightDockTab: RightDockTab;
  showHelpDock: boolean;
  helpDockSection: HelpSectionId | null;
  schematicMiniEnabled: boolean;
}

interface LayoutActions {
  setPerspective: (perspective: PerspectiveId) => void;
  setRightDockState: (state: RightDockState) => void;
  setRightDockTab: (tab: RightDockTab) => void;
  setShowHelpDock: (visible: boolean) => void;
  setHelpDockSection: (section: HelpSectionId | null) => void;
  setSplitRatio: (ratio: number) => void;
  toggleSchematicMini: () => void;
  resetLayout: () => void;
}

type LayoutStore = LayoutState & LayoutActions;

const STORAGE_KEY = 'rb.playground.layout';

interface PersistedData {
  perspective: PerspectiveId;
  splitRatio?: number;
  schematicMiniEnabled?: boolean;
}

const DEFAULT_SPLIT_RATIO = 0.5;

const PERSPECTIVE_PRESETS: Record<
  PerspectiveId,
  Omit<LayoutState, 'perspective' | 'splitRatio' | 'schematicMiniEnabled' | 'helpDockSection'>
> = {
  // NEW PRESETS - Primary workflow layouts
  build: {
    splitScreenMode: 'single',
    activeViews: ['circuit'],
    rightDockState: 'expanded',
    rightDockTab: 'inspector',
    showHelpDock: false,
  },
  analyze: {
    splitScreenMode: 'horizontal',
    activeViews: ['circuit', 'oscilloscope'],
    rightDockState: 'peek',
    rightDockTab: 'probes',
    showHelpDock: false,
  },
  explain: {
    splitScreenMode: 'horizontal',
    activeViews: ['circuit', 'schematic'],
    rightDockState: 'peek',
    rightDockTab: 'inspector',
    showHelpDock: false,
  },
  explore: {
    splitScreenMode: 'horizontal',
    activeViews: ['circuit', '3d'],
    rightDockState: 'collapsed',
    rightDockTab: 'inspector',
    showHelpDock: false,
  },
  quad: {
    splitScreenMode: 'quad',
    activeViews: ['circuit', 'schematic', '3d', 'oscilloscope'],
    rightDockState: 'collapsed',
    rightDockTab: 'probes',
    showHelpDock: false,
  },
  // SINGLE-VIEW FOCUS - Fullscreen individual tools
  'circuit-only': {
    splitScreenMode: 'single',
    activeViews: ['circuit'],
    rightDockState: 'collapsed',
    rightDockTab: 'inspector',
    showHelpDock: false,
  },
  'schematic-only': {
    splitScreenMode: 'single',
    activeViews: ['schematic'],
    rightDockState: 'collapsed',
    rightDockTab: 'inspector',
    showHelpDock: false,
  },
  'scope-only': {
    splitScreenMode: 'single',
    activeViews: ['oscilloscope'],
    rightDockState: 'collapsed',
    rightDockTab: 'probes',
    showHelpDock: false,
  },
  '3d-only': {
    splitScreenMode: 'single',
    activeViews: ['3d'],
    rightDockState: 'collapsed',
    rightDockTab: 'inspector',
    showHelpDock: false,
  },
  // LEGACY PRESETS - Kept for backward compatibility
  inspect: {
    splitScreenMode: 'single',
    activeViews: ['circuit'],
    rightDockState: 'expanded',
    rightDockTab: 'inspector',
    showHelpDock: false,
  },
  debug: {
    splitScreenMode: 'horizontal',
    activeViews: ['circuit', 'oscilloscope'],
    rightDockState: 'collapsed',
    rightDockTab: 'probes',
    showHelpDock: false,
  },
  schematic: {
    splitScreenMode: 'vertical',
    activeViews: ['schematic', 'circuit'],
    rightDockState: 'peek',
    rightDockTab: 'inspector',
    showHelpDock: false,
  },
  learn: {
    splitScreenMode: 'single',
    activeViews: ['circuit'],
    rightDockState: 'collapsed',
    rightDockTab: 'learn',
    showHelpDock: true,
  },
};

function saveLayoutState(state: LayoutState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const data: PersistedData = {
      perspective: state.perspective,
      splitRatio: state.splitRatio,
      schematicMiniEnabled: state.schematicMiniEnabled,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    // Ignore persistence errors.
  }
}

export function loadLayoutState(): PersistedData | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedData;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.perspective || typeof parsed.perspective !== 'string') return null;
    if (!(parsed.perspective in PERSPECTIVE_PRESETS)) return null;
    return parsed;
  } catch (error) {
    return null;
  }
}

function resolveSchematicLayout(schematicMiniEnabled: boolean) {
  if (!schematicMiniEnabled) {
    return {
      splitScreenMode: 'single' as const,
      activeViews: ['schematic'] as ViewMode[],
    };
  }

  return {
    splitScreenMode: 'vertical' as const,
    activeViews: ['schematic', 'circuit'] as ViewMode[],
  };
}

function applyPreset(
  perspective: PerspectiveId,
  splitRatio: number,
  schematicMiniEnabled: boolean
): LayoutState {
  const preset = PERSPECTIVE_PRESETS[perspective];
  const schematicLayout =
    perspective === 'schematic' ? resolveSchematicLayout(schematicMiniEnabled) : null;

  return {
    perspective,
    splitRatio,
    schematicMiniEnabled,
    splitScreenMode: schematicLayout?.splitScreenMode ?? preset.splitScreenMode,
    activeViews: schematicLayout?.activeViews ?? preset.activeViews,
    rightDockState: preset.rightDockState,
    rightDockTab: preset.rightDockTab,
    showHelpDock: preset.showHelpDock,
    helpDockSection: null,
  };
}

function loadInitialState(): LayoutState {
  const persisted = loadLayoutState();
  const perspective = persisted?.perspective ?? 'build';
  const rawRatio =
    typeof persisted?.splitRatio === 'number' ? persisted!.splitRatio! : DEFAULT_SPLIT_RATIO;
  const splitRatio = Math.min(Math.max(rawRatio, 0.2), 0.8);
  const schematicMiniEnabled = persisted?.schematicMiniEnabled ?? true;
  return applyPreset(perspective, splitRatio, schematicMiniEnabled);
}

// Lazy-init singleton to prevent TDZ crash from circular imports
let _store: ReturnType<typeof createLayoutStore> | null = null;

function createLayoutStore() {
  return create<LayoutStore>((set, get) => ({
    ...loadInitialState(),

    setPerspective: (perspective) => {
      set((state) => {
        const next = applyPreset(perspective, state.splitRatio, state.schematicMiniEnabled);
        saveLayoutState(next);
        return next;
      });
    },

    setRightDockState: (state) => {
      set((current) => {
        const next = { ...current, rightDockState: state };
        saveLayoutState(next);
        return next;
      });
    },

    setRightDockTab: (tab) => {
      set((current) => ({ ...current, rightDockTab: tab }));
    },

    setShowHelpDock: (visible) => {
      set((current) => ({ ...current, showHelpDock: visible }));
    },

    setHelpDockSection: (section) => {
      set((current) => ({ ...current, helpDockSection: section }));
    },

    setSplitRatio: (ratio) => {
      const clamped = Math.min(Math.max(ratio, 0.2), 0.8);
      set((current) => {
        const next = { ...current, splitRatio: clamped };
        saveLayoutState(next);
        return next;
      });
    },

    toggleSchematicMini: () => {
      set((current) => {
        const nextMini = !current.schematicMiniEnabled;
        const next = applyPreset('schematic', current.splitRatio, nextMini);
        saveLayoutState(next);
        return next;
      });
    },

    resetLayout: () => {
      const next = applyPreset('build', DEFAULT_SPLIT_RATIO, true);
      saveLayoutState(next);
      set(next);
    },
  }));
}

export const useLayoutStore: ReturnType<typeof createLayoutStore> = ((...args: any[]) => {
  if (!_store) _store = createLayoutStore();
  return (_store as any)(...args);
}) as any;

(useLayoutStore as any).getState = () => {
  if (!_store) _store = createLayoutStore();
  return (_store as any).getState();
};

(useLayoutStore as any).setState = (...a: any[]) => {
  if (!_store) _store = createLayoutStore();
  return (_store as any).setState(...a);
};

(useLayoutStore as any).subscribe = (...a: any[]) => {
  if (!_store) _store = createLayoutStore();
  return (_store as any).subscribe(...a);
};
