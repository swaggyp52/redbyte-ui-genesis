// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

export * from './types';
export * from './AppRegistry';
export * from './stores/capabilitiesStore';
export * from './examples';
export * from './components/EmptyState';
export * from './components/IntegrityBadge';
export { ErrorBoundary } from './components/ErrorBoundary';
export * from './labs/labCatalog';
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
export * from './fpga/doctorReportV2';
export * from './fpga/hardwareErrorTaxonomy';
export { IdeApp } from './apps/IdeApp';

export type RegisterAllAppsMode = 'full' | 'e2e-lite' | 'e2e-boot';

// No-op: dead apps deleted — IDE only.
export async function registerAllApps(_options?: { mode?: RegisterAllAppsMode }) {
  // Dead apps deleted. This function is retained for API compatibility only.
}

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
