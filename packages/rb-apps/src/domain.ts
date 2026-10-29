/**
 * @redbyte/rb-apps/domain — the workbench domain without React components or stylesheets.
 *
 * No React components, no zustand React bindings and no stylesheets inside rb-apps. The studio
 * kernel, workers and node-environment tests import this entry instead of the package index
 * (which is the IdeApp and its global stylesheets). `domainBoundary.test.ts` walks this
 * module's static import graph inside rb-apps and rb-logic-view and fails on React, CSS or a
 * package index. Other @redbyte packages are treated as leaves: the `@redbyte/rb-utils` barrel
 * re-exports zustand stores and is reachable from here, so a strictly React-free import of this
 * entry (P2: Astro content islands) still needs that barrel split (tracked for P2).
 *
 * These are re-exports of existing modules; their behavior is unchanged.
 */

// Workbench mode and Meridian stage, both ways.
export { ideModeForMeridianStage, meridianPreviewSearch, meridianStageForIdeMode, type MeridianStage } from './apps/ide/startupMode';
// Recorded moment: values, source spans, structural derivation.
export {
  generateJourneySource,
  journeyCone,
  journeyEndpoint,
  journeyExpression,
  journeyInstanceKey,
  journeyLocalDrawing,
  journeyOverviewEndpoint,
  journeySignal,
  journeySourceSpans,
  journeyValues,
  selectJourney,
  type BooleanTerm,
  type JourneyGeneratedSource,
  type JourneySelection,
} from './apps/ide/signalJourney';
export {
  presentJourneyValue,
  presentSignalJourney,
  type JourneyPresentedPort,
  type JourneyPresentedValue,
  type SignalJourneyPresentation,
  type SignalJourneyPresentationInput,
} from './apps/ide/signalJourneyPresentation';
export {
  buildRecordedCircuitGeometry,
  createRecordedPortResolver,
  recordedGateReadout,
} from './apps/ide/surfaces/verify/recordedCircuitGeometry';

// Identity, currentness and elaboration.
export { BROWSER_ENGINE_VERSION, buildRunIdentity, type RunIdentity } from './apps/ide/runDeterminism';
export { deriveRunScope, type RunScope, type RunScopeKind, type RunScopeReason } from './apps/ide/runScope';
export { buildCurrentVerifyProjectHash, buildVerifyCircuitEvidenceHash } from './apps/ide/verifyProjectHash';
export { findVerifyRunLedgerEntry } from './apps/ide/runArchive';
export {
  elaborateProjectHierarchy,
  moduleInstanceOutputSources,
  type ElaboratedNodeSource,
  type ElaborationSources,
  type ProjectHierarchyDocument,
} from './apps/ide/projectHierarchy';
export { buildCurrentVerifyReplayHash } from './apps/ide/verifyReplayHash';
export { planStudioRun, type StudioBlockingResolver, type StudioRunPlan, type StudioRunState } from './apps/ide/studioRunInput';
export { getActiveScenario, type VerifyScenario } from './apps/ide/verifyScenario';

// Symbol metadata shared with Design, so every drawing uses the same pins.
export { getDesignChipMetadata } from './apps/ide/designChipMetadata';
export { getDesignChipMetadataForNode } from './apps/ide/registerFamilyChipMetadata';

// Board catalog.
export { BASYS3_BOARD_RESOURCES, type Basys3BoardResource } from './fpga/boards/basys3/basys3Pins';

// Types only (erased at runtime; their modules are not loaded through this entry).
export type { EngineeringObjectRef } from './apps/ide/engineeringSelection';
export type {
  ProjectIoRow,
  ProjectRuntimeState,
  RunVerificationInput,
  RuntimeVerifyRun,
  VerificationExecutionState,
  VerifyRunLedgerEntry,
} from './apps/ide/projectRuntime';
