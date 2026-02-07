// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

export * from './types';
export * from './AppRegistry';
export * from './stores/capabilitiesStore';
export * from './stores/classroomModeStore';
export * from './stores/filesStore';
export * from './stores/fileAssociationsStore';
export * from './stores/fileSystemStore';
export * from './stores/systemLogStore';
export * from './apps/files/fileActionTargets';
export * from './apps/files/modals';
export * from './examples';
export * from './components/EmptyState';
export * from './components/IntegrityBadge';
export { stableSerialize, stableHash, hashBytes } from './utils/stableSerialize';
export { loadSnapshot, wasLastShutdownClean, clearAllSnapshots } from './utils/snapshotSystem';
export { useRenderStormDetector } from './hooks/useRenderStormDetector';
export {
  hashBytesOffThread,
  stableHashOffThread,
  stableSerializeOffThread,
  terminateComputeWorker,
} from './utils/computeWorker';
export {
  installErrorHandlers,
  reportError,
  reportPerfViolation,
  addBreadcrumb,
  getBreadcrumbs,
  setReportSink,
  setPerfSampleRate,
  type ErrorReport,
  type Breadcrumb,
  type ReportSink,
} from './utils/errorReporting';
export {
  buildEvidenceManifest,
  verifyEvidenceManifest,
  serializeManifest,
  type EvidenceManifest,
  type EvidenceFileEntry,
  type IntegrityStatus,
  type IntegrityResult,
} from './utils/evidenceManifest';

// DEFERRED EXPORTS: Do NOT import app modules at the module level.
// This prevents circular dependencies and temporal dead zone errors
// when heavy modules like Three.js are imported.
// 
// Instead of:
//   export { LogicPlaygroundApp } from './apps/LogicPlaygroundApp';
// 
// Apps will be registered dynamically via registerAllApps()

// DEFERRED: Auto-registration moved to a separate function to avoid circular deps + TDZ errors
// when Three.js or other heavy modules are imported at the module level.
// Call registerAllApps() explicitly when the app is ready to initialize apps.

export type RegisterAllAppsMode = 'full' | 'e2e-lite' | 'e2e-boot';

export async function registerAllApps(options?: { mode?: RegisterAllAppsMode }) {
  const mode: RegisterAllAppsMode = options?.mode ?? 'full';
  // Dynamic imports: only load app modules when explicitly requested
  const { registerApp } = await import('./AppRegistry');

  // E2E-boot: minimal boot smoke (Shell mounts; no heavy apps).
  if (mode === 'e2e-boot') {
    const { LauncherApp } = await import('./apps/LauncherApp');
    const { SettingsApp } = await import('./apps/SettingsApp');
    registerApp(LauncherApp);
    registerApp(SettingsApp);
    return;
  }

  // E2E-lite: keep startup lean and avoid importing 3D-heavy modules that can
  // crash headless Chromium or slow boot-time smoke tests.
  if (mode === 'e2e-lite') {
    const { HomeApp } = await import('./apps/HomeApp');
    const { SettingsApp } = await import('./apps/SettingsApp');
    const { FilesApp } = await import('./apps/FilesApp');
    const { LogicPlaygroundApp } = await import('./apps/LogicPlaygroundApp');
    const { LauncherApp } = await import('./apps/LauncherApp');

    registerApp(HomeApp);
    registerApp(SettingsApp);
    registerApp(FilesApp);
    registerApp(LogicPlaygroundApp);
    registerApp(LauncherApp);
    return;
  }

  // ── Core apps (always registered) ──────────────────────────────────
  const { HomeApp } = await import('./apps/HomeApp');
  const { TerminalApp } = await import('./apps/TerminalApp');
  const { SettingsApp } = await import('./apps/SettingsApp');
  const { FilesApp } = await import('./apps/FilesApp');
  const { LogicPlaygroundApp } = await import('./apps/LogicPlaygroundApp');
  const { LauncherApp } = await import('./apps/LauncherApp');
  const { TextViewerApp } = await import('./apps/TextViewerApp');
  const { SystemLogApp } = await import('./apps/SystemLogApp');

  // ── Labs (browser + workspace) ───────────────────────────────────
  const { LabsApp } = await import('./apps/LabsApp');
  const { ECELabApp } = await import('./apps/ECELabManifest');

  // ── Instructor (unified portal with inline run detail) ────────────
  const { InstructorApp } = await import('./apps/InstructorApp');
  const { SubmissionInspectorApp } = await import('./apps/SubmissionInspectorApp');

  // ── Register: core ────────────────────────────────────────────────
  registerApp(HomeApp);
  registerApp(LauncherApp);
  registerApp(SettingsApp);
  registerApp(FilesApp);
  registerApp(TerminalApp);
  registerApp(TextViewerApp);
  registerApp(LogicPlaygroundApp);
  registerApp(SystemLogApp);

  // ── Register: labs ────────────────────────────────────────────────
  registerApp(LabsApp);
  registerApp(ECELabApp);

  // ── Register: instructor ──────────────────────────────────────────
  registerApp(InstructorApp);
  registerApp(SubmissionInspectorApp);

  // ── REMOVED (consolidated into the apps above) ────────────────────
  // WelcomeApp → replaced by HomeApp
  // StartHereApp → replaced by HomeApp
  // AppStoreApp → removed (no marketplace for v1)
  // StatusPanelApp → will move into Settings > Advanced
  // VirtualLabApp → absorbed into ECELabApp
  // LabWorkspaceApp → absorbed into ECELabApp
  // HelpAppManifest → redundant with LogicHelpApp
  // StudentLabApp → deprecated, replaced by ECELabApp
  // InstructorRunDetailApp → inline view inside InstructorApp
  // LabExaminerAppRegistry → niche tool, accessible via terminal
  // FpgaProofViewerApp → niche tool, accessible via terminal
  // HardwarePanelApp → deregistered; IO tab in Playground covers basics
  // LogicHelpApp → demoted to Learn > Help subview inside Playground RightDock
  // UserManualApp → demoted to Learn > Manual subview inside Playground RightDock
}

export { PlaygroundGoldenPath } from './dev/PlaygroundGoldenPath';

// ── Knowledge graph ──────────────────────────────────────────────────
export {
  searchKnowledge,
  getNodeById,
  getNodesByGateType,
  getNodesByExampleId,
  getNodesByLabId,
  getNodesByErrorCode,
  getNodesByTag,
  getNodesByHelpTopicId,
  type KnowledgeNode,
} from './knowledge/knowledgeNodes';
