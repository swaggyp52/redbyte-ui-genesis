/**
 * @redbyte/rb-studio-kernel — coordination for the Meridian studio, written without React
 * (React binds only through ./react). Its value imports of @redbyte/rb-apps/domain still reach
 * the @redbyte/rb-utils barrel and the zustand stores it re-exports (RB-DEBT-027).
 *
 * The kernel holds coordinates, never facts: which object is selected and which moment is
 * shown. Facts stay with their owners (the project runtime, immutable recordings, the
 * emitters); the kernel resolves one coordinate into every perspective's terms.
 * React binds through `@redbyte/rb-studio-kernel/react`.
 */
export { createStore, type Listener, type Store } from './store';
export {
  fromEngineeringRef,
  fromJourneySelection,
  refNodeId,
  sameRef,
  toEngineeringRef,
  toJourneySelection,
  type JourneyCoordinates,
  type ObjectRef,
  type Scope,
} from './objectRef';
export {
  createMomentStore,
  initialMomentState,
  sameMoment,
  stepTick,
  type Anchor,
  type LensId,
  type Moment,
  type MomentActions,
  type MomentState,
  type MomentStore,
  type RecordingMoment,
} from './moment';
export {
  defaultZeroReads,
  eventAt,
  indexRecording,
  paintVerdict,
  recordingRunId,
  stepEvent,
  valuesAt,
  type LogicValue,
  type PaintVerdict,
  type PaintVerdictInput,
  type RecordingIndex,
} from './recordingView';
export {
  createResolver,
  primaryPin,
  unconnectedInputPins,
  type BoardBinding,
  type Resolution,
  type Resolver,
  type ResolverContext,
  type SourceSpan,
} from './resolver';
export { deriveTruthTable, type DerivedTable, type DerivedTableLeaf, type DerivedTableResult } from './nextState';
export { clockDrivingInputs } from './explore';
export {
  FALL_AT,
  RISE_AT,
  SAMPLE_AT,
  buildTimeline,
  coverageLimit,
  eventPinValue,
  findCause,
  isCapture,
  laneTicks,
  laneValueAt,
  logicValue,
  pendingCaptures,
  placeMoment,
  placeOrder,
  levelBeforePhase,
  roseByTheSample,
  roseInPhase,
  captureFacts,
  type CaptureFacts,
  type Cause,
  type EventPlace,
  type LaneSegment,
  type LaneTick,
  type PhaseKind,
  type TickPhase,
  type TickTime,
  type Timeline,
  type TimelineCoverage,
} from './timeline';
export { explainSelection, partKind, type Explanation, type ExplanationLine, type ExplainInput, type SymbolRole } from './explain';
