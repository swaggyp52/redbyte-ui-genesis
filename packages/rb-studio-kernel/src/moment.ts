import { createStore, type Store } from './store';
import { sameRef, type ObjectRef, type Scope } from './objectRef';

/**
 * The Moment: the single shared coordinate every perspective observes.
 *
 *   null                         editing; no value is lit anywhere
 *   { source: 'live' }           Design exploration of the current circuit; not recorded
 *   { source: 'recording', ... } one immutable recording at one vector tick, either the
 *                                published sample or one actual engine evaluation
 *
 * Live and recorded are attributes of the cursor, not modes of the application. The kernel
 * holds coordinates, never facts: values are always read from the recording or the live
 * simulation that owns them.
 */
export type Moment =
  | null
  | { readonly source: 'live'; readonly seq: number }
  | {
      readonly source: 'recording';
      readonly runId: string;
      readonly tick: number;
      readonly view: 'published' | 'event';
      /** Global evaluation order within the recording when view is 'event'. */
      readonly eventOrder: number | null;
    };

export type RecordingMoment = Extract<Moment, { source: 'recording' }>;

export type LensId = 'time' | 'logic' | 'source' | 'board';

export interface Anchor {
  readonly nodeId: string;
  readonly port: string;
}

export interface MomentState {
  readonly projectId: string;
  readonly selection: ObjectRef | null;
  /** Where the inspection began; selecting inside the cone keeps it. */
  readonly anchor: Anchor | null;
  readonly hover: ObjectRef | null;
  readonly cursor: Moment;
  readonly scope: Scope;
  readonly focusedLens: LensId | null;
}

export interface MomentActions {
  select(ref: ObjectRef | null, options?: { anchor?: Anchor | null }): void;
  hover(ref: ObjectRef | null): void;
  setCursor(moment: Moment): void;
  /** Patch a recording cursor in place; ignored when the cursor is not a recording. */
  seek(patch: Partial<Omit<RecordingMoment, 'source'>>): void;
  focusLens(lens: LensId | null): void;
  reset(projectId: string): void;
}

export type MomentStore = Store<MomentState> & MomentActions;

export function initialMomentState(projectId: string): MomentState {
  return { projectId, selection: null, anchor: null, hover: null, cursor: null, scope: [], focusedLens: null };
}

export function createMomentStore(projectId: string): MomentStore {
  const store = createStore<MomentState>(initialMomentState(projectId));
  return {
    ...store,
    select(ref, options) {
      const state = store.getState();
      const anchor = options && 'anchor' in options ? options.anchor ?? null : ref ? state.anchor : null;
      if (sameRef(state.selection, ref) && anchor === state.anchor) return;
      store.setState({ selection: ref, anchor });
    },
    hover(ref) {
      if (sameRef(store.getState().hover, ref)) return;
      store.setState({ hover: ref });
    },
    setCursor(moment) {
      if (sameMoment(store.getState().cursor, moment)) return;
      store.setState({ cursor: moment });
    },
    seek(patch) {
      const cursor = store.getState().cursor;
      if (!cursor || cursor.source !== 'recording') return;
      const next: RecordingMoment = { ...cursor, ...patch };
      if (sameMoment(cursor, next)) return;
      store.setState({ cursor: next });
    },
    focusLens(lens) {
      store.setState({ focusedLens: lens });
    },
    reset(nextProjectId) {
      store.setState(initialMomentState(nextProjectId));
    },
  };
}

export function sameMoment(a: Moment, b: Moment): boolean {
  if (a === b) return true;
  if (!a || !b || a.source !== b.source) return false;
  if (a.source === 'live' && b.source === 'live') return a.seq === b.seq;
  if (a.source === 'recording' && b.source === 'recording') {
    return a.runId === b.runId && a.tick === b.tick && a.view === b.view && (a.eventOrder ?? null) === (b.eventOrder ?? null);
  }
  return false;
}

/** The next tick in a sorted tick list, clamped at the ends. Time is discrete; never interpolated. */
export function stepTick(ticks: readonly number[], current: number, delta: number): number {
  if (ticks.length === 0) return current;
  const exact = ticks.indexOf(current);
  let next: number;
  if (exact >= 0) {
    next = exact + delta;
  } else {
    // Between recorded ticks (or outside them): step from the insertion point, so the first
    // step lands on the nearest recorded tick in that direction.
    let insertion = ticks.findIndex((tick) => tick > current);
    if (insertion < 0) insertion = ticks.length;
    next = delta > 0 ? insertion + delta - 1 : insertion + delta;
  }
  return ticks[Math.min(ticks.length - 1, Math.max(0, next))];
}
