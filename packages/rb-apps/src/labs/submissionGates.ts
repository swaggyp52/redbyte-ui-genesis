import type { RBProject } from '../export/projectFormat';
import type { ToolchainBuildPath, ToolchainDoctorReport } from '../fpga/toolchainTypes';
import { getLabDefinitionById } from './labDefinitions';

export type SubmissionGateVerdict = 'pass' | 'warn' | 'block';

export type SubmissionGateCtaTab = 'build' | 'simulate' | 'hardware';

export interface SubmissionGateIssue {
  code: string;
  severity: 'warn' | 'block';
  title: string;
  message: string;
  fixHint?: string;
  cta?: { label: string; action: 'openTab'; tab: SubmissionGateCtaTab };
  evidence?: { key: string; expected?: string; actual?: string };
}

export interface SubmissionGateResult {
  verdict: SubmissionGateVerdict;
  issues: SubmissionGateIssue[];
}

export interface SubmissionValidationRecentRuns {
  simulated?: boolean;
  synthesized?: boolean;
  waveformCaptured?: boolean;
  hardwareObserved?: boolean;
}

export interface SubmissionValidationInput {
  projectSnapshot: RBProject | null;
  doctorReport: ToolchainDoctorReport | null;
  buildPath?: ToolchainBuildPath | null;
  recentRuns?: SubmissionValidationRecentRuns;
}

function makeVerdict(issues: SubmissionGateIssue[]): SubmissionGateVerdict {
  if (issues.some((issue) => issue.severity === 'block')) return 'block';
  if (issues.length > 0) return 'warn';
  return 'pass';
}

function toSafeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasPortInSources(project: RBProject, portName: string): boolean {
  const sources = project.hdl?.sources ?? [];
  if (sources.length === 0) return false;
  const sourceText = sources.map((source) => source.text ?? '').join('\n');
  if (!sourceText.trim()) return false;
  const matcher = new RegExp(`\\b${escapeRegExp(portName)}\\b`);
  return matcher.test(sourceText);
}

function readToolchainProbeState(doctorReport: ToolchainDoctorReport | null): 'pass' | 'warn' | 'fail' {
  const gate = doctorReport?.studentReadiness?.gates?.find((entry) => entry.id === 'toolchain_probe');
  if (!gate) {
    if (!doctorReport?.probe?.ok) return 'fail';
    return 'pass';
  }
  if (gate.state === 'fail') return 'fail';
  if (gate.state === 'warn') return 'warn';
  return 'pass';
}

export function validateSubmissionForLab(
  labId: string,
  input: SubmissionValidationInput,
): SubmissionGateResult {
  const issues: SubmissionGateIssue[] = [];
  const definition = getLabDefinitionById(labId);
  const project = input.projectSnapshot;

  if (!project) {
    issues.push({
      code: 'project_snapshot_missing',
      severity: 'block',
      title: 'No project snapshot available',
      message: 'Submission cannot run without a project snapshot.',
      fixHint: 'Return to Build and ensure your project has loaded sources.',
      cta: { label: 'Open Build', action: 'openTab', tab: 'build' },
    });
    return { verdict: 'block', issues };
  }

  if (!definition) {
    issues.push({
      code: 'lab_definition_missing',
      severity: 'warn',
      title: 'Unknown lab configuration',
      message: `No submission contract found for lab '${labId}'.`,
      fixHint: 'Proceeding with baseline checks only.',
    });
  }

  const projectLabId = toSafeString(project.meta?.labId);
  if (labId !== 'freeplay') {
    if (!projectLabId || projectLabId !== labId) {
      issues.push({
        code: 'lab_id_mismatch',
        severity: 'block',
        title: 'Wrong lab selected for submission',
        message: `This workspace is tagged as '${projectLabId || 'unset'}' but you are submitting '${labId}'.`,
        fixHint: 'Re-open the correct lab starter before submitting.',
        cta: { label: 'Open Build', action: 'openTab', tab: 'build' },
        evidence: { key: 'labId', expected: labId, actual: projectLabId || 'unset' },
      });
    }
  }

  const configuredTop = toSafeString(project.fpga?.top) || toSafeString(project.hdl?.top);
  if (definition?.requiredTop) {
    if (!configuredTop || configuredTop !== definition.requiredTop) {
      issues.push({
        code: 'top_module_mismatch',
        severity: 'block',
        title: 'Top module is missing or incorrect',
        message: `Expected top module '${definition.requiredTop}' for this lab.`,
        fixHint: 'Set the top module in Build before generating your bundle.',
        cta: { label: 'Open Build', action: 'openTab', tab: 'build' },
        evidence: { key: 'top', expected: definition.requiredTop, actual: configuredTop || 'unset' },
      });
    }
  }

  const selectedPreset = toSafeString(project.fpga?.preset);
  if (definition?.requiredBoardPreset) {
    if (selectedPreset !== definition.requiredBoardPreset) {
      issues.push({
        code: 'board_preset_required',
        severity: 'block',
        title: 'Required board preset not selected',
        message: `This lab requires preset '${definition.requiredBoardPreset}'.`,
        fixHint: 'Select the required Basys3 preset in Build/Hardware.',
        cta: { label: 'Open Hardware', action: 'openTab', tab: 'hardware' },
        evidence: {
          key: 'fpga.preset',
          expected: definition.requiredBoardPreset,
          actual: selectedPreset || 'unset',
        },
      });
    }
  } else if (labId !== 'freeplay' && !selectedPreset) {
    issues.push({
      code: 'board_preset_recommended',
      severity: 'warn',
      title: 'No board preset selected',
      message: 'No Basys3 preset is selected for this submission.',
      fixHint: 'Selecting a preset helps avoid pin-map mistakes during grading.',
      cta: { label: 'Open Hardware', action: 'openTab', tab: 'hardware' },
      evidence: { key: 'fpga.preset', expected: 'recommended', actual: 'unset' },
    });
  }

  const requiredPorts = definition?.requiredPorts ?? [];
  for (const portName of requiredPorts) {
    if (!hasPortInSources(project, portName)) {
      issues.push({
        code: `required_port_missing_${portName}`,
        severity: 'block',
        title: `Required port '${portName}' not found`,
        message: `The HDL sources do not include required port '${portName}'.`,
        fixHint: 'Update your top module port list to match the lab contract.',
        cta: { label: 'Open Build', action: 'openTab', tab: 'build' },
        evidence: { key: 'requiredPort', expected: portName, actual: 'missing' },
      });
    }
  }

  const toolchainProbeState = readToolchainProbeState(input.doctorReport);
  const requireHardwareEvidence = definition?.requireHardwareEvidence === true;
  if (toolchainProbeState === 'fail' && labId !== 'freeplay') {
    if (requireHardwareEvidence) {
      issues.push({
        code: 'toolchain_required_for_hardware_evidence',
        severity: 'block',
        title: 'Toolchain unavailable for required hardware evidence',
        message: 'This lab requires hardware evidence, but toolchain checks failed.',
        fixHint: 'Fix hardware readiness in Studio before packaging.',
        cta: { label: 'Open Hardware', action: 'openTab', tab: 'hardware' },
      });
    } else {
      issues.push({
        code: 'toolchain_missing_warn',
        severity: 'warn',
        title: 'Toolchain checks are not passing',
        message: 'Toolchain probe is failing. Submission is allowed, but hardware evidence may be incomplete.',
        fixHint: 'Verify hardware readiness in Studio to reduce grading friction.',
        cta: { label: 'Open Hardware', action: 'openTab', tab: 'hardware' },
      });
    }
  }

  const resolvedBuildPath = input.buildPath ?? input.doctorReport?.buildPath ?? null;
  if (requireHardwareEvidence && !resolvedBuildPath) {
    issues.push({
      code: 'build_path_unresolved',
      severity: 'block',
      title: 'Build path cannot be resolved',
      message: 'Hardware evidence is required, but the toolchain build path is unresolved.',
      fixHint: 'Run Build and verify toolchain planning succeeds.',
      cta: { label: 'Open Build', action: 'openTab', tab: 'build' },
    });
  }

  const requireSimEvidence = definition?.requireSimEvidence !== false && labId !== 'freeplay';
  if (requireSimEvidence && !input.recentRuns?.simulated) {
    issues.push({
      code: 'simulate_not_run',
      severity: 'warn',
      title: 'Simulate tab was not run',
      message: 'No simulation evidence was detected for this lab.',
      fixHint: 'Run Simulate once to include stronger evidence in your bundle.',
      cta: { label: 'Open Simulate', action: 'openTab', tab: 'simulate' },
      evidence: { key: 'recentRuns.simulated', expected: 'true', actual: 'false' },
    });
  }

  if (requireSimEvidence && !input.recentRuns?.synthesized) {
    issues.push({
      code: 'synth_artifact_missing',
      severity: 'warn',
      title: 'No synthesis run detected',
      message: 'Synthesis artifacts were not detected in this session.',
      fixHint: 'Run synthesis from Simulate to attach build evidence.',
      cta: { label: 'Open Simulate', action: 'openTab', tab: 'simulate' },
    });
  }

  if (definition?.requireWaveform && !input.recentRuns?.waveformCaptured) {
    issues.push({
      code: 'waveform_evidence_missing',
      severity: 'warn',
      title: 'Waveform evidence missing',
      message: 'This lab expects waveform evidence, but none was detected.',
      fixHint: 'Capture a waveform/probe trace before submitting.',
      cta: { label: 'Open Simulate', action: 'openTab', tab: 'simulate' },
    });
  }

  if (requireHardwareEvidence && !input.recentRuns?.hardwareObserved) {
    issues.push({
      code: 'hardware_evidence_missing',
      severity: 'warn',
      title: 'Hardware evidence not observed',
      message: 'No hardware session evidence was detected in this workspace.',
      fixHint: 'Run Hardware once and capture evidence if a board is available.',
      cta: { label: 'Open Hardware', action: 'openTab', tab: 'hardware' },
    });
  }

  return {
    verdict: makeVerdict(issues),
    issues,
  };
}
