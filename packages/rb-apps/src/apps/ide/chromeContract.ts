// Every surface declares one of these.
// IdeWorkbenchShell consumes it to validate exit-path coverage.

export type ChromeSlotId =
  | 'command-bar'
  | 'status-row'
  | 'mode-banner'
  | 'workflow-ribbon';

export type DockVisibilityPolicy = 'always' | 'collapsed-default' | 'contextual' | 'hidden';

export interface ExitPath {
  /** The sub-mode this exit path covers (e.g. 'bringup', 'proof', 'live') */
  fromMode: string;
  /** Human-readable label for the exit action */
  label: string;
  /** testid of the exit trigger element */
  testId: string;
}

export interface IdeChromeContract {
  /** Which surface this contract belongs to */
  surfaceId: 'project' | 'design' | 'verify' | 'hardware' | 'export' | 'import';
  /** Top-strip chrome slots this surface uses */
  topStripSlots: readonly ChromeSlotId[];
  /** Left dock visibility policy */
  leftDockPolicy: DockVisibilityPolicy;
  /** Right dock visibility policy */
  rightDockPolicy: DockVisibilityPolicy;
  /**
   * Every interactive sub-mode must declare exactly one ExitPath.
   * Surfaces with no sub-modes (project, export, import) declare an empty array.
   * A contract test enforces this is never empty when sub-modes exist.
   */
  exitPaths: readonly ExitPath[];
}
