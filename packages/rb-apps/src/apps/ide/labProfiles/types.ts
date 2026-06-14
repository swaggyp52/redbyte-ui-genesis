export type LabProfileBoardTarget = 'basys3';

export type LabProfileProofTier = 'E0' | 'E1' | 'E2' | 'E3';

export type LabProfileStarterKind = 'showcase' | 'scaffold';

export type LabProfileSchedule = 'combinational' | 'clocked_macro';

export type LabProfileIoDirection = 'input' | 'output';

export type LabProfileArtifact = 'vhdl' | 'xdc' | 'testbench' | 'vivadoTcl';

export interface LabProfileStarterReference {
  referenceId: string;
  catalog: 'ide-example';
  kind: LabProfileStarterKind;
  title: string;
}

export interface LabProfileIoRequirement {
  id: string;
  label: string;
  direction: LabProfileIoDirection;
  boardResource: string;
  nodeId: string;
  required: boolean;
  timingRole?: 'clock' | 'reset' | 'enable' | 'data';
}

export interface LabProfileVerificationExpectation {
  schedule: LabProfileSchedule;
  minimumVectorCount: number;
  requiredExpectedOutputs: readonly string[];
  compareMode: 'truth-table' | 'waveform';
  allowsCustomVectors: boolean;
  requiredCheckpointIds?: readonly string[];
}

export interface LabProfileMappingExpectation {
  requiredBoardResources: readonly string[];
  requireAllRequiredIoMapped: boolean;
  allowBoardResourceAliases: boolean;
}

export interface LabProfileExportExpectation {
  topEntityName: string;
  requiredArtifacts: readonly LabProfileArtifact[];
  requiresRbprojSnapshot: boolean;
}

export interface LabProfileProofExpectation {
  minimumAcceptedTier: LabProfileProofTier;
  maxClaimedTier: LabProfileProofTier;
  notes: readonly string[];
}

export interface LabProfileNoSolutionPolicy {
  publicStarterMustBeUnsolved: boolean;
  solutionAssetsAllowed: boolean;
  requireZeroConnectionsForStarter: boolean;
  allowedStarterKinds: readonly LabProfileStarterKind[];
  notes: readonly string[];
}

export interface LabProfile {
  schemaVersion: 1;
  id: string;
  coursePackId: 'redbyte-ece141-v1';
  course: string;
  labCode: string;
  title: string;
  summary: string;
  boardTarget: LabProfileBoardTarget;
  goals: readonly string[];
  tags: readonly string[];
  starter: LabProfileStarterReference;
  requiredIo: readonly LabProfileIoRequirement[];
  verification: LabProfileVerificationExpectation;
  mapping: LabProfileMappingExpectation;
  export: LabProfileExportExpectation;
  proof: LabProfileProofExpectation;
  noSolutionPolicy: LabProfileNoSolutionPolicy;
}

export interface LabProfileValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface LabProfileValidationResult {
  ok: boolean;
  issues: readonly LabProfileValidationIssue[];
}

export interface LabStarterSolutionEvidence {
  starterKind?: string;
  isSolution?: boolean;
  solutionAssetIds?: readonly string[];
  connectionCount?: number;
}
