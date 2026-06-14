import type { LabProfile, LabProfileArtifact } from './types';

const REQUIRED_EXPORT_ARTIFACTS: readonly LabProfileArtifact[] = ['vhdl', 'xdc', 'testbench', 'vivadoTcl'];

export const BUILT_IN_LAB_PROFILES: readonly LabProfile[] = [
  {
    schemaVersion: 1,
    id: 'logic-gates-and-or-xor-basys3',
    coursePackId: 'redbyte-ece141-v1',
    course: 'ECE141',
    labCode: 'bridge-logic-gates',
    title: 'Logic Gates: AND / OR / XOR',
    summary: 'Two Basys3 switches drive three LED outputs for parallel AND, OR, and XOR comparison.',
    boardTarget: 'basys3',
    tags: ['logic-gates', 'combinational', 'basys3', 'showcase'],
    goals: [
      'Compare AND, OR, and XOR behavior from the same two inputs.',
      'Run the full two-input truth table in Verify.',
      'Map SW0/SW1 and LD0-LD2 before export.',
    ],
    starter: {
      referenceId: 'logic-gates',
      catalog: 'ide-example',
      kind: 'showcase',
      title: 'Logic Gates: AND / OR / XOR',
    },
    requiredIo: [
      { id: 'sw0', label: 'SW0', direction: 'input', boardResource: 'SW0', nodeId: 'sw0_node', required: true, timingRole: 'data' },
      { id: 'sw1', label: 'SW1', direction: 'input', boardResource: 'SW1', nodeId: 'sw1_node', required: true, timingRole: 'data' },
      { id: 'ld0', label: 'LD0', direction: 'output', boardResource: 'LD0', nodeId: 'ld0_node', required: true },
      { id: 'ld1', label: 'LD1', direction: 'output', boardResource: 'LD1', nodeId: 'ld1_node', required: true },
      { id: 'ld2', label: 'LD2', direction: 'output', boardResource: 'LD2', nodeId: 'ld2_node', required: true },
    ],
    verification: {
      schedule: 'combinational',
      minimumVectorCount: 4,
      requiredExpectedOutputs: ['LD0', 'LD1', 'LD2'],
      compareMode: 'truth-table',
      allowsCustomVectors: true,
    },
    mapping: {
      requiredBoardResources: ['SW0', 'SW1', 'LD0', 'LD1', 'LD2'],
      requireAllRequiredIoMapped: true,
      allowBoardResourceAliases: true,
    },
    export: {
      topEntityName: 'top',
      requiredArtifacts: REQUIRED_EXPORT_ARTIFACTS,
      requiresRbprojSnapshot: true,
    },
    proof: {
      minimumAcceptedTier: 'E0',
      maxClaimedTier: 'E0',
      notes: ['Profile expectations are metadata only; Vivado or board proof must be attached separately.'],
    },
    noSolutionPolicy: {
      publicStarterMustBeUnsolved: false,
      solutionAssetsAllowed: false,
      requireZeroConnectionsForStarter: false,
      allowedStarterKinds: ['showcase'],
      notes: ['This profile references a concept showcase, not a student starter scaffold.'],
    },
  },
  {
    schemaVersion: 1,
    id: 'half-adder-basys3',
    coursePackId: 'redbyte-ece141-v1',
    course: 'ECE141',
    labCode: 'bridge-half-adder',
    title: 'Half Adder',
    summary: 'Two Basys3 switches drive SUM and CARRY LED outputs through XOR and AND behavior.',
    boardTarget: 'basys3',
    tags: ['half-adder', 'arithmetic', 'combinational', 'basys3', 'showcase'],
    goals: [
      'Prove SUM = A XOR B and CARRY = A AND B.',
      'Run the four-row truth table in Verify.',
      'Export with stable SW0/SW1 and LD0/LD1 mapping expectations.',
    ],
    starter: {
      referenceId: 'half-adder',
      catalog: 'ide-example',
      kind: 'showcase',
      title: 'Half Adder',
    },
    requiredIo: [
      { id: 'a', label: 'SW0 (A)', direction: 'input', boardResource: 'SW0', nodeId: 'sw0_node', required: true, timingRole: 'data' },
      { id: 'b', label: 'SW1 (B)', direction: 'input', boardResource: 'SW1', nodeId: 'sw1_node', required: true, timingRole: 'data' },
      { id: 'carry', label: 'LD0 (CARRY)', direction: 'output', boardResource: 'LD0', nodeId: 'ld0_node', required: true },
      { id: 'sum', label: 'LD1 (SUM)', direction: 'output', boardResource: 'LD1', nodeId: 'ld1_node', required: true },
    ],
    verification: {
      schedule: 'combinational',
      minimumVectorCount: 4,
      requiredExpectedOutputs: ['LD0 (CARRY)', 'LD1 (SUM)'],
      compareMode: 'truth-table',
      allowsCustomVectors: true,
    },
    mapping: {
      requiredBoardResources: ['SW0', 'SW1', 'LD0', 'LD1'],
      requireAllRequiredIoMapped: true,
      allowBoardResourceAliases: true,
    },
    export: {
      topEntityName: 'top',
      requiredArtifacts: REQUIRED_EXPORT_ARTIFACTS,
      requiresRbprojSnapshot: true,
    },
    proof: {
      minimumAcceptedTier: 'E0',
      maxClaimedTier: 'E0',
      notes: ['Profile expectations are metadata only; Vivado or board proof must be attached separately.'],
    },
    noSolutionPolicy: {
      publicStarterMustBeUnsolved: false,
      solutionAssetsAllowed: false,
      requireZeroConnectionsForStarter: false,
      allowedStarterKinds: ['showcase'],
      notes: ['This profile references a concept showcase, not a student starter scaffold.'],
    },
  },
  {
    schemaVersion: 1,
    id: 'two-bit-counter-basys3',
    coursePackId: 'redbyte-ece141-v1',
    course: 'ECE141',
    labCode: 'bridge-two-bit-counter',
    title: '2-Bit Up Counter (Basys3)',
    summary: 'A clocked Basys3 counter profile with board clock, enable, reset, and LD1:LD0 outputs.',
    boardTarget: 'basys3',
    tags: ['counter', 'sequential', 'clocked', 'basys3', 'showcase'],
    goals: [
      'Keep CLK100MHZ as the board-clock source.',
      'Verify enable/reset behavior across a multi-tick sequence.',
      'Map clock, control, and LD1:LD0 outputs before export.',
    ],
    starter: {
      referenceId: 'two-bit-counter',
      catalog: 'ide-example',
      kind: 'showcase',
      title: '2-Bit Up Counter (Basys3)',
    },
    requiredIo: [
      { id: 'clk', label: 'CLK100MHZ', direction: 'input', boardResource: 'CLK100MHZ', nodeId: 'clk_node', required: true, timingRole: 'clock' },
      { id: 'en', label: 'SW0', direction: 'input', boardResource: 'SW0', nodeId: 'en_node', required: true, timingRole: 'enable' },
      { id: 'rst', label: 'BTNC', direction: 'input', boardResource: 'BTNC', nodeId: 'rst_node', required: true, timingRole: 'reset' },
      { id: 'q0', label: 'LD0', direction: 'output', boardResource: 'LD0', nodeId: 'q0_out', required: true },
      { id: 'q1', label: 'LD1', direction: 'output', boardResource: 'LD1', nodeId: 'q1_out', required: true },
    ],
    verification: {
      schedule: 'clocked_macro',
      minimumVectorCount: 7,
      requiredExpectedOutputs: ['LD0', 'LD1'],
      compareMode: 'waveform',
      allowsCustomVectors: true,
    },
    mapping: {
      requiredBoardResources: ['CLK100MHZ', 'SW0', 'BTNC', 'LD0', 'LD1'],
      requireAllRequiredIoMapped: true,
      allowBoardResourceAliases: true,
    },
    export: {
      topEntityName: 'top',
      requiredArtifacts: REQUIRED_EXPORT_ARTIFACTS,
      requiresRbprojSnapshot: true,
    },
    proof: {
      minimumAcceptedTier: 'E0',
      maxClaimedTier: 'E0',
      notes: ['E3 board observation remains separate evidence; this profile does not claim live hardware proof.'],
    },
    noSolutionPolicy: {
      publicStarterMustBeUnsolved: false,
      solutionAssetsAllowed: false,
      requireZeroConnectionsForStarter: false,
      allowedStarterKinds: ['showcase'],
      notes: ['This profile references a concept showcase, not a student starter scaffold.'],
    },
  },
  {
    schemaVersion: 1,
    id: 'lab8-fsm-lock-basys3',
    coursePackId: 'redbyte-ece141-v1',
    course: 'ECE141',
    labCode: 'lab-8',
    title: 'Lab 8 Security Lock FSM',
    summary: 'A solution-forbidden Lab 8 profile for the Basys3 security-lock starter scaffold.',
    boardTarget: 'basys3',
    tags: ['lab8', 'fsm', 'security-lock', 'sequential', 'basys3', 'starter'],
    goals: [
      'Use ENTER (SW5) as the shared manual clock for every DFlipFlop.',
      'Use RESET (SW4) as the shared clear for state recovery.',
      'Prove both invalid and valid grouped serial paths before export.',
    ],
    starter: {
      referenceId: '23_lab8-fsm-lock-starter-basys3',
      catalog: 'ide-example',
      kind: 'scaffold',
      title: 'ECE141 Security Lock Starter - Lab 8 Bridge',
    },
    requiredIo: [
      { id: 'in0', label: 'IN0 (SW6)', direction: 'input', boardResource: 'SW6', nodeId: 'sw_in0', required: true, timingRole: 'data' },
      { id: 'in1', label: 'IN1 (SW7)', direction: 'input', boardResource: 'SW7', nodeId: 'sw_in1', required: true, timingRole: 'data' },
      { id: 'in2', label: 'IN2 (SW8)', direction: 'input', boardResource: 'SW8', nodeId: 'sw_in2', required: true, timingRole: 'data' },
      { id: 'enter', label: 'ENTER (SW5)', direction: 'input', boardResource: 'SW5', nodeId: 'sw_enter', required: true, timingRole: 'clock' },
      { id: 'reset', label: 'RESET (SW4)', direction: 'input', boardResource: 'SW4', nodeId: 'sw_reset', required: true, timingRole: 'reset' },
      { id: 'lock', label: 'LOCK (LED1)', direction: 'output', boardResource: 'LD1', nodeId: 'led_lock', required: true },
    ],
    verification: {
      schedule: 'clocked_macro',
      minimumVectorCount: 76,
      requiredExpectedOutputs: ['LOCK (LED1)'],
      compareMode: 'waveform',
      allowsCustomVectors: true,
      requiredCheckpointIds: ['fsm-invalid-path', 'fsm-valid-path'],
    },
    mapping: {
      requiredBoardResources: ['SW4', 'SW5', 'SW6', 'SW7', 'SW8', 'LD1'],
      requireAllRequiredIoMapped: true,
      allowBoardResourceAliases: true,
    },
    export: {
      topEntityName: 'top',
      requiredArtifacts: REQUIRED_EXPORT_ARTIFACTS,
      requiresRbprojSnapshot: true,
    },
    proof: {
      minimumAcceptedTier: 'E0',
      maxClaimedTier: 'E0',
      notes: ['The profile is a student scaffold contract. Vivado and board proof remain external evidence.'],
    },
    noSolutionPolicy: {
      publicStarterMustBeUnsolved: true,
      solutionAssetsAllowed: false,
      requireZeroConnectionsForStarter: true,
      allowedStarterKinds: ['scaffold'],
      notes: [
        'Public Lab 8 starter must remain unsolved.',
        'Instructor answer keys and solved wiring are outside this profile seam.',
      ],
    },
  },
] as const;

function cloneProfile(profile: LabProfile): LabProfile {
  return {
    ...profile,
    goals: [...profile.goals],
    tags: [...profile.tags],
    starter: { ...profile.starter },
    requiredIo: profile.requiredIo.map((row) => ({ ...row })),
    verification: {
      ...profile.verification,
      requiredExpectedOutputs: [...profile.verification.requiredExpectedOutputs],
      requiredCheckpointIds: profile.verification.requiredCheckpointIds
        ? [...profile.verification.requiredCheckpointIds]
        : undefined,
    },
    mapping: {
      ...profile.mapping,
      requiredBoardResources: [...profile.mapping.requiredBoardResources],
    },
    export: {
      ...profile.export,
      requiredArtifacts: [...profile.export.requiredArtifacts],
    },
    proof: {
      ...profile.proof,
      notes: [...profile.proof.notes],
    },
    noSolutionPolicy: {
      ...profile.noSolutionPolicy,
      allowedStarterKinds: [...profile.noSolutionPolicy.allowedStarterKinds],
      notes: [...profile.noSolutionPolicy.notes],
    },
  };
}

export function listBuiltInLabProfiles(): LabProfile[] {
  return BUILT_IN_LAB_PROFILES.map(cloneProfile);
}

export function getLabProfileById(id: string): LabProfile | undefined {
  const profile = BUILT_IN_LAB_PROFILES.find((candidate) => candidate.id === id);
  return profile ? cloneProfile(profile) : undefined;
}
