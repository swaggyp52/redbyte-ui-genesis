import type { RBProject } from '../../export/projectFormat';
import type { IdeDiagnosticOwner } from './diagnostics';
import type { HardwareExportFailureTruthCondition } from './projectWorkflowAuthority';
import type { TimingGuidance } from './timingGuidance';
import type { ExportViewModel } from './viewmodels/buildExportViewModel';

export type PackageHandoffStatus = 'ready' | 'blocked' | 'partial';

export interface PackageHandoffSummary {
  status: PackageHandoffStatus;
  statusLabel: string;
  headline: string;
  subline: string;
  boardTarget: string;
  timingPlain: string;
  mappingPlain: string;
  verifyPlain: string;
  artifactsPlain: string;
}

export type ArtifactAgreementTone = 'ok' | 'warn' | 'error';

export interface ArtifactAgreementRow {
  id: string;
  label: string;
  detail: string;
  tone: ArtifactAgreementTone;
}

export function worstAgreementTone(rows: ArtifactAgreementRow[]): ArtifactAgreementTone {
  if (rows.some((r) => r.tone === 'error')) return 'error';
  if (rows.some((r) => r.tone === 'warn')) return 'warn';
  return 'ok';
}

export function formatTimingPlain(
  timingMode: 'synchronous_board_clock' | 'manual_event_driven_lab' | 'combinational' | undefined,
  guidance: Pick<TimingGuidance, 'exportLabel' | 'exportDetail'>
): string {
  if (timingMode === 'manual_event_driven_lab') {
    return 'Manual-event lab: switches and buttons advance state; export relaxes oscillator-style constraints for those paths.';
  }
  if (timingMode === 'synchronous_board_clock') {
    return 'Board-clocked: one primary clock should reach a clock-capable pin so synthesis timing matches the Basys3 oscillator.';
  }
  if (timingMode === 'combinational') {
    return 'Combinational: outputs settle from inputs without a registered clock domain.';
  }
  return `${guidance.exportLabel}: ${guidance.exportDetail}`;
}

export function formatExportDiagnosticOwner(owner?: IdeDiagnosticOwner): string {
  if (!owner) return 'Export readiness';
  if (owner.kind === 'mapping') return 'Map Pins (I/O binding)';
  if (owner.kind === 'port') return 'Design (boundary / HDL port)';
  if (owner.kind === 'node') return 'Design (circuit element)';
  if (owner.kind === 'file') {
    const path = owner.filePath?.trim();
    return path ? `Project file (${path})` : 'Project file';
  }
  return 'Export readiness';
}

export function derivePackageHandoffSummary(input: {
  handoffSeverity: 'ready' | 'advisory' | 'blocked';
  handoffCondition?: HardwareExportFailureTruthCondition;
  exportViewBlocked: boolean;
  hasVerifyEvidenceWarning: boolean;
  agreementWorst: ArtifactAgreementTone;
  boardTarget: string;
  timingPlain: string;
  mappingPlain: string;
  verifyPlain: string;
}): PackageHandoffSummary {
  const blocked =
    input.exportViewBlocked ||
    input.handoffSeverity === 'blocked' ||
    input.agreementWorst === 'error';

  let status: PackageHandoffStatus;
  if (blocked) {
    status = 'blocked';
  } else if (
    input.handoffSeverity === 'ready' &&
    !input.hasVerifyEvidenceWarning &&
    input.agreementWorst === 'ok'
  ) {
    status = 'ready';
  } else {
    status = 'partial';
  }

  let statusLabel =
    status === 'ready' ? 'PACKAGE READY' : status === 'blocked' ? 'PACKAGE BLOCKED' : 'PACKAGE PARTIAL';

  let headline =
    status === 'ready'
      ? 'This handoff ZIP is internally consistent and matches your project authority.'
      : status === 'blocked'
        ? 'Resolve blockers before treating the download as submission-quality.'
        : 'You can inspect or download files, but finish Verify or pins before a hard handoff.';

  let subline =
    status === 'ready'
      ? 'Top RTL, constraints, bench, and manifest were emitted together from the same design and mapping state.'
      : status === 'blocked'
        ? 'Each blocker names what broke, why it matters, and which surface owns the fix.'
        : 'Run Compare checks or complete mapping when you need current evidence for trusted export.';

  if (!blocked && input.handoffCondition === 'export-missing') {
    statusLabel = 'READY TO BUILD';
    headline = 'Build a current Vivado project ZIP from this mapped design.';
    subline = 'Design and pin mapping are ready; no current bundle has been recorded yet.';
  } else if (!blocked && input.handoffCondition === 'export-stale') {
    statusLabel = 'STALE';
    headline = 'Rebuild the bundle so the ZIP matches the current circuit.';
    subline = 'A previous bundle exists, but design, verify, or mapping inputs changed after it was built.';
  }

  const artifactsPlain =
    input.agreementWorst === 'error'
      ? 'Generated files disagree on names, ports, or bindings — see Artifact agreement.'
      : input.agreementWorst === 'warn'
        ? 'One or more bundle files still need review (see Artifact agreement).'
        : 'Top HDL, testbench, XDC, README, and Vivado import script align on the top entity and port list.';

  return {
    status,
    statusLabel,
    headline,
    subline,
    boardTarget: input.boardTarget,
    timingPlain: input.timingPlain,
    mappingPlain: input.mappingPlain,
    verifyPlain: input.verifyPlain,
    artifactsPlain,
  };
}

type ArtifactLifecycle = 'ready' | 'blocked' | 'pending' | 'missing';

export function buildArtifactAgreementRows(input: {
  project: RBProject;
  viewModel: ExportViewModel;
  requiredMappedCount: number;
  requiredCount: number;
  timingStructureOk: boolean;
  topVhdStatus: ArtifactLifecycle;
  topXdcStatus: ArtifactLifecycle;
  testbenchStatus: ArtifactLifecycle;
  readmeStatus: ArtifactLifecycle;
  vivadoScriptStatus: ArtifactLifecycle;
}): ArtifactAgreementRow[] {
  const authorityTop = input.viewModel.topAuthority.designTop.trim();
  const fpgaTop = (input.project.fpga?.top ?? '').trim();
  const hdlTop = (input.project.hdl?.top ?? '').trim();

  const topMismatch =
    (fpgaTop.length > 0 && fpgaTop !== authorityTop) || (hdlTop.length > 0 && hdlTop !== authorityTop);
  const topRow: ArtifactAgreementRow = {
    id: 'top-authority',
    label: 'Top entity authority',
    detail: topMismatch
      ? `Project names ${[fpgaTop && `fpga.top=${fpgaTop}`, hdlTop && `hdl.top=${hdlTop}`]
          .filter(Boolean)
          .join(', ')} must match generated top ${authorityTop}.`
      : `Project and bundle agree on top entity ${authorityTop}.`,
    tone: topMismatch ? 'error' : 'ok',
  };

  const mappingErrors = input.viewModel.errors.filter(
    (e) => e.code === 'RBEX1001' || e.code === 'RBEX1002'
  );
  const pinsOk = input.requiredCount === 0 || input.requiredMappedCount >= input.requiredCount;
  const portRow: ArtifactAgreementRow = {
    id: 'port-contract',
    label: 'Expected I/O vs mapping',
    detail:
      mappingErrors.length > 0
        ? mappingErrors[0]?.fix ?? mappingErrors[0]?.message ?? 'Complete required port mapping.'
        : pinsOk
          ? 'Required top-level ports are mapped to Basys3 pins for constraints generation.'
          : 'Assign every required port to a board pin in Map Pins (or Project mapping).',
    tone: mappingErrors.length > 0 || !pinsOk ? 'error' : 'ok',
  };

  const consistencyBroken = input.viewModel.errors.some((e) =>
    e.message.toLowerCase().includes('artifact consistency')
  );
  const projectVectorCount = input.project.vectors?.length ?? 0;
  let tbTone: ArtifactAgreementTone = 'ok';
  let tbDetail =
    'Testbench instantiates the same top entity and port list as top.vhd (simulation-only).';
  if (consistencyBroken) {
    tbTone = 'error';
    const hit = input.viewModel.errors.find((e) => e.message.toLowerCase().includes('artifact consistency'));
    tbDetail = hit?.message ?? 'Testbench ports or entity name disagree with top.vhd.';
  } else if (input.testbenchStatus === 'blocked') {
    tbTone = 'error';
    tbDetail = 'Testbench file is blocked by export diagnostics — fix upstream errors first.';
  } else if (input.testbenchStatus === 'pending') {
    if (projectVectorCount === 0) {
      tbTone = 'ok';
      tbDetail =
        'No authored vectors yet — a full testbench can wait until you add a Verify scenario; bitstream handoff still uses top.vhd and XDC.';
    } else {
      tbTone = 'warn';
      tbDetail = 'Testbench is still being generated — wait for a clean export pass.';
    }
  } else if (input.testbenchStatus === 'missing') {
    tbTone = projectVectorCount === 0 ? 'ok' : 'warn';
    tbDetail =
      projectVectorCount === 0
        ? 'Testbench path not in bundle — optional until you author vectors and Compare.'
        : 'No testbench.vhd in the bundle yet — add vectors or clear blockers.';
  }
  const testbenchRow: ArtifactAgreementRow = {
    id: 'testbench-hdl',
    label: 'Testbench vs top HDL',
    detail: tbDetail,
    tone: tbTone,
  };

  let xdcTone: ArtifactAgreementTone = 'ok';
  let xdcDetail =
    'Pin constraints reference the same port names and directions as the top entity.';
  if (!input.timingStructureOk) {
    xdcTone = 'error';
    xdcDetail = 'Clock or sequential structure blocks valid constraints — fix in Design, then re-export.';
  } else if (input.topXdcStatus === 'blocked') {
    xdcTone = 'error';
    xdcDetail = 'top.xdc could not be generated cleanly — resolve mapping or timing issues.';
  } else if (input.topXdcStatus === 'pending') {
    xdcTone = 'warn';
    xdcDetail = 'Constraints file is not finalized yet.';
  } else if (input.topXdcStatus === 'missing') {
    xdcTone = 'error';
    xdcDetail = 'top.xdc missing from the bundle.';
  } else if (!pinsOk) {
    xdcTone = 'warn';
    xdcDetail = 'Mapping incomplete — XDC will not match board wiring until pins are assigned.';
  }
  const xdcRow: ArtifactAgreementRow = {
    id: 'constraints-xdc',
    label: 'XDC vs top ports',
    detail: xdcDetail,
    tone: xdcTone,
  };

  let manifestTone: ArtifactAgreementTone = 'ok';
  let manifestDetail = 'README and Vivado import script describe the same top module and flow.';
  if (input.readmeStatus === 'missing' || input.vivadoScriptStatus === 'missing') {
    manifestTone = 'error';
    manifestDetail = 'README or vivado_import.tcl is missing from the artifact list.';
  } else if (input.readmeStatus !== 'ready' || input.vivadoScriptStatus !== 'ready') {
    manifestTone = 'warn';
    manifestDetail = 'Review README or import script — one handoff file is not in the ready state.';
  }

  const manifestRow: ArtifactAgreementRow = {
    id: 'manifest-bundle',
    label: 'Manifest & Vivado glue',
    detail: manifestDetail,
    tone: manifestTone,
  };

  const rtlRow: ArtifactAgreementRow = {
    id: 'top-rtl',
    label: 'Top HDL present',
    detail:
      input.topVhdStatus === 'ready'
        ? 'top.vhd is ready and drives all downstream artifacts.'
        : input.topVhdStatus === 'blocked'
          ? 'top.vhd is blocked — fix design or mapping errors first.'
          : input.topVhdStatus === 'pending'
            ? 'top.vhd is still generating.'
            : 'top.vhd is not in the bundle.',
    tone:
      input.topVhdStatus === 'ready'
        ? 'ok'
        : input.topVhdStatus === 'pending'
          ? 'warn'
          : 'error',
  };

  const timingRow: ArtifactAgreementRow = {
    id: 'timing-policy',
    label: 'Timing mode vs structure',
    detail: input.timingStructureOk
      ? 'Structural timing checks passed; export constraints follow the active timing mode.'
      : 'Structural timing or feedback-loop issue — repair in Design before trusting constraints.',
    tone: input.timingStructureOk ? 'ok' : 'error',
  };

  return [topRow, rtlRow, portRow, testbenchRow, xdcRow, manifestRow, timingRow];
}
