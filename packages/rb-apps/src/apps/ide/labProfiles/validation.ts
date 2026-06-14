import { IDE_EXAMPLES } from '../examplesCatalog';
import type {
  LabProfile,
  LabProfileStarterKind,
  LabProfileValidationIssue,
  LabProfileValidationResult,
  LabStarterSolutionEvidence,
} from './types';

const REQUIRED_EXPORT_ARTIFACTS = ['vhdl', 'xdc', 'testbench', 'vivadoTcl'] as const;
const KNOWN_STARTER_IDS = new Set(IDE_EXAMPLES.map((example) => example.id));

function issue(code: string, path: string, message: string): LabProfileValidationIssue {
  return { code, path, message };
}

function result(issues: LabProfileValidationIssue[]): LabProfileValidationResult {
  const sortedIssues = [...issues].sort((a, b) => {
    const codeOrder = a.code.localeCompare(b.code);
    if (codeOrder !== 0) return codeOrder;
    return a.path.localeCompare(b.path);
  });
  return { ok: sortedIssues.length === 0, issues: sortedIssues };
}

function isStarterKind(value: string | undefined): value is LabProfileStarterKind {
  return value === 'showcase' || value === 'scaffold';
}

export function validateLabProfile(profile: LabProfile): LabProfileValidationResult {
  const issues: LabProfileValidationIssue[] = [];

  if (profile.schemaVersion !== 1) {
    issues.push(issue('invalid_schema_version', 'schemaVersion', 'Lab profile schemaVersion must be 1.'));
  }
  if (!profile.id || profile.id.trim() !== profile.id) {
    issues.push(issue('invalid_profile_id', 'id', 'Lab profile id must be non-empty and already trimmed.'));
  }
  if (profile.boardTarget !== 'basys3') {
    issues.push(issue('unsupported_board_target', 'boardTarget', 'Only the Basys3 board target is supported in v1.'));
  }
  if (!profile.starter.referenceId) {
    issues.push(issue('missing_starter_reference', 'starter.referenceId', 'Lab profile must reference a starter or example.'));
  } else if (!KNOWN_STARTER_IDS.has(profile.starter.referenceId)) {
    issues.push(
      issue(
        'unknown_starter_reference',
        'starter.referenceId',
        `Starter reference ${profile.starter.referenceId} is not in the IDE example catalog.`,
      ),
    );
  }
  if (!isStarterKind(profile.starter.kind)) {
    issues.push(issue('invalid_starter_kind', 'starter.kind', 'Starter kind must be showcase or scaffold.'));
  }

  const requiredInputs = profile.requiredIo.filter((row) => row.required && row.direction === 'input');
  const requiredOutputs = profile.requiredIo.filter((row) => row.required && row.direction === 'output');
  if (requiredInputs.length === 0) {
    issues.push(issue('missing_required_input', 'requiredIo', 'Lab profile must require at least one input.'));
  }
  if (requiredOutputs.length === 0) {
    issues.push(issue('missing_required_output', 'requiredIo', 'Lab profile must require at least one output.'));
  }

  const ioIds = new Set<string>();
  for (const [index, row] of profile.requiredIo.entries()) {
    if (!row.id || !row.label || !row.boardResource || !row.nodeId) {
      issues.push(issue('invalid_io_requirement', `requiredIo.${index}`, 'Required IO rows must include id, label, board resource, and node id.'));
    }
    if (ioIds.has(row.id)) {
      issues.push(issue('duplicate_io_id', `requiredIo.${index}.id`, `Duplicate IO id ${row.id}.`));
    }
    ioIds.add(row.id);
  }

  if (profile.verification.minimumVectorCount < 1) {
    issues.push(
      issue(
        'invalid_minimum_vector_count',
        'verification.minimumVectorCount',
        'Lab profile must require at least one verification vector.',
      ),
    );
  }
  if (profile.verification.requiredExpectedOutputs.length === 0) {
    issues.push(
      issue(
        'missing_expected_outputs',
        'verification.requiredExpectedOutputs',
        'Lab profile verification must name at least one expected output.',
      ),
    );
  }
  if (profile.verification.schedule === 'clocked_macro') {
    const hasClock = profile.requiredIo.some((row) => row.timingRole === 'clock');
    if (!hasClock) {
      issues.push(issue('missing_clock_io', 'requiredIo', 'Clocked profile must identify one clock IO requirement.'));
    }
  }

  const resourceSet = new Set(profile.requiredIo.filter((row) => row.required).map((row) => row.boardResource));
  for (const resource of profile.mapping.requiredBoardResources) {
    if (!resourceSet.has(resource)) {
      issues.push(
        issue(
          'mapping_resource_without_io',
          'mapping.requiredBoardResources',
          `Required mapping resource ${resource} does not match a required IO row.`,
        ),
      );
    }
  }

  for (const artifact of REQUIRED_EXPORT_ARTIFACTS) {
    if (!profile.export.requiredArtifacts.includes(artifact)) {
      issues.push(
        issue(
          'missing_export_artifact',
          'export.requiredArtifacts',
          `Lab profile export expectations must include ${artifact}.`,
        ),
      );
    }
  }

  if (profile.noSolutionPolicy.publicStarterMustBeUnsolved && profile.starter.kind !== 'scaffold') {
    issues.push(
      issue(
        'unsolved_policy_requires_scaffold',
        'starter.kind',
        'Profiles that require unsolved public starters must reference a scaffold.',
      ),
    );
  }
  if (!profile.noSolutionPolicy.allowedStarterKinds.includes(profile.starter.kind)) {
    issues.push(
      issue(
        'starter_kind_not_allowed',
        'noSolutionPolicy.allowedStarterKinds',
        `Starter kind ${profile.starter.kind} is not allowed by this profile policy.`,
      ),
    );
  }
  if (profile.proof.maxClaimedTier !== 'E0') {
    issues.push(issue('unsupported_profile_proof_claim', 'proof.maxClaimedTier', 'Profile metadata may only claim E0 proof.'));
  }

  return result(issues);
}

export function validateLabProfiles(profiles: readonly LabProfile[]): LabProfileValidationResult {
  const issues: LabProfileValidationIssue[] = [];
  const seenIds = new Map<string, number>();

  for (const [index, profile] of profiles.entries()) {
    const previousIndex = seenIds.get(profile.id);
    if (previousIndex !== undefined) {
      issues.push(
        issue('duplicate_profile_id', `${index}.id`, `Profile id ${profile.id} already appeared at index ${previousIndex}.`),
      );
    }
    seenIds.set(profile.id, index);

    for (const profileIssue of validateLabProfile(profile).issues) {
      issues.push({
        ...profileIssue,
        path: `${index}.${profileIssue.path}`,
      });
    }
  }

  return result(issues);
}

export function assertNoSolutionLeak(
  profile: LabProfile,
  evidence: LabStarterSolutionEvidence,
): LabProfileValidationResult {
  const issues: LabProfileValidationIssue[] = [];
  const starterKind = evidence.starterKind;

  if (starterKind && !profile.noSolutionPolicy.allowedStarterKinds.includes(starterKind as LabProfileStarterKind)) {
    issues.push(
      issue(
        'starter_solution_kind_forbidden',
        'starterKind',
        `Starter kind ${starterKind} is not allowed for profile ${profile.id}.`,
      ),
    );
  }
  if (profile.noSolutionPolicy.publicStarterMustBeUnsolved && evidence.isSolution) {
    issues.push(issue('starter_marked_solution', 'isSolution', `Profile ${profile.id} forbids public solution starters.`));
  }
  if (!profile.noSolutionPolicy.solutionAssetsAllowed && (evidence.solutionAssetIds?.length ?? 0) > 0) {
    issues.push(
      issue(
        'starter_solution_assets_present',
        'solutionAssetIds',
        `Profile ${profile.id} forbids solution assets in the public starter path.`,
      ),
    );
  }
  if (profile.noSolutionPolicy.requireZeroConnectionsForStarter && (evidence.connectionCount ?? 0) > 0) {
    issues.push(
      issue(
        'starter_connections_present',
        'connectionCount',
        `Profile ${profile.id} requires the public starter scaffold to contain no solved wiring.`,
      ),
    );
  }

  return result(issues);
}
