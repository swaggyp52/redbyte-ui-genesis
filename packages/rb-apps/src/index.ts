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
export * from './ui/tokens';
export * from './ui/components/index';
export { stableSerialize, stableHash, hashBytes } from './utils/stableSerialize';
export { loadSnapshot, wasLastShutdownClean, clearAllSnapshots } from './utils/snapshotSystem';
export { useRenderStormDetector } from './hooks/useRenderStormDetector';
export { createRBProject, decodeRBProject, encodeRBProject, type RBProject } from './export/projectFormat';
export { labProjectToRBProject, rbProjectToLabProject } from './utils/labProjectRbprojAdapter';
export {
  clearProjectAutosaveByProjectId,
  getCanonicalProjectAutosaveKey,
  loadRbprojAutosave,
  loadRecentProjects,
  type RecentProjectEntryV1,
} from './utils/rbprojAutosave';
export {
  decodeInstructorProjectArchive,
} from './starterKits/instructorPack';
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
export * from './apps/firstRun/firstRunState';
export * from './fpga/doctorReportV2';
export * from './fpga/hardwareErrorTaxonomy';
export * from './studentAppGate';

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

// Helper: safe per-app import/registration - log and continue if one fails
async function safeRegister(name: string, fn: () => Promise<any>) {
  try {
    await fn();
    console.log('RB_APP_OK', name);
  } catch (e) {
    console.error('RB_APP_FAIL', name, e);
  }
}

export async function registerAllApps(options?: { mode?: RegisterAllAppsMode }) {
  const mode: RegisterAllAppsMode = options?.mode ?? 'full';
  // Dynamic imports: only load app modules when explicitly requested
  const { registerApp } = await import('./AppRegistry');

  // E2E-boot: minimal boot smoke (Shell mounts; no heavy apps).
  if (mode === 'e2e-boot') {
    await safeRegister('home', async () => {
      const { HomeApp } = await import('./apps/HomeApp');
      registerApp(HomeApp);
    });
    await safeRegister('first-run-wizard', async () => {
      const { FirstRunWizardApp } = await import('./apps/FirstRunWizardApp');
      registerApp(FirstRunWizardApp);
    });
    await safeRegister('lab-workspace', async () => {
      const { LabWorkspaceApp } = await import('./apps/LabWorkspaceApp');
      registerApp(LabWorkspaceApp);
    });
    await safeRegister('launcher', async () => {
      const { LauncherApp } = await import('./apps/LauncherApp');
      registerApp(LauncherApp);
    });
    await safeRegister('settings', async () => {
      const { SettingsApp } = await import('./apps/SettingsApp');
      registerApp(SettingsApp);
    });
    await safeRegister('submission-inspector', async () => {
      const { SubmissionInspectorApp } = await import('./apps/SubmissionInspectorApp');
      registerApp(SubmissionInspectorApp);
    });
    return;
  }

  // E2E-lite: keep startup lean and avoid importing 3D-heavy modules that can
  // crash headless Chromium or slow boot-time smoke tests.
  if (mode === 'e2e-lite') {
    await safeRegister('home', async () => {
      const { HomeApp } = await import('./apps/HomeApp');
      registerApp(HomeApp);
    });
    await safeRegister('settings', async () => {
      const { SettingsApp } = await import('./apps/SettingsApp');
      registerApp(SettingsApp);
    });
    await safeRegister('files', async () => {
      const { FilesApp } = await import('./apps/FilesApp');
      registerApp(FilesApp);
    });
    await safeRegister('toolchain-setup', async () => {
      const { ToolchainSetupApp } = await import('./apps/ToolchainSetupApp');
      registerApp(ToolchainSetupApp);
    });
    await safeRegister('logic-playground', async () => {
      const { LogicPlaygroundApp } = await import('./apps/LogicPlaygroundApp');
      registerApp(LogicPlaygroundApp);
    });
    await safeRegister('lab-workspace', async () => {
      const { LabWorkspaceApp } = await import('./apps/LabWorkspaceApp');
      registerApp(LabWorkspaceApp);
    });
    await safeRegister('first-run-wizard', async () => {
      const { FirstRunWizardApp } = await import('./apps/FirstRunWizardApp');
      registerApp(FirstRunWizardApp);
    });
    await safeRegister('launcher', async () => {
      const { LauncherApp } = await import('./apps/LauncherApp');
      registerApp(LauncherApp);
    });
    return;
  }

  // ── Core apps (always registered) - order matters: essential OS apps first ──────
  await safeRegister('home', async () => {
    const { HomeApp } = await import('./apps/HomeApp');
    registerApp(HomeApp);
  });
  await safeRegister('first-run-wizard', async () => {
    const { FirstRunWizardApp } = await import('./apps/FirstRunWizardApp');
    registerApp(FirstRunWizardApp);
  });
  await safeRegister('launcher', async () => {
    const { LauncherApp } = await import('./apps/LauncherApp');
    registerApp(LauncherApp);
  });
  await safeRegister('settings', async () => {
    const { SettingsApp } = await import('./apps/SettingsApp');
    registerApp(SettingsApp);
  });
  await safeRegister('files', async () => {
    const { FilesApp } = await import('./apps/FilesApp');
    registerApp(FilesApp);
  });
  await safeRegister('toolchain-setup', async () => {
    const { ToolchainSetupApp } = await import('./apps/ToolchainSetupApp');
    registerApp(ToolchainSetupApp);
  });
  await safeRegister('terminal', async () => {
    const { TerminalApp } = await import('./apps/TerminalApp');
    registerApp(TerminalApp);
  });
  await safeRegister('text-viewer', async () => {
    const { TextViewerApp } = await import('./apps/TextViewerApp');
    registerApp(TextViewerApp);
  });
  await safeRegister('system-log', async () => {
    const { SystemLogApp } = await import('./apps/SystemLogApp');
    registerApp(SystemLogApp);
  });

  // ── Studio ──────────────────────────────────────────────────────
  await safeRegister('lab-workspace', async () => {
    const { LabWorkspaceApp } = await import('./apps/LabWorkspaceApp');
    registerApp(LabWorkspaceApp);
  });

  // ── Instructor ──────────────────────────────────────────────────
  await safeRegister('instructor', async () => {
    const { InstructorApp } = await import('./apps/InstructorApp');
    registerApp(InstructorApp);
  });
  await safeRegister('submission-inspector', async () => {
    const { SubmissionInspectorApp } = await import('./apps/SubmissionInspectorApp');
    registerApp(SubmissionInspectorApp);
  });

  // ── Heavy apps LAST (3D/Three.js) so core OS is usable even if they fail ──
  await safeRegister('logic-playground', async () => {
    const { LogicPlaygroundApp } = await import('./apps/LogicPlaygroundApp');
    registerApp(LogicPlaygroundApp);
  });

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
