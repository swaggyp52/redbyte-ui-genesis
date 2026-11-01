import type { Circuit, SimulationModel, EvaluationTraceCaptureOptions } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';
import type { VerifyScheduleContract } from '../../../fpga/boards/basys3/verifySchedule';
import { runDeterministicVerifyFromModel, type VerifyClockExecutionPolicy } from './simEngineCore';
import type { SimulationIoRow } from './simTypes';

/** Structured-clone request. The existing browser-v2 engine and schedule own every value. */
export interface VerificationComputeRequest {
  circuit: Circuit;
  model: SimulationModel;
  ioRows: SimulationIoRow[];
  vectors: TestVector[];
  schedule: VerifyScheduleContract;
  clockPolicy?: VerifyClockExecutionPolicy;
  capture?: EvaluationTraceCaptureOptions;
}

export function computeVerification(request: VerificationComputeRequest, onCaseComplete?: (completedCases: number) => void) {
  return request.vectors.length ? runDeterministicVerifyFromModel(request.circuit, request.model,
    request.ioRows, request.vectors, request.schedule, request.clockPolicy, request.capture, onCaseComplete) : null;
}
