// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
export { Shell } from './Shell';
export { ErrorBoundary } from './ErrorBoundary';
export { WindowShell } from './WindowShell';
export { useModalManager, useCloseModalOnEscape } from './modalManager';
export { useToastStore } from './toastStore';
export { VERSION, GIT_SHA, BUILD_DATE, getVersionString, getFullVersionString } from './version';
export { trigger as triggerNarrative } from './narrative';
export { usePersistenceStore, scheduleAutosave, unregisterAutosave, registerSnapshot, writeJournal, promoteJournal, clearJournal, checkForRecovery, acceptRecovery, discardRecovery, } from './persistenceStore';
export { RecoveryPrompt } from './RecoveryPrompt';
export { registerWindowCleanup, runWindowCleanup, trackWindowOpen, getLeakGuardStats, startLeakMonitor, } from './leakGuard';
export { TOPBAR_HEIGHT, DOCK_WIDTH, TRUTHBAR_HEIGHT, SAFE_MARGIN, MIN_VISIBLE_TITLEBAR, MIN_VISIBLE_SIDE, getDesktopBounds, getMaximizedBounds, clampWindowBounds, } from './layout/layout-constants';
