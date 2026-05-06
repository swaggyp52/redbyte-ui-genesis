// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { HqSurface } from '../surfaces/HqSurface';

const hqClientMocks = vi.hoisted(() => ({
  mockGetHqHealth: vi.fn(),
  mockGetHqSnapshot: vi.fn(),
  mockGetHqBenchEvidence: vi.fn(),
  mockGetHqBenchTimeline: vi.fn(),
  mockSendMarcusChat: vi.fn(),
  mockRunProblemIntake: vi.fn(),
  mockRunTraceClaim: vi.fn(),
  mockRunMemorySearch: vi.fn(),
  mockGenerateMarcusCodingPlan: vi.fn(),
  mockListHqPackets: vi.fn(),
  mockReadHqPacket: vi.fn(),
  mockListHqPatchProposals: vi.fn(),
  mockReadHqPatchProposal: vi.fn(),
  mockDraftHqPatchProposal: vi.fn(),
  mockListHqSessionEvents: vi.fn(),
  mockListHqTasks: vi.fn(),
  mockReadHqTask: vi.fn(),
  mockPromoteHqPacketToTask: vi.fn(),
  mockUpdateHqTaskStatus: vi.fn(),
}));

vi.mock('../surfaces/hq/hqClient', () => ({
  getHqHealth: hqClientMocks.mockGetHqHealth,
  getHqSnapshot: hqClientMocks.mockGetHqSnapshot,
  getHqBenchEvidence: hqClientMocks.mockGetHqBenchEvidence,
  getHqBenchTimeline: hqClientMocks.mockGetHqBenchTimeline,
  sendMarcusChat: hqClientMocks.mockSendMarcusChat,
  runProblemIntake: hqClientMocks.mockRunProblemIntake,
  runTraceClaim: hqClientMocks.mockRunTraceClaim,
  runMemorySearch: hqClientMocks.mockRunMemorySearch,
  generateMarcusCodingPlan: hqClientMocks.mockGenerateMarcusCodingPlan,
  listHqPackets: hqClientMocks.mockListHqPackets,
  readHqPacket: hqClientMocks.mockReadHqPacket,
  listHqPatchProposals: hqClientMocks.mockListHqPatchProposals,
  readHqPatchProposal: hqClientMocks.mockReadHqPatchProposal,
  draftHqPatchProposal: hqClientMocks.mockDraftHqPatchProposal,
  listHqSessionEvents: hqClientMocks.mockListHqSessionEvents,
  listHqTasks: hqClientMocks.mockListHqTasks,
  readHqTask: hqClientMocks.mockReadHqTask,
  promoteHqPacketToTask: hqClientMocks.mockPromoteHqPacketToTask,
  updateHqTaskStatus: hqClientMocks.mockUpdateHqTaskStatus,
}));

const packetHeader = {
  id: 'pkt-1',
  createdAt: '2026-05-06T12:00:00.000Z',
  type: 'coding_plan',
  title: 'Proof closure plan',
  evidenceLevel: 'E2',
  sourceConfidence: 'high',
  warningCount: 1,
  generatedFileCount: 1,
  degraded: false,
};

const fullPacket = {
  ...packetHeader,
  summary: 'Plan proof closure without overstating E3.',
  prompt: 'Why is proof closure blocked?',
  reply: 'Proof closure is blocked until manual E3 observation is recorded.',
  mode: 'coding-plan',
  toolsUsed: [{ name: 'control_next', ok: true, summary: 'blocked by E3' }],
  sources: [
    {
      id: 'truth-doc',
      kind: 'repo_doc',
      title: 'Current Truth',
      path: 'docs/product/RED_BYTE_CURRENT_TRUTH.md',
      excerpt: 'Proof closure remains blocked on manual board observation.',
      freshness: 'current',
      authority: 'canonical',
    },
  ],
  generatedFiles: ['.redbyte/agent/runs/hq/marcus-coding-plan-latest.md'],
  warnings: ['Manual E3 observation still required.'],
  requiresApproval: true,
  recommendedAction: 'Capture bench evidence before closing proof.',
};

const taskHeader = {
  id: 'task-1',
  createdAt: '2026-05-06T12:05:00.000Z',
  updatedAt: '2026-05-06T12:05:00.000Z',
  title: 'Proof closure plan',
  status: 'candidate',
  sourcePacketId: 'pkt-1',
  productArea: 'Verify / Evidence',
  evidenceLevel: 'E2',
  sourceConfidence: 'high',
  blockerCount: 1,
};

const fullTask = {
  ...taskHeader,
  summary: 'Plan proof closure without overstating E3.',
  recommendedAction: 'Capture manual E3 evidence before marking proof closure done.',
  blockers: ['Manual E3 observation still required.'],
  doNotTouch: ['Do not write to Obsidian from Marcus v1.'],
  tests: ['pnpm rb:bench:evidence:classify'],
  codexPrompt: 'Codex: inspect proof closure blockers and do not overstate E3.',
  generatedFiles: ['.redbyte/agent/runs/hq/marcus-coding-plan-latest.md'],
  sources: fullPacket.sources,
};

const proposalHeader = {
  id: 'patch-proposal-1',
  createdAt: '2026-05-06T12:10:00.000Z',
  title: 'Export diagnostics proposal',
  sourceTaskId: 'task-1',
  sourcePacketId: 'pkt-1',
  targetFileCount: 1,
  riskCount: 1,
  requiresApproval: true,
  applyStatus: 'proposal_only',
  generatedFiles: ['.redbyte/agent/runs/hq/patch-proposals/patch-proposal-1.json'],
};

const fullProposal = {
  ...proposalHeader,
  productProblem: 'Export diagnostics need a focused implementation plan.',
  targetFiles: ['packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx'],
  codeFindings: [
    {
      path: 'packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx',
      reason: 'Matched ExportSurface search.',
      snippet: 'Export diagnostics',
    },
  ],
  proposedChanges: ['Update Export diagnostics copy only after Codex review.'],
  patchSketch: 'Proposal only. No patch has been applied.',
  risks: ['Do not touch Verify trust logic.'],
  doNotTouch: ['Do not write to Obsidian.', 'Do not modify files from Marcus.'],
  tests: ['pnpm rb:hq:test'],
  validationCommands: ['pnpm rb:hq:test', 'pnpm --filter @redbyte/playground build'],
  evidenceSources: fullPacket.sources,
  generatedFiles: ['.redbyte/agent/runs/hq/patch-proposals/patch-proposal-1.json', '.redbyte/agent/runs/hq/patch-proposals/patch-proposal-1.md'],
  requiresApproval: true,
  applyStatus: 'proposal_only',
  codexPrompt: 'Codex implements only after approval.',
};

function primeHealthyMocks() {
  hqClientMocks.mockGetHqHealth.mockResolvedValue({
    status: 'ok',
    server: { host: '127.0.0.1', port: 4255, repo_root: 'repo' },
    agent: { name: 'Marcus', model: 'qwen', ollama_base_url: 'http://localhost:11434', ollama_online: true },
    memory: { allow_obsidian_writes: false, index_available: true, chunk_count: 1, embedded_chunk_count: 0 },
    git: { clean: true, status_short: '', latest_commit: 'abc' },
  });

  hqClientMocks.mockGetHqSnapshot.mockResolvedValue({
    generated_at: new Date().toISOString(),
    blocked_task: 'blocked',
    bench_evidence: { available: true },
    claims_trace_summary: { proven: 3 },
    control_next: { recommended_next_product_slice: 'slice', why_this_task_matters: 'because' },
  });

  hqClientMocks.mockGetHqBenchEvidence.mockResolvedValue({
    available: true,
    counts: { E0: 0, E1: 0, E2: 1, E3: 0 },
    targets: [],
  });

  hqClientMocks.mockGetHqBenchTimeline.mockResolvedValue({
    ok: true,
    timeline: {
      available: true,
      runs: [
        {
          runFolder: '.redbyte/bench/runs/fixture',
          generatedAt: '2026-05-06T00:00:00.000Z',
          targetCount: 1,
          counts: { E0: 0, E1: 0, E2: 1, E3: 0 },
          warningClasses: { 'observation blocker': 1 },
          hasClassification: true,
        },
      ],
      targets: [
        {
          target_id: 'two-bit-counter',
          evidence_level: 'E2',
          observed_behavior_status: 'manual pending',
          warning_classes: ['observation blocker'],
        },
      ],
      counts: { E0: 0, E1: 0, E2: 2, E3: 0 },
      warningClasses: { 'observation blocker': 1 },
      latestRunFolder: '.redbyte/bench/runs/fixture',
      currentBlockerSummary: '2 target observation records still need manual E3 review.',
      manualObservationNeededCount: 2,
    },
  });

  hqClientMocks.mockListHqPackets.mockResolvedValue({ ok: true, packets: [], total: 0 });
  hqClientMocks.mockReadHqPacket.mockResolvedValue({ ok: true, packet: fullPacket });
  hqClientMocks.mockListHqPatchProposals.mockResolvedValue({ ok: true, proposals: [], total: 0 });
  hqClientMocks.mockReadHqPatchProposal.mockResolvedValue({ ok: true, proposal: fullProposal });
  hqClientMocks.mockDraftHqPatchProposal.mockResolvedValue({
    ok: true,
    proposal: fullProposal,
    generatedFiles: fullProposal.generatedFiles,
    requiresApproval: true,
    applyStatus: 'proposal_only',
    packetId: 'proposal-packet-1',
  });
  hqClientMocks.mockListHqSessionEvents.mockResolvedValue({ ok: true, events: [], total: 0 });
  hqClientMocks.mockListHqTasks.mockResolvedValue({ ok: true, tasks: [], total: 0 });
  hqClientMocks.mockReadHqTask.mockResolvedValue({ ok: true, task: fullTask });
  hqClientMocks.mockPromoteHqPacketToTask.mockResolvedValue({ ok: true, task: fullTask });
  hqClientMocks.mockUpdateHqTaskStatus.mockResolvedValue({ ok: true, task: { ...fullTask, status: 'ready' } });
}

describe('HqSurface workstation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    primeHealthyMocks();
    hqClientMocks.mockSendMarcusChat.mockResolvedValue({
      ok: true,
      degraded: false,
      reply: 'tool-assisted response',
      toolsUsed: [{ name: 'control_next', ok: true, summary: 'ok' }],
      sourceConfidence: 'high',
      evidenceLevel: 'E2',
      warnings: ['fallback warning'],
      generatedFiles: ['.redbyte/agent/runs/hq/marcus-coding-plan-latest.md'],
      recommendedNextAction: 'run tests',
      requiresApproval: true,
      sources: [
        {
          id: 'truth-doc',
          kind: 'repo_doc',
          title: 'Current Truth',
          path: 'docs/product/RED_BYTE_CURRENT_TRUTH.md',
          excerpt: 'Proof closure remains blocked on manual board observation.',
          freshness: 'current',
          authority: 'canonical',
        },
      ],
    });
    hqClientMocks.mockGenerateMarcusCodingPlan.mockResolvedValue({
      ok: true,
      reply: 'plan ready',
      toolsUsed: [{ name: 'generate_codex_packet', ok: true, summary: 'packet generated' }],
      generatedFiles: ['.redbyte/agent/runs/hq/marcus-coding-plan-latest.md'],
      recommendedNextAction: 'review packet',
      requiresApproval: true,
      warnings: [],
    });
    hqClientMocks.mockRunProblemIntake.mockResolvedValue({ ok: true });
    hqClientMocks.mockRunTraceClaim.mockResolvedValue({ ok: true });
    hqClientMocks.mockRunMemorySearch.mockResolvedValue({ ok: true });
  });

  it('renders mode selector and trust boundary copy without overstating E3', async () => {
    const { getByTestId, getByText, queryByText } = render(<HqSurface />);

    await waitFor(() => expect(getByTestId('hq-mode-selector')).toBeTruthy());
    expect(getByTestId('hq-mode-selector')).toBeTruthy();
    expect(getByText(/E2 board programming is not E3 observed behavior/i)).toBeTruthy();
    expect(queryByText(/E3 proven/i)).toBeNull();
  });

  it('shows tools used and warnings after chat response', async () => {
    const { getByTestId, getByText } = render(<HqSurface />);

    await waitFor(() => expect(getByTestId('hq-chat-input')).toBeTruthy());
    fireEvent.change(getByTestId('hq-chat-input'), { target: { value: 'status' } });
    fireEvent.click(getByTestId('hq-send-chat'));

    await waitFor(() => expect(getByTestId('hq-meta').textContent).toContain('control_next'));
    expect(getByTestId('hq-warnings').textContent).toContain('fallback warning');
    expect(getByTestId('hq-generated-files').textContent).toContain('marcus-coding-plan-latest.md');
    expect(getByTestId('hq-sources').textContent).toContain('Current Truth');
    expect(getByTestId('hq-source-confidence').textContent).toContain('high');
    expect(getByTestId('hq-evidence-level').textContent).toContain('E2');
    expect(getByText(/run tests/i)).toBeTruthy();
  });

  it('renders degraded fallback source when reply is degraded', async () => {
    hqClientMocks.mockSendMarcusChat.mockResolvedValueOnce({
      ok: true,
      degraded: true,
      reply: 'fallback reply',
      toolsUsed: [],
      warnings: ['No tools were used; answer may be less grounded.'],
      sources: [
        {
          id: 'fallback-1',
          kind: 'fallback',
          title: 'Fallback reasoning',
          path: null,
          excerpt: 'Marcus used degraded local reasoning.',
          freshness: 'unknown',
          authority: 'fallback',
        },
      ],
      sourceConfidence: 'degraded',
      evidenceLevel: 'E0',
      generatedFiles: [],
      recommendedNextAction: 'Start Ollama',
      requiresApproval: false,
    });

    const { getByTestId } = render(<HqSurface />);

    await waitFor(() => expect(getByTestId('hq-chat-input')).toBeTruthy());
    fireEvent.change(getByTestId('hq-chat-input'), { target: { value: 'status' } });
    fireEvent.click(getByTestId('hq-send-chat'));

    await waitFor(() => expect(getByTestId('hq-sources').textContent).toContain('Fallback reasoning'));
    expect(getByTestId('hq-source-confidence').textContent).toContain('degraded');
    expect(getByTestId('hq-evidence-level').textContent).toContain('E0');
  });

  it('shows offline hint when backend fetch fails', async () => {
    hqClientMocks.mockGetHqHealth.mockRejectedValueOnce(new Error('Failed to fetch'));
    const { findByTestId, getByText } = render(<HqSurface />);

    const callout = await findByTestId('hq-connectivity-callout');
    expect(callout.textContent).toContain('Failed to fetch');
    expect(getByText(/pnpm rb:marcus:start/i)).toBeTruthy();
    expect(getByText(/pnpm rb:hq:server/i)).toBeTruthy();
  });

  it('coding plan action calls coding-plan client endpoint', async () => {
    const { getByTestId } = render(<HqSurface />);

    await waitFor(() => expect(getByTestId('hq-coding-plan-btn')).toBeTruthy());
    fireEvent.click(getByTestId('hq-coding-plan-btn'));

    await waitFor(() => expect(hqClientMocks.mockGenerateMarcusCodingPlan).toHaveBeenCalledTimes(1));
  });

  it('does not expose Obsidian write action in HQ UI', async () => {
    const { queryByRole, queryByText } = render(<HqSurface />);

    await waitFor(() => expect(queryByText(/Obsidian writes: disabled/i)).toBeTruthy());
    expect(queryByText(/Write to Obsidian/i)).toBeNull();
    expect(queryByRole('button', { name: /Apply patch/i })).toBeNull();
  });

  it('renders packet detail with sources, generated files, approval, and prompt copy action', async () => {
    hqClientMocks.mockListHqPackets.mockResolvedValueOnce({ ok: true, packets: [packetHeader], total: 1 });
    const { getByTestId } = render(<HqSurface />);

    await waitFor(() => expect(getByTestId('hq-packet-row-pkt-1')).toBeTruthy());
    fireEvent.click(getByTestId('hq-packet-row-pkt-1'));

    await waitFor(() => expect(getByTestId('hq-packet-detail')).toBeTruthy());
    expect(getByTestId('hq-packet-approval-badge').textContent).toContain('approval required');
    expect(getByTestId('hq-packet-detail-prompt').textContent).toContain('Why is proof closure blocked?');
    expect(getByTestId('hq-packet-detail-reply').textContent).toContain('manual E3 observation');
    expect(getByTestId('hq-packet-detail-files').textContent).toContain('marcus-coding-plan-latest.md');
    expect(getByTestId('hq-packet-detail-sources').textContent).toContain('canonical');
    expect(getByTestId('hq-packet-detail-sources').textContent).toContain('current');
    expect(getByTestId('hq-copy-codex-prompt')).toBeTruthy();
  });

  it('promotes a selected packet into the operator queue', async () => {
    hqClientMocks.mockListHqPackets.mockResolvedValueOnce({ ok: true, packets: [packetHeader], total: 1 });
    const { getByTestId } = render(<HqSurface />);

    await waitFor(() => expect(getByTestId('hq-packet-row-pkt-1')).toBeTruthy());
    fireEvent.click(getByTestId('hq-packet-row-pkt-1'));
    await waitFor(() => expect(getByTestId('hq-promote-packet')).toBeTruthy());
    fireEvent.click(getByTestId('hq-promote-packet'));

    await waitFor(() => expect(hqClientMocks.mockPromoteHqPacketToTask).toHaveBeenCalledWith('pkt-1'));
    expect(getByTestId('hq-task-detail').textContent).toContain('Proof closure plan');
    expect(getByTestId('hq-task-codex-prompt').textContent).toContain('do not overstate E3');
  });

  it('renders operator queue task details and supports status update', async () => {
    hqClientMocks.mockListHqTasks.mockResolvedValue({ ok: true, tasks: [taskHeader], total: 1 });
    const { getByTestId, getByText } = render(<HqSurface />);

    await waitFor(() => expect(getByTestId('hq-task-row-task-1')).toBeTruthy());
    fireEvent.click(getByTestId('hq-task-row-task-1'));

    await waitFor(() => expect(getByTestId('hq-task-detail')).toBeTruthy());
    expect(getByTestId('hq-task-detail').textContent).toContain('Verify / Evidence');
    expect(getByTestId('hq-task-detail').textContent).toContain('Manual E3 observation');
    fireEvent.click(getByText('ready'));
    await waitFor(() => expect(hqClientMocks.mockUpdateHqTaskStatus).toHaveBeenCalledWith('task-1', 'ready'));
  });

  it('renders bench timeline status without overstating E3', async () => {
    const { getByTestId, queryByText } = render(<HqSurface />);

    await waitFor(() => expect(getByTestId('hq-bench-timeline-counts')).toBeTruthy());
    expect(getByTestId('hq-bench-latest-run').textContent).toContain('.redbyte/bench/runs/fixture');
    expect(getByTestId('hq-bench-timeline-counts').textContent).toContain('E2');
    expect(getByTestId('hq-bench-timeline-counts').textContent).toContain('E3');
    expect(getByTestId('hq-bench-manual-needed').textContent).toContain('2');
    expect(getByTestId('hq-bench-timeline-targets').textContent).toContain('manual pending');
    expect(queryByText(/E3 proven/i)).toBeNull();
  });

  it('renders patch proposals panel and proposal-only preview', async () => {
    hqClientMocks.mockListHqPatchProposals.mockResolvedValue({ ok: true, proposals: [proposalHeader], total: 1 });
    const { getByTestId, queryByRole } = render(<HqSurface />);

    await waitFor(() => expect(getByTestId('hq-patch-proposals-panel')).toBeTruthy());
    await waitFor(() => expect(getByTestId('hq-patch-proposal-row-patch-proposal-1')).toBeTruthy());
    fireEvent.click(getByTestId('hq-patch-proposal-row-patch-proposal-1'));

    await waitFor(() => expect(getByTestId('hq-patch-proposal-detail')).toBeTruthy());
    expect(getByTestId('hq-patch-approval-badge').textContent).toContain('approval required');
    expect(getByTestId('hq-patch-proposal-only-badge').textContent).toContain('proposal only');
    expect(getByTestId('hq-patch-target-files').textContent).toContain('ExportSurface.tsx');
    expect(getByTestId('hq-patch-risks').textContent).toContain('Verify trust logic');
    expect(getByTestId('hq-patch-tests').textContent).toContain('pnpm rb:hq:test');
    expect(getByTestId('hq-patch-do-not-touch').textContent).toContain('Obsidian');
    expect(queryByRole('button', { name: /Apply patch/i })).toBeNull();
  });

  it('drafts patch proposal from selected task and packet', async () => {
    hqClientMocks.mockListHqTasks.mockResolvedValue({ ok: true, tasks: [taskHeader], total: 1 });
    hqClientMocks.mockListHqPackets.mockResolvedValue({ ok: true, packets: [packetHeader], total: 1 });
    const { getByTestId } = render(<HqSurface />);

    await waitFor(() => expect(getByTestId('hq-task-row-task-1')).toBeTruthy());
    fireEvent.click(getByTestId('hq-task-row-task-1'));
    await waitFor(() => expect(getByTestId('hq-draft-task-patch-proposal')).toBeTruthy());
    fireEvent.click(getByTestId('hq-draft-task-patch-proposal'));
    await waitFor(() => expect(hqClientMocks.mockDraftHqPatchProposal).toHaveBeenCalledWith({ taskId: 'task-1', packetId: null, rawRequest: undefined }));
    expect(getByTestId('hq-patch-proposal-detail').textContent).toContain('Export diagnostics proposal');

    fireEvent.click(getByTestId('hq-packet-row-pkt-1'));
    await waitFor(() => expect(getByTestId('hq-draft-packet-patch-proposal')).toBeTruthy());
    fireEvent.click(getByTestId('hq-draft-packet-patch-proposal'));
    await waitFor(() => expect(hqClientMocks.mockDraftHqPatchProposal).toHaveBeenCalledWith({ taskId: null, packetId: 'pkt-1', rawRequest: undefined }));
  });
});
