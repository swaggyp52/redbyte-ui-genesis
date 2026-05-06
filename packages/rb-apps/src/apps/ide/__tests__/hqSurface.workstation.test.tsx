// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { HqSurface } from '../surfaces/HqSurface';

const hqClientMocks = vi.hoisted(() => ({
  mockGetHqHealth: vi.fn(),
  mockGetHqSnapshot: vi.fn(),
  mockGetHqBenchEvidence: vi.fn(),
  mockSendMarcusChat: vi.fn(),
  mockRunProblemIntake: vi.fn(),
  mockRunTraceClaim: vi.fn(),
  mockRunMemorySearch: vi.fn(),
  mockGenerateMarcusCodingPlan: vi.fn(),
}));

vi.mock('../surfaces/hq/hqClient', () => ({
  getHqHealth: hqClientMocks.mockGetHqHealth,
  getHqSnapshot: hqClientMocks.mockGetHqSnapshot,
  getHqBenchEvidence: hqClientMocks.mockGetHqBenchEvidence,
  sendMarcusChat: hqClientMocks.mockSendMarcusChat,
  runProblemIntake: hqClientMocks.mockRunProblemIntake,
  runTraceClaim: hqClientMocks.mockRunTraceClaim,
  runMemorySearch: hqClientMocks.mockRunMemorySearch,
  generateMarcusCodingPlan: hqClientMocks.mockGenerateMarcusCodingPlan,
}));

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
    const { queryByText } = render(<HqSurface />);

    await waitFor(() => expect(queryByText(/Obsidian writes: disabled/i)).toBeTruthy());
    expect(queryByText(/Write to Obsidian/i)).toBeNull();
  });
});
