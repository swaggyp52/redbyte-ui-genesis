/**
 * The studio keymap. It extends the keys the workbench already ships rather than redefining
 * them: digits switch stages, F fits, arrows step ticks, Ctrl+Z/Ctrl+Shift+Z undo/redo, Delete
 * deletes, Esc backs out. Alt+arrows are never used (browser Back/Forward on Windows/Linux).
 * `__tests__/keymap.pure.test.ts` checks every studio key against the shipped shortcut list.
 */
export interface KeyBinding {
  readonly keys: string;
  readonly action: string;
  readonly scope: 'global' | 'design' | 'time' | 'sheet';
  /** Same key, same meaning as the shipped workbench. */
  readonly extendsShipped?: boolean;
}

export const STUDIO_KEYMAP: readonly KeyBinding[] = [
  { keys: '2', action: 'Design', scope: 'global', extendsShipped: true },
  { keys: '3', action: 'Simulate', scope: 'global', extendsShipped: true },
  { keys: '4', action: 'Board', scope: 'global', extendsShipped: true },
  { keys: 'Ctrl+Enter', action: 'Run the active scenario (creates a recording)', scope: 'global' },
  { keys: 'Esc', action: 'Back out one step: a pending wire, then a running Run, the keys overlay, a step inside a tick (Back), focus, the selection', scope: 'global', extendsShipped: true },
  { keys: 'Ctrl+Z', action: 'Undo', scope: 'global', extendsShipped: true },
  { keys: 'Ctrl+Shift+Z', action: 'Redo', scope: 'global', extendsShipped: true },
  { keys: 'T', action: 'Time lens', scope: 'global' },
  { keys: 'L', action: 'Logic lens', scope: 'global' },
  { keys: 'H', action: 'Source (HDL) lens', scope: 'global' },
  { keys: 'B', action: 'Board lens', scope: 'global' },
  { keys: 'I', action: 'Inspector', scope: 'global' },
  { keys: '?', action: 'Keyboard shortcuts', scope: 'global', extendsShipped: true },
  { keys: 'E', action: 'Explore / Edit (Design)', scope: 'design' },
  { keys: '.', action: 'Apply one clock edge while exploring', scope: 'design' },
  { keys: 'Delete / Backspace', action: 'Delete the selected wire', scope: 'design', extendsShipped: true },
  { keys: 'F', action: 'Fit the focused pane (the selection when one exists)', scope: 'sheet', extendsShipped: true },
  { keys: '← / →', action: 'Previous / next tick', scope: 'time', extendsShipped: true },
  { keys: '[ / ]', action: 'Step inside a tick (previous / next recorded evaluation)', scope: 'time' },
  { keys: 'Home / End', action: 'First / last tick', scope: 'time' },
];

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}
