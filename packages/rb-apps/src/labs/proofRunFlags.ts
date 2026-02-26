import { toCircuitV1 } from '@redbyte/rb-logic-core';
import { verifyCheckpoint } from '@redbyte/rb-lab-engine';
import type { Checkpoint, LabProjectV1, LabSpecV1 } from '@redbyte/rb-utils';
import type { RBProject } from '../export/projectFormat';
import type { SubmissionValidationRecentRuns } from './submissionGates';

type ProofRunFlags = Pick<SubmissionValidationRecentRuns, 'sequenceProofRun' | 'fsmPathsRun'>;

const LAB7_SEQUENCE_CHECKPOINT_ID = 'counter-sequence-proof';
const LAB8_INVALID_CHECKPOINT_ID = 'fsm-invalid-path';
const LAB8_VALID_CHECKPOINT_ID = 'fsm-valid-path';

export async function deriveProofRunFlags(
  project: RBProject,
  labId: string | null | undefined,
): Promise<ProofRunFlags> {
  if (!labId || labId.trim().length === 0) return {};
  if (!project.labSpec || !Array.isArray(project.labSpec.checkpoints)) return {};

  const checkpoints = project.labSpec.checkpoints
    .filter(isCheckpointCandidate)
    .map((checkpoint) => checkpoint as Checkpoint);
  if (checkpoints.length === 0) return {};

  const verificationProject = toProofVerificationProject(project, labId, checkpoints);
  if (!verificationProject) return {};

  const checkpointById = new Map(checkpoints.map((checkpoint) => [checkpoint.id, checkpoint]));
  const proofFlags: ProofRunFlags = {};

  if (labId === 'lab-7') {
    const sequenceCheckpoint = checkpointById.get(LAB7_SEQUENCE_CHECKPOINT_ID);
    proofFlags.sequenceProofRun = sequenceCheckpoint
      ? await isCheckpointPassing(verificationProject, sequenceCheckpoint)
      : false;
  }

  if (labId === 'lab-8') {
    const invalidPathCheckpoint = checkpointById.get(LAB8_INVALID_CHECKPOINT_ID);
    const validPathCheckpoint = checkpointById.get(LAB8_VALID_CHECKPOINT_ID);
    if (!invalidPathCheckpoint || !validPathCheckpoint) {
      proofFlags.fsmPathsRun = false;
    } else {
      const invalidPass = await isCheckpointPassing(verificationProject, invalidPathCheckpoint);
      const validPass = await isCheckpointPassing(verificationProject, validPathCheckpoint);
      proofFlags.fsmPathsRun = invalidPass && validPass;
    }
  }

  return proofFlags;
}

function isCheckpointCandidate(value: unknown): value is Checkpoint {
  if (!value || typeof value !== 'object') return false;
  const checkpoint = value as { id?: unknown; type?: unknown };
  return typeof checkpoint.id === 'string' && typeof checkpoint.type === 'string';
}

async function isCheckpointPassing(project: LabProjectV1, checkpoint: Checkpoint): Promise<boolean> {
  try {
    const result = await verifyCheckpoint(project, checkpoint);
    return result.passed === true;
  } catch {
    return false;
  }
}

function toProofVerificationProject(
  project: RBProject,
  labId: string,
  checkpoints: Checkpoint[],
): LabProjectV1 | null {
  let circuitV1;
  try {
    circuitV1 = toCircuitV1(project.circuit);
  } catch {
    return null;
  }

  const now = project.updatedAt || project.createdAt || '2000-01-01T00:00:00.000Z';
  const sourceLabSpec: LabSpecV1 = project.labSpec!;

  return {
    schemaVersion: '1.0',
    projectId: project.meta?.projectId ?? `ide-${labId}`,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt || now,
    updatedAt: project.updatedAt || now,
    circuit: circuitV1,
    simulation: {
      tickRate: Number.isFinite(project.meta?.tickRate) ? Number(project.meta?.tickRate) : 10,
      currentTick: 0,
      probes: [],
    },
    ...(project.ioMapping ? { ioMapping: project.ioMapping } : {}),
    labSpec: {
      schemaVersion: sourceLabSpec.schemaVersion ?? '1.0',
      labId,
      title: sourceLabSpec.title ?? project.name,
      ...(sourceLabSpec.description ? { description: sourceLabSpec.description } : {}),
      objectives: (sourceLabSpec.objectives ?? []).filter((entry): entry is string => typeof entry === 'string'),
      checkpoints,
    },
    evidence: {
      actions: [],
      snapshots: [],
    },
  };
}

