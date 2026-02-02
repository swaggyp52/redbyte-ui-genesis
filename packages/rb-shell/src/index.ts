// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

export { Shell } from './Shell';
export type { ShellProps } from './Shell';
export { ErrorBoundary } from './ErrorBoundary';
export { WindowShell } from './WindowShell';
export type { WindowShellProps } from './WindowShell';
export { useModalManager, useCloseModalOnEscape } from './modalManager';
export type { ModalId } from './modalManager';
export { useToastStore } from './toastStore';
export type { Toast, ToastState } from './toastStore';
export type { Intent, OpenWithIntent, OpenExampleIntent } from './intent-types';
export { VERSION, GIT_SHA, BUILD_DATE, getVersionString, getFullVersionString } from './version';
export { trigger as triggerNarrative, type NarrativeEventId } from './narrative';
export {
  usePersistenceStore,
  scheduleAutosave,
  unregisterAutosave,
  registerSnapshot,
  writeJournal,
  promoteJournal,
  clearJournal,
  checkForRecovery,
  acceptRecovery,
  discardRecovery,
  type SaveStatus,
  type RecoverableEntry,
} from './persistenceStore';
export { RecoveryPrompt, type RecoveryAction } from './RecoveryPrompt';
export {
  registerWindowCleanup,
  runWindowCleanup,
  trackWindowOpen,
  getLeakGuardStats,
  startLeakMonitor,
} from './leakGuard';
export {
  TOPBAR_HEIGHT,
  DOCK_WIDTH,
  TRUTHBAR_HEIGHT,
  SAFE_MARGIN,
  MIN_VISIBLE_TITLEBAR,
  MIN_VISIBLE_SIDE,
  getDesktopBounds,
  getMaximizedBounds,
  clampWindowBounds,
} from './layout/layout-constants';
