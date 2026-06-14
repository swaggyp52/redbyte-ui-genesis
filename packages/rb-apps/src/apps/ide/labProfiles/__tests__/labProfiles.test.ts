import { describe, expect, it } from 'vitest';
import { getIdeExampleById } from '../../examplesCatalog';
import {
  assertNoSolutionLeak,
  getLabProfileById,
  listBuiltInLabProfiles,
  validateLabProfile,
  validateLabProfiles,
  type LabProfile,
} from '../index';

describe('lab profile data seam', () => {
  it('defines deterministic built-in profiles for the current course bridge path', () => {
    const profiles = listBuiltInLabProfiles();

    expect(profiles.map((profile) => profile.id)).toEqual([
      'logic-gates-and-or-xor-basys3',
      'half-adder-basys3',
      'two-bit-counter-basys3',
      'lab8-fsm-lock-basys3',
    ]);

    for (const profile of profiles) {
      expect(validateLabProfile(profile).ok).toBe(true);
      expect(profile.boardTarget).toBe('basys3');
      expect(profile.requiredIo.length).toBeGreaterThan(0);
      expect(profile.verification.minimumVectorCount).toBeGreaterThan(0);
      expect(profile.mapping.requiredBoardResources.length).toBeGreaterThan(0);
      expect(profile.export.requiredArtifacts).toEqual(['vhdl', 'xdc', 'testbench', 'vivadoTcl']);
      expect(getIdeExampleById(profile.starter.referenceId)).toBeTruthy();
    }
  });

  it('keeps course metadata separate from circuit/runtime state', () => {
    const profiles = listBuiltInLabProfiles();
    const forbiddenRuntimeKeys = [
      'circuit',
      'connections',
      'nodes',
      'vectors',
      'ioRows',
      'hardwareMapping',
      'projectRuntime',
      'workflowState',
    ];

    for (const profile of profiles) {
      const serialized = JSON.stringify(profile);
      for (const key of forbiddenRuntimeKeys) {
        expect(Object.prototype.hasOwnProperty.call(profile, key)).toBe(false);
        expect(serialized).not.toContain(`"${key}"`);
      }
    }
  });

  it('validates profile shape, duplicate IDs, starter references, and IO coverage', () => {
    const profiles = listBuiltInLabProfiles();
    const validation = validateLabProfiles(profiles);
    expect(validation.ok).toBe(true);
    expect(validation.issues).toEqual([]);

    const duplicateValidation = validateLabProfiles([profiles[0]!, profiles[0]!]);
    expect(duplicateValidation.ok).toBe(false);
    expect(duplicateValidation.issues.map((issue) => issue.code)).toContain('duplicate_profile_id');

    const brokenProfile: LabProfile = {
      ...profiles[0]!,
      starter: { ...profiles[0]!.starter, referenceId: 'missing-starter' },
      requiredIo: profiles[0]!.requiredIo.filter((row) => row.direction === 'input'),
    };
    const brokenValidation = validateLabProfile(brokenProfile);
    expect(brokenValidation.ok).toBe(false);
    expect(brokenValidation.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['missing_required_output', 'unknown_starter_reference']),
    );
  });

  it('keeps Lab 8 scaffold policy explicit and rejects solved starter evidence', () => {
    const profile = getLabProfileById('lab8-fsm-lock-basys3');

    expect(profile?.starter.referenceId).toBe('23_lab8-fsm-lock-starter-basys3');
    expect(profile?.starter.kind).toBe('scaffold');
    expect(profile?.noSolutionPolicy.solutionAssetsAllowed).toBe(false);
    expect(profile?.proof.maxClaimedTier).toBe('E0');

    const solvedEvidence = assertNoSolutionLeak(profile!, {
      starterKind: 'solution',
      isSolution: true,
      solutionAssetIds: ['answer-key'],
      connectionCount: 8,
    });
    expect(solvedEvidence.ok).toBe(false);
    expect(solvedEvidence.issues.map((issue) => issue.code)).toEqual([
      'starter_connections_present',
      'starter_marked_solution',
      'starter_solution_assets_present',
      'starter_solution_kind_forbidden',
    ]);

    const scaffoldEvidence = assertNoSolutionLeak(profile!, {
      starterKind: 'scaffold',
      isSolution: false,
      solutionAssetIds: [],
      connectionCount: 0,
    });
    expect(scaffoldEvidence.ok).toBe(true);
  });
});
