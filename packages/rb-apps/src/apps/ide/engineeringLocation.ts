import { create } from 'zustand';
import type { IdeMode } from './workflowStages';
import { TOP_MODULE_ID } from './projectHierarchy';

/**
 * Engineering location + history — the workbench's Back / Forward / Up.
 *
 * This is pure UI navigation state (a read-model over where the engineer is
 * standing), NOT a second authority for mode or the active module: those stay
 * owned by IdeApp's `currentMode` and the project store's
 * `hierarchy.activeModuleId`. The shell records each place the engineer visits
 * and, on Back/Forward/Up, hands the target location back for the owners to
 * apply. Keeping the stack here means navigation survives surface remounts and
 * is unit-testable without rendering the whole IDE.
 */

export interface EngineeringLocation {
  mode: IdeMode;
  /** Active module id within Design; TOP for every non-Design location. */
  moduleId: string;
}

/** Max remembered steps in each direction — bounded so history never grows unboundedly. */
export const MAX_LOCATION_HISTORY = 50;

export function sameLocation(a: EngineeringLocation, b: EngineeringLocation): boolean {
  return a.mode === b.mode && a.moduleId === b.moduleId;
}

export function normalizeLocation(location: EngineeringLocation): EngineeringLocation {
  // Module identity only matters inside Design; everywhere else it is TOP so
  // that leaving and re-entering Design does not fragment the history.
  return location.mode === 'design'
    ? { mode: 'design', moduleId: location.moduleId || TOP_MODULE_ID }
    : { mode: location.mode, moduleId: TOP_MODULE_ID };
}

interface EngineeringLocationState {
  past: EngineeringLocation[];
  present: EngineeringLocation;
  future: EngineeringLocation[];
  /**
   * Record a freshly-entered location. A no-op when it equals the present
   * (so idempotent re-records do not pollute history); clears the redo stack.
   */
  visit: (location: EngineeringLocation) => void;
  /** Step back; returns the location to apply, or null when at the start. */
  back: () => EngineeringLocation | null;
  /** Step forward; returns the location to apply, or null when at the end. */
  forward: () => EngineeringLocation | null;
  /** Re-seed the whole stack to a single location (project load / reset). */
  reset: (location: EngineeringLocation) => void;
}

const INITIAL: EngineeringLocation = { mode: 'project', moduleId: TOP_MODULE_ID };

export const useEngineeringLocation = create<EngineeringLocationState>((set, get) => ({
  past: [],
  present: INITIAL,
  future: [],
  visit: (rawLocation) => {
    const location = normalizeLocation(rawLocation);
    const { present, past } = get();
    if (sameLocation(present, location)) return;
    const nextPast = [...past, present].slice(-MAX_LOCATION_HISTORY);
    set({ past: nextPast, present: location, future: [] });
  },
  back: () => {
    const { past, present, future } = get();
    if (past.length === 0) return null;
    const previous = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      present: previous,
      future: [present, ...future].slice(0, MAX_LOCATION_HISTORY),
    });
    return previous;
  },
  forward: () => {
    const { past, present, future } = get();
    if (future.length === 0) return null;
    const next = future[0];
    set({
      past: [...past, present].slice(-MAX_LOCATION_HISTORY),
      present: next,
      future: future.slice(1),
    });
    return next;
  },
  reset: (rawLocation) => {
    set({ past: [], present: normalizeLocation(rawLocation), future: [] });
  },
}));
