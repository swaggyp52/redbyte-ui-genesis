// @vitest-environment jsdom
/**
 * Export surface handoff-state tests.
 * Verifies that the four trust-condition states (trusted / advisory / blocked)
 * and the Unified Workbench v3 decision, file preview, and technical-evidence
 * dialog render correctly via the full ExportSurface pipeline.
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import type { RBProject } from '../../../export/projectFormat';
import { ExportSurface } from '../surfaces/ExportSurface';
import type { ProjectHealthVerifyResult } from '../projectHealth';
import { deriveProjectWorkflowAuthority } from '../projectWorkflowAuthority';

// ── fixtures ──────────────────────────────────────────────────────────────────

function baseMappedProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-12T00:00:00.000Z',
    updatedAt: '2026-03-12T00:00:00.000Z',
    name: 'handoff-states-fixture',
    description: 'Handoff state test fixture',
    circuit: {
      nodes: [
        { id: 'sw0', type: 'INPUT', x: 100, y: 100, label: 'SW0', config: {}, state: {} },
        { id: 'ld0', type: 'OUTPUT', x: 300, y: 100, label: 'LD0', config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'ld0', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [{ id: 'sw0', nodeId: 'sw0', port: 'out', label: 'SW0', pin: 'V17' }],
      outputs: [{ id: 'ld0', nodeId: 'ld0', port: 'in', label: 'LD0', pin: 'U16' }],
    },
    vectors: [],
    hdl: {
      top: 'top',
      sources: [
        {
          path: 'top.vhd',
          language: 'vhdl',
          text: 'entity top is port(sw0:in bit;ld0:out bit); end top;',
        },
      ],
    },
    fpga: { board: 'basys3', top: 'top' },
  };
}

const passVerify: ProjectHealthVerifyResult = {
  status: 'pass',
  runKind: 'verify',
  hash: 'abc999',
  reportHash: 'rep999',
  ranAtIso: '2026-03-25T00:00:00.000Z',
};

const failVerify: ProjectHealthVerifyResult = {
  status: 'fail',
  runKind: 'verify',
  hash: 'abc888',
  reportHash: 'rep888',
  ranAtIso: '2026-03-25T00:00:00.000Z',
};

function makeAuthority(opts: {
  verifyResult?: ProjectHealthVerifyResult;
  dirtySinceVerify?: boolean;
  exportHash?: string;
  currentExportHash?: string;
} = {}) {
  const { verifyResult, dirtySinceVerify = false, exportHash = 'exp-hash', currentExportHash = exportHash } = opts;
  const verifyHash = verifyResult?.hash ?? null;
  return deriveProjectWorkflowAuthority({
    projectHealthCore: {
      lastVerify: verifyResult ?? undefined,
      lastExport: exportHash
        ? { status: 'ok', hash: exportHash, ranAtIso: '2026-03-12T00:10:00.000Z' }
        : undefined,
      dirtySinceVerify,
      dirtySinceExport: Boolean(exportHash && currentExportHash && exportHash !== currentExportHash),
    },
    readiness: {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      verifyQualification: undefined,
    },
    verifyLastRun: verifyResult,
    verifyRunHistory: verifyHash ? [{ projectHash: verifyHash }] : undefined,
    currentVerifyProjectHash: verifyHash,
    currentExportHash: currentExportHash ?? undefined,
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ExportSurface handoff states', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ── Trusted state ────────────────────────────────────────────────────────────

  it('Compare PASS is downloadable but not package-ready until a trusted download receipt exists', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="abc999"
        verifyResult={passVerify}
        dirtySinceVerify={false}
        workflowAuthority={makeAuthority({ verifyResult: passVerify, exportHash: 'abc999' })}
      />
    );
    const hero = getByTestId('ide-export-readiness-hero');
    expect(hero.textContent).toContain('Package current');
    const inspector = getByTestId('ide-export-package-inspector-v1');
    expect(inspector.getAttribute('data-export-package-state')).toBe('draft');
    expect(inspector.getAttribute('data-export-derived-state')).toBe('downloadable-trusted');
    const actions = getByTestId('ide-export-primary-actions');
    expect(actions.textContent).toContain('Validate package');
    expect(actions.textContent).toContain('Download');
    expect(getByTestId('ide-export-package-download-v1').textContent).toBe('Download Package');
    expect(getByTestId('ide-export-file-browser').textContent).toContain('Downloadable');
    expect(getByTestId('ide-export-file-browser').textContent).not.toContain('Ready');
    expect(getByTestId('ide-export-panel').querySelector('[data-testid="ide-panel-title-row"]')).toBeNull();
  });

  // ── Advisory state ───────────────────────────────────────────────────────────

  it('advisory: readiness hero shows a draft when Simulate has not run', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeAuthority()}
      />
    );
    const hero = getByTestId('ide-export-readiness-hero');
    expect(hero.textContent).toContain('Draft export available');
    expect(hero.textContent).toContain('Expected-output comparison has not run');
    const inspector = getByTestId('ide-export-package-inspector-v1');
    expect(inspector.getAttribute('data-export-structural-state')).toBe('downloadable');
    expect(inspector.getAttribute('data-export-verification-trust')).toBe('unverified');
    expect(inspector.getAttribute('data-export-action-state')).toBe('not-downloaded');
    expect(inspector.getAttribute('data-export-derived-state')).toBe('downloadable-unverified');
    expect(getByTestId('ide-export-file-browser').textContent).toContain('Downloadable');
    expect(getByTestId('ide-export-file-browser').textContent).not.toContain('Ready');
  });

  it('advisory: Simulate repair stays primary while a structurally valid draft remains downloadable', () => {
    const onOpenVerify = vi.fn();
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="h1"
        onOpenVerify={onOpenVerify}
        workflowAuthority={makeAuthority()}
      />
    );
    const actions = getByTestId('ide-export-primary-actions');
    expect(actions.textContent).toContain('Open Simulate');
    expect(getByTestId('ide-export-package-build-v1').textContent).toBe('Open Simulate');
    expect(getByTestId('ide-export-draft-download-v1').textContent).toBe('Download draft');
    expect((getByTestId('ide-export-draft-download-v1') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(getByTestId('ide-export-package-build-v1'));
    expect(onOpenVerify).toHaveBeenCalledTimes(1);
  });

  it('advisory: readiness hero names a failed Compare as draft evidence', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="abc888"
        verifyResult={failVerify}
        dirtySinceVerify={false}
        workflowAuthority={makeAuthority({ verifyResult: failVerify, exportHash: 'abc888' })}
      />
    );
    expect(getByTestId('ide-export-readiness-hero').textContent).toContain('Draft export available');
    expect(getByTestId('ide-export-upstream-verify').textContent).toContain('Simulated');
    expect(getByTestId('ide-export-upstream-verify').textContent).toContain('expected outputs differ');
    expect(getByTestId('ide-export-draft-download-v1').textContent).toBe('Download draft');
    expect(getByTestId('ide-export-package-inspector-v1').getAttribute('data-export-verification-trust')).toBe('draft');
    expect(getByTestId('ide-export-file-browser').textContent).toContain('Downloadable');
    expect(getByTestId('ide-export-file-browser').textContent).not.toContain('Ready');
  });

  it('blocked: keeps generated files inspectable and offers one truthful Map Pins repair', () => {
    const project = baseMappedProject();
    project.ioMapping!.outputs[0] = { ...project.ioMapping!.outputs[0], pin: '' };
    const onGoToHardware = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <ExportSurface
        project={project}
        determinismHash="blocked-map"
        verifyResult={passVerify}
        workflowAuthority={makeAuthority({ verifyResult: passVerify, exportHash: 'blocked-map' })}
        onGoToHardware={onGoToHardware}
      />
    );

    expect(getByTestId('ide-export-package-inspector-v1').getAttribute('data-export-package-state')).toBe('blocked');
    expect(getByTestId('ide-export-package-inspector-v1').getAttribute('data-export-structural-state')).toBe('blocked');
    expect(queryByTestId('ide-export-file-browser')).toBeTruthy();
    for (const role of ['project', 'source', 'constraints', 'simulation', 'readme']) {
      expect(getByTestId(`ide-export-artifact-role-${role}`)).toBeTruthy();
    }
    const actions = getByTestId('ide-export-primary-actions');
    expect(actions.textContent).toContain('Open Board & Constraints');
    expect(getByTestId('ide-export-blocked-open-map-pins').textContent).toBe('Open Board & Constraints');
    fireEvent.click(getByTestId('ide-export-blocked-open-map-pins'));
    expect(onGoToHardware).toHaveBeenCalledTimes(1);
  });

  // ── Provenance rows ───────────────────────────────────────────────────────────

  it('readiness details show a draft Simulate state when no result exists', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeAuthority()}
      />
    );
    expect(getByTestId('ide-export-upstream-verify').textContent).toContain('Draft');
    expect(getByTestId('ide-export-upstream-verify').textContent).toContain('Run the current scenario in Simulate');
  });

  it('keeps stale behavioral currentness distinct from the draft evidence tier', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="current-design-hash"
        verifyResult={passVerify}
        dirtySinceVerify={true}
        workflowAuthority={makeAuthority({
          verifyResult: passVerify,
          dirtySinceVerify: true,
          exportHash: 'current-design-hash',
        })}
      />
    );

    expect(getByTestId('ide-export-simulation-evidence-tier').textContent).toContain('Draft');
    const verifyReadiness = getByTestId('ide-export-upstream-verify');
    expect(verifyReadiness.textContent).toContain('Stale - rerun Simulate');
    expect(verifyReadiness.textContent).toContain('Prior simulation evidence exists');
    expect(verifyReadiness.textContent).not.toContain('create behavioral evidence');
  });

  it('readiness details show validated simulation evidence when Compare passed and is current', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="abc999"
        verifyResult={passVerify}
        dirtySinceVerify={false}
        workflowAuthority={makeAuthority({ verifyResult: passVerify, exportHash: 'abc999' })}
      />
    );
    expect(getByTestId('ide-export-upstream-verify').textContent).toContain('Validated');
    expect(getByTestId('ide-export-upstream-verify').textContent).toContain('optional checks passed');
  });

  it('shows a truthful rebuild action when export hash predates the current design hash', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="current-hash"
        verifyResult={passVerify}
        dirtySinceVerify={false}
        workflowAuthority={makeAuthority({ verifyResult: passVerify, exportHash: 'older-hash', currentExportHash: 'current-hash' })}
      />
    );
    expect(getByTestId('ide-export-readiness-hero').textContent).toMatch(/stale|build/i);
    expect(getByTestId('ide-export-package-build-v1').textContent).toMatch(/build|rebuild/i);
  });

  // ── ExportVivadoInstructions ──────────────────────────────────────────────────

  it('keeps the generated file list and selected preview visible', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeAuthority()}
      />
    );
    expect(getByTestId('ide-export-file-browser')).toBeTruthy();
    expect(getByTestId('ide-export-selected-preview-v1')).toBeTruthy();
    expect(getByTestId('ide-export-preview-path').textContent).toBeTruthy();
    for (const role of ['project', 'source', 'constraints', 'simulation', 'readme']) {
      expect(getByTestId(`ide-export-artifact-role-${role}`)).toBeTruthy();
      expect(getByTestId(`ide-export-submission-role-${role}`)).toBeTruthy();
    }
  });

  it('keeps the detailed role guide without a narration card in the package decision', () => {
    const { getByTestId, queryByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeAuthority()}
      />
    );

    // The decision block states the package's derived state; the role guide answers "what to submit".
    expect(queryByTestId('ide-export-submission-answer')).toBeNull();

    const detailedGuide = getByTestId('ide-export-submission-guidance');
    expect(detailedGuide.textContent).toContain('Choose files by requested role');
    for (const role of ['project', 'source', 'constraints', 'simulation', 'readme']) {
      expect(within(detailedGuide).getByTestId(`ide-export-submission-role-${role}`)).toBeTruthy();
    }
  });

  it('records exact package bytes and preserves unverified trust after download', async () => {
    if (!('createObjectURL' in URL)) {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: vi.fn(() => 'blob:export-package'),
      });
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export-package');
    }
    if (!('revokeObjectURL' in URL)) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: vi.fn(),
      });
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    }
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const onExportResult = vi.fn();
    const view = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="project-source-hash"
        workflowAuthority={makeAuthority()}
        onExportResult={onExportResult}
      />
    );

    await act(async () => {
      fireEvent.click(view.getByTestId('ide-export-draft-download-v1'));
    });

    await waitFor(() => expect(onExportResult).toHaveBeenCalledTimes(1));
    const result = onExportResult.mock.calls[0]?.[0];
    expect(result).toEqual(expect.objectContaining({
      status: 'ok',
      verificationTrust: 'unverified',
      downloadKind: 'project',
      downloadedAtIso: expect.any(String),
      packageHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      sourceHashes: expect.objectContaining({ project: 'project-source-hash' }),
      sourceCurrentness: {
        project: 'current',
        export: 'current',
        mapping: 'current',
        verify: 'missing',
      },
    }));
    expect(result.bundleHash).toBe(result.packageHash);

    const inspector = view.getByTestId('ide-export-package-inspector-v1');
    expect(inspector.getAttribute('data-export-action-state')).toBe('downloaded');
    expect(inspector.getAttribute('data-export-derived-state')).toBe('downloaded-unverified');
    expect(view.getByTestId('ide-export-derived-state').textContent).toContain('Downloaded unverified');

    fireEvent.click(view.getByTestId('ide-export-open-technical-evidence'));
    expect(view.getByTestId('ide-export-download-evidence').textContent).toContain(result.packageHash);
    expect(view.getByTestId('ide-export-download-evidence').textContent).toContain('Unverified');
  });

  it('does not promote a draft download after later Compare PASS without a new download', async () => {
    if (!('createObjectURL' in URL)) {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: vi.fn(() => 'blob:export-package'),
      });
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export-package');
    }
    if (!('revokeObjectURL' in URL)) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: vi.fn(),
      });
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    }
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const onExportResult = vi.fn();
    const view = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="transition-project-source"
        workflowAuthority={makeAuthority()}
        onExportResult={onExportResult}
      />
    );

    await act(async () => {
      fireEvent.click(view.getByTestId('ide-export-draft-download-v1'));
    });
    await waitFor(() => expect(onExportResult).toHaveBeenCalledTimes(1));
    expect(view.getByTestId('ide-export-derived-state').textContent).toBe('Downloaded unverified');

    const trustedRun: Parameters<typeof ExportSurface>[0]['verifyLastRun'] = {
      scenarioId: 'trusted-scenario',
      scenarioName: 'Trusted Scenario',
      runKind: 'verify',
      status: 'pass',
      deterministicHash: passVerify.hash,
      reportHash: passVerify.reportHash!,
      generatedAtIso: passVerify.ranAtIso!,
      schedule: 'combinational',
      meta: {
        circuitKind: 'combinational',
        clockingProtocol: null,
        samplePoint: 'steady-state',
        tick0Meaning: null,
        clockSignalName: null,
      },
      report: {
        vectors: [],
        inputsAtTick: {},
        inputsByVectorId: {},
        signalRoles: {},
        rows: [],
      } as NonNullable<Parameters<typeof ExportSurface>[0]['verifyLastRun']>['report'],
      waveform: [],
    };
    view.rerender(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="transition-project-source"
        verifyResult={passVerify}
        verifyLastRun={trustedRun}
        workflowAuthority={makeAuthority({ verifyResult: passVerify, exportHash: 'transition-current' })}
        onExportResult={onExportResult}
      />
    );

    const inspector = view.getByTestId('ide-export-package-inspector-v1');
    expect(inspector.getAttribute('data-export-verification-trust')).toBe('trusted');
    expect(inspector.getAttribute('data-export-action-state')).toBe('not-downloaded');
    expect(inspector.getAttribute('data-export-derived-state')).toBe('downloadable-trusted');
    expect(view.queryByTestId('ide-export-download-success')).toBeNull();
    expect(view.getByTestId('ide-export-file-browser').textContent).not.toContain('Ready');

    await act(async () => {
      fireEvent.click(view.getByTestId('ide-export-package-download-v1'));
    });
    await waitFor(() => expect(onExportResult).toHaveBeenCalledTimes(2));
    expect(inspector.getAttribute('data-export-derived-state')).toBe('downloaded-trusted');
    expect(inspector.getAttribute('data-export-package-state')).toBe('ready');
    expect(view.getByTestId('ide-export-file-browser').textContent).toContain('Ready');
  });

  it('states the package proof boundary once in the default workspace', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeAuthority()}
      />
    );
    const hero = getByTestId('ide-export-readiness-hero');
    expect(hero.querySelectorAll('[data-testid="ide-export-e0-boundary-summary"]')).toHaveLength(1);
  });

  it('keeps technical evidence out of the default flow until requested', () => {
    const { getByTestId, queryByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeAuthority()}
      />
    );
    expect(queryByTestId('ide-export-technical-dialog')).toBeNull();
    const hero = getByTestId('ide-export-readiness-hero');
    // This used to assert that the hero contained no <details> at all, which was a proxy
    // for "nothing technical unfolds in the default flow" — true only because the surface
    // had no disclosures at the time. Provenance is now a disclosure precisely so that it
    // stops occupying the top of the surface, so the tag-name proxy would forbid the
    // improvement it was written to protect. The behaviour itself is asserted directly:
    // nothing is expanded on arrival, and the technical evidence is not in the flow at all.
    expect([...hero.querySelectorAll('details')].filter((el) => el.hasAttribute('open'))).toHaveLength(0);
    expect(within(hero).queryByTestId('ide-export-gate-stack')).toBeNull();
    expect(within(hero).queryByTestId('ide-export-deterministic-checks')).toBeNull();
    fireEvent.click(getByTestId('ide-export-open-technical-evidence'));
    expect(getByTestId('ide-export-technical-dialog')).toBeTruthy();
  });

  it('puts gates and deterministic checks inside the technical evidence dialog', () => {
    const { getByTestId } = render(
      <ExportSurface
        project={baseMappedProject()}
        determinismHash="h1"
        workflowAuthority={makeAuthority()}
      />
    );
    fireEvent.click(getByTestId('ide-export-open-technical-evidence'));
    const dialog = getByTestId('ide-export-technical-dialog');
    expect(within(dialog).getByTestId('ide-export-gate-stack')).toBeTruthy();
    expect(within(dialog).getByTestId('ide-export-deterministic-checks')).toBeTruthy();
  });
});
