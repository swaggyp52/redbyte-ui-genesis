import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IdeButton, IdeCallout, IdePanel, IdeStatusPill } from '../components/IdePrimitives';
import {
  draftHqPatchProposal,
  generateMarcusCodingPlan,
  getHqBenchEvidence,
  getHqBenchTimeline,
  getHqHealth,
  getHqSnapshot,
  listHqPackets,
  listHqPatchProposals,
  listHqSessionEvents,
  listHqTasks,
  promoteHqPacketToTask,
  readHqPacket,
  readHqPatchProposal,
  readHqTask,
  runMemorySearch,
  runProblemIntake,
  runTraceClaim,
  sendMarcusChat,
  updateHqTaskStatus,
} from './hq/hqClient';
import type {
  HqBenchEvidence,
  HqBenchTimeline,
  HqChatMessage,
  HqChatMode,
  HqHealth,
  HqPacket,
  HqPacketHeader,
  HqPatchProposal,
  HqPatchProposalHeader,
  HqSessionEvent,
  HqSnapshot,
  HqSourceConfidence,
  HqSourceRecord,
  HqEvidenceLevel,
  HqTask,
  HqTaskHeader,
  HqTaskStatus,
} from './hq/hqTypes';
import type { IdeChromeContract } from '../chromeContract';

export const CHROME_CONTRACT = {
  surfaceId: 'hq',
  topStripSlots: ['command-bar'],
  leftDockPolicy: 'hidden',
  rightDockPolicy: 'hidden',
  exitPaths: [],
} satisfies IdeChromeContract;

const DEFAULT_QUICK_PROMPT = 'Explain current RedByte state and blockers in 6 bullets.';

export const HqSurface: React.FC = () => {
  const [health, setHealth] = useState<HqHealth | null>(null);
  const [snapshot, setSnapshot] = useState<HqSnapshot | null>(null);
  const [evidence, setEvidence] = useState<HqBenchEvidence | null>(null);
  const [benchTimeline, setBenchTimeline] = useState<HqBenchTimeline | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [messages, setMessages] = useState<HqChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Marcus online. I protect RedByte truth boundaries: E2 is not E3, Map Pins is not Verify proof, Draft Export is not Trusted Export.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [mode, setMode] = useState<HqChatMode>('ask');
  const [allowTools, setAllowTools] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolsUsed, setToolsUsed] = useState<Array<{ name: string; ok: boolean; summary: string }>>([]);
  const [sources, setSources] = useState<HqSourceRecord[]>([]);
  const [sourceConfidence, setSourceConfidence] = useState<HqSourceConfidence | null>(null);
  const [evidenceLevel, setEvidenceLevel] = useState<HqEvidenceLevel | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [generatedFiles, setGeneratedFiles] = useState<string[]>([]);
  const [nextAction, setNextAction] = useState<string>('Run Refresh HQ to capture current status.');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [latestPacketId, setLatestPacketId] = useState<string | null>(null);
  const [packets, setPackets] = useState<HqPacketHeader[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<HqPacket | null>(null);
  const [packetsLoading, setPacketsLoading] = useState(false);
  const [tasks, setTasks] = useState<HqTaskHeader[]>([]);
  const [selectedTask, setSelectedTask] = useState<HqTask | null>(null);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [patchProposals, setPatchProposals] = useState<HqPatchProposalHeader[]>([]);
  const [selectedPatchProposal, setSelectedPatchProposal] = useState<HqPatchProposal | null>(null);
  const [patchProposalLoading, setPatchProposalLoading] = useState(false);
  const [patchProposalError, setPatchProposalError] = useState<string | null>(null);
  const [sessionEvents, setSessionEvents] = useState<HqSessionEvent[]>([]);
  const [sessionLoading, setSessionLoading] = useState(false);

  const offline = !health || !health.agent.ollama_online;

  const loadPackets = useCallback(async () => {
    setPacketsLoading(true);
    try {
      const result = await listHqPackets({ limit: 20 });
      setPackets(result.packets);
    } catch {
      // packet load failure is non-fatal
    } finally {
      setPacketsLoading(false);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const result = await listHqTasks({ limit: 20 });
      setTasks(result.tasks);
    } catch {
      // task load failure is non-fatal
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const loadPatchProposals = useCallback(async () => {
    setPatchProposalLoading(true);
    try {
      const result = await listHqPatchProposals({ limit: 20 });
      setPatchProposals(result.proposals);
    } catch {
      // proposal load failure is non-fatal
    } finally {
      setPatchProposalLoading(false);
    }
  }, []);

  const loadSessionEvents = useCallback(async () => {
    setSessionLoading(true);
    try {
      const result = await listHqSessionEvents({ limit: 20 });
      setSessionEvents(result.events);
    } catch {
      // session load failure is non-fatal
    } finally {
      setSessionLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [nextHealth, nextSnapshot, nextEvidence, nextBenchTimeline] = await Promise.all([
        getHqHealth(),
        getHqSnapshot(),
        getHqBenchEvidence(),
        getHqBenchTimeline(),
      ]);
      setHealth(nextHealth);
      setSnapshot(nextSnapshot);
      setEvidence(nextEvidence);
      setBenchTimeline(nextBenchTimeline.timeline);
      setBackendOnline(true);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
      setError(message);
      setBackendOnline(false);
    }
    void loadPackets();
    void loadTasks();
    void loadPatchProposals();
    void loadSessionEvents();
  }, [loadPackets, loadPatchProposals, loadSessionEvents, loadTasks]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submitChat = useCallback(
    async (prompt: string) => {
      const text = prompt.trim();
      if (!text) return;
      setBusy(true);
      setError(null);

      setMessages((current) => [...current, { role: 'user', content: text }]);
      setChatInput('');

      try {
        const history = messages.slice(-8);
        const response = await sendMarcusChat(text, history, { mode, allowTools, maxToolCalls: 4 });
        setMessages((current) => [...current, { role: 'assistant', content: response.reply }]);
        setToolsUsed(response.toolsUsed || []);
        setSources(response.sources || []);
        setSourceConfidence(response.sourceConfidence || null);
        setEvidenceLevel(response.evidenceLevel || null);
        setWarnings(response.warnings || []);
        setGeneratedFiles(response.generatedFiles || []);
        setNextAction(response.recommendedNextAction || 'No next action provided.');
        setRequiresApproval(Boolean(response.requiresApproval));
        if (response.packetId) {
          setLatestPacketId(response.packetId);
          void loadPackets();
        }
        void loadTasks();
        void loadSessionEvents();
      } catch (chatError) {
        const message = chatError instanceof Error ? chatError.message : String(chatError);
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            content:
              'Marcus could not reach the HQ backend. Start pnpm rb:marcus:start (preferred) or pnpm rb:hq:server (fallback), then try again.',
          },
        ]);
        setError(message);
        setBackendOnline(false);
      } finally {
        setBusy(false);
      }
    },
    [allowTools, loadPackets, loadSessionEvents, loadTasks, messages, mode],
  );

  const runAction = useCallback(
    async (type: 'problem' | 'trace' | 'memory' | 'coding-plan' | 'patch-proposal') => {
      setBusy(true);
      setError(null);
      try {
        if (type === 'problem') {
          const response = await runProblemIntake(chatInput || 'Need concise product problem packet from current HQ state.');
          const text = response.ok
            ? 'Problem intake packet generated from HQ.'
            : `Problem intake failed: ${response.error || 'unknown error'}`;
          setMessages((current) => [...current, { role: 'assistant', content: text }]);
        } else if (type === 'trace') {
          const response = await runTraceClaim('E2 board programming is not E3 observed behavior.');
          const text = response.ok
            ? 'Claim trace command completed. Check latest trace report for details.'
            : `Claim trace failed: ${response.error || 'unknown error'}`;
          setMessages((current) => [...current, { role: 'assistant', content: text }]);
        } else if (type === 'coding-plan') {
          const response = await generateMarcusCodingPlan({
            raw_user_request: chatInput || 'Generate a coding plan from current HQ context.',
            target_surface: 'hq',
            urgency: 'normal',
            constraints: 'No arbitrary shell commands. No direct file edits by Marcus.',
          });
          const text = response.ok
            ? response.reply || 'Coding plan generated.'
            : `Coding plan failed: ${response.error || 'unknown error'}`;
          setMessages((current) => [...current, { role: 'assistant', content: text }]);
          setToolsUsed(response.toolsUsed || []);
          setSources(response.sources || []);
          setSourceConfidence(response.sourceConfidence || null);
          setEvidenceLevel(response.evidenceLevel || null);
          setWarnings(response.warnings || []);
          setGeneratedFiles(response.generatedFiles || []);
          setNextAction(response.recommendedNextAction || 'Review generated coding plan.');
          setRequiresApproval(Boolean(response.requiresApproval));
        } else if (type === 'patch-proposal') {
          const response = await draftHqPatchProposal({
            rawRequest: chatInput || 'Draft a proposal-only patch plan from current HQ context.',
          });
          setSelectedPatchProposal(response.proposal);
          setMessages((current) => [...current, { role: 'assistant', content: 'Patch proposal drafted. Review before Codex implementation.' }]);
          setGeneratedFiles(response.generatedFiles || []);
          setNextAction('Review proposal-only patch plan; Marcus did not edit files.');
          setRequiresApproval(true);
        } else {
          const response = await runMemorySearch(chatInput || 'RedByte current truth');
          const text = response.ok
            ? 'Memory search completed. Use output panel logs for details.'
            : `Memory search failed: ${response.error || 'unknown error'}`;
          setMessages((current) => [...current, { role: 'assistant', content: text }]);
        }
      } catch (commandError) {
        const message = commandError instanceof Error ? commandError.message : String(commandError);
        setError(message);
      } finally {
        setBusy(false);
      }
      // reload packets after any action
      void loadPackets();
      void loadTasks();
      void loadPatchProposals();
      void loadSessionEvents();
    },
    [chatInput, loadPackets, loadPatchProposals, loadSessionEvents, loadTasks],
  );

  const selectPacket = useCallback(async (id: string) => {
    try {
      const result = await readHqPacket(id);
      setSelectedPacket(result.packet);
    } catch {
      // non-fatal
    }
  }, []);

  const selectTask = useCallback(async (id: string) => {
    try {
      const result = await readHqTask(id);
      setSelectedTask(result.task);
      setTaskError(null);
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const promoteSelectedPacket = useCallback(async () => {
    if (!selectedPacket) return;
    setTaskError(null);
    try {
      const result = await promoteHqPacketToTask(selectedPacket.id);
      setSelectedTask(result.task);
      void loadTasks();
      void loadSessionEvents();
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : String(err));
    }
  }, [loadSessionEvents, loadTasks, selectedPacket]);

  const selectPatchProposal = useCallback(async (id: string) => {
    setPatchProposalError(null);
    try {
      const result = await readHqPatchProposal(id);
      setSelectedPatchProposal(result.proposal);
    } catch (err) {
      setPatchProposalError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const draftPatchProposal = useCallback(async (source: 'task' | 'packet' | 'chat') => {
    setPatchProposalError(null);
    try {
      const response = await draftHqPatchProposal({
        taskId: source === 'task' ? selectedTask?.id : null,
        packetId: source === 'packet' ? selectedPacket?.id : null,
        rawRequest: source === 'chat' ? chatInput : undefined,
      });
      setSelectedPatchProposal(response.proposal);
      setGeneratedFiles(response.generatedFiles || []);
      setRequiresApproval(true);
      void loadPatchProposals();
      void loadPackets();
      void loadSessionEvents();
    } catch (err) {
      setPatchProposalError(err instanceof Error ? err.message : String(err));
    }
  }, [chatInput, loadPackets, loadPatchProposals, loadSessionEvents, selectedPacket, selectedTask]);

  const setTaskStatus = useCallback(async (status: HqTaskStatus) => {
    if (!selectedTask) return;
    setTaskError(null);
    try {
      const result = await updateHqTaskStatus(selectedTask.id, status);
      setSelectedTask(result.task);
      void loadTasks();
      void loadSessionEvents();
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : String(err));
    }
  }, [loadSessionEvents, loadTasks, selectedTask]);

  const evidenceCounts = evidence?.counts ?? { E0: 0, E1: 0, E2: 0, E3: 0 };

  const sourceKindLabel: Record<HqSourceRecord['kind'], string> = {
    repo_doc: 'repo doc',
    obsidian_memory: 'memory',
    generated_run: 'generated run',
    bench_evidence: 'bench evidence',
    git_state: 'git state',
    tool_output: 'tool output',
    fallback: 'fallback',
  };

  const timelineItems = useMemo(() => {
    if (!snapshot) return [];
    return [
      snapshot.blocked_task,
      snapshot.control_next?.recommended_next_product_slice || 'Run control-next for recommendation',
      snapshot.control_next?.why_this_task_matters || 'Evidence and control outputs drive next slice selection.',
    ];
  }, [snapshot]);

  const relatedPacketEvents = useMemo(() => {
    if (!selectedPacket) return [];
    return sessionEvents.filter((event) => event.packetId === selectedPacket.id).slice(0, 6);
  }, [selectedPacket, sessionEvents]);

  const benchTimelineCounts = benchTimeline?.counts ?? evidenceCounts;
  const benchWarningClasses = Object.entries(benchTimeline?.warningClasses ?? {}).slice(0, 6);

  return (
    <div className="hq-surface" data-testid="hq-surface-root">
      <div className="hq-backdrop" aria-hidden="true" />

      <div className="hq-header">
        <div>
          <h2 className="hq-title">RedByte HQ</h2>
          <p className="hq-subtitle">Marcus local command center</p>
        </div>
        <div className="hq-header-actions">
          <IdeStatusPill tone={backendOnline ? 'ok' : 'warn'} testId="hq-backend-status">
            {backendOnline ? 'HQ BACKEND ONLINE' : 'HQ BACKEND OFFLINE'}
          </IdeStatusPill>
          <IdeStatusPill tone={offline ? 'warn' : 'ok'} testId="hq-ollama-status">
            {offline ? 'OLLAMA OFFLINE' : 'OLLAMA ONLINE'}
          </IdeStatusPill>
          <IdeStatusPill tone={allowTools ? 'ok' : 'warn'} testId="hq-tools-status">
            {allowTools ? 'TOOLS ENABLED' : 'TOOLS DISABLED'}
          </IdeStatusPill>
          <IdeButton tone="secondary" onClick={() => void refresh()} testId="hq-refresh">
            Refresh HQ
          </IdeButton>
        </div>
      </div>

      {error ? (
        <IdeCallout tone="warn" title="HQ connectivity" testId="hq-connectivity-callout">
          {error}
          <br />
          Start runtime: <code>pnpm rb:marcus:start</code> (preferred) or <code>pnpm rb:hq:server</code> (fallback if you only need backend serve).
        </IdeCallout>
      ) : null}

      <div className="hq-grid">
        <IdePanel
          title="Marcus Console"
          description="Local engineering intelligence"
          testId="hq-console-panel"
          className="hq-console-panel"
          actions={
            <div className="hq-console-actions">
              <label htmlFor="hq-mode" className="hq-copy">Mode</label>
              <select
                id="hq-mode"
                value={mode}
                onChange={(event) => setMode(event.target.value as HqChatMode)}
                data-testid="hq-mode-selector"
              >
                <option value="ask">Ask Marcus</option>
                <option value="explain-state">Explain Current State</option>
                <option value="problem-packet">Generate Problem Packet</option>
                <option value="trace-claim">Trace Claim</option>
                <option value="coding-plan">Coding Plan</option>
                <option value="patch-proposal">Patch Proposal</option>
              </select>
              <label htmlFor="hq-tools-toggle" className="hq-copy">Enable tools</label>
              <input
                id="hq-tools-toggle"
                type="checkbox"
                checked={allowTools}
                onChange={(event) => setAllowTools(event.target.checked)}
                data-testid="hq-tools-toggle"
              />
              <IdeButton tone="primary" onClick={() => void submitChat(chatInput)} disabled={busy} testId="hq-send-chat">
                Ask Marcus
              </IdeButton>
              <IdeButton tone="secondary" onClick={() => void submitChat(DEFAULT_QUICK_PROMPT)} disabled={busy}>
                Explain Current State
              </IdeButton>
              <IdeButton tone="secondary" onClick={() => void runAction('problem')} disabled={busy}>
                Generate Problem Packet
              </IdeButton>
              <IdeButton tone="secondary" onClick={() => void runAction('trace')} disabled={busy}>
                Trace Claim
              </IdeButton>
              <IdeButton tone="secondary" onClick={() => void runAction('coding-plan')} disabled={busy} testId="hq-coding-plan-btn">
                Coding Plan
              </IdeButton>
              <IdeButton tone="secondary" onClick={() => void runAction('patch-proposal')} disabled={busy} testId="hq-patch-proposal-btn">
                Patch Proposal
              </IdeButton>
            </div>
          }
        >
          <div className="hq-chat-log" data-testid="hq-chat-log">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`hq-chat-message hq-chat-${message.role}`}>
                <span className="hq-chat-role">{message.role === 'assistant' ? 'Marcus' : 'You'}</span>
                <p>{message.content}</p>
              </div>
            ))}
          </div>
          <div className="hq-chat-input-row">
            <input
              className="hq-chat-input"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Ask Marcus about product truth, evidence, or next action"
              data-testid="hq-chat-input"
            />
            <IdeButton tone="ghost" onClick={() => void runAction('memory')} disabled={busy}>
              Memory Search
            </IdeButton>
          </div>
          <div className="hq-meta" data-testid="hq-meta">
            <p className="hq-copy"><strong>Next action:</strong> {nextAction}</p>
            <p className="hq-copy"><strong>Approval required:</strong> {requiresApproval ? 'yes' : 'no'}</p>
            <p className="hq-copy"><strong>Last tools used:</strong> {toolsUsed.length ? toolsUsed.map((tool) => tool.name).join(', ') : 'none'}</p>
            <p className="hq-copy" data-testid="hq-source-confidence"><strong>Source confidence:</strong> {sourceConfidence || 'unknown'}</p>
            <p className="hq-copy" data-testid="hq-evidence-level"><strong>Evidence level:</strong> {evidenceLevel || 'unknown'}</p>
            <div className="hq-copy" data-testid="hq-sources">
              <strong>Sources:</strong>{' '}
              {sources.length ? (
                <span>
                  {sources.map((source) => `${source.title} (${sourceKindLabel[source.kind]}${source.path ? `: ${source.path}` : ''})`).join(' | ')}
                </span>
              ) : (
                <span>none</span>
              )}
            </div>
            {warnings.length ? <p className="hq-copy" data-testid="hq-warnings"><strong>Warnings:</strong> {warnings.join(' | ')}</p> : null}
            {generatedFiles.length ? (
              <p className="hq-copy" data-testid="hq-generated-files"><strong>Generated:</strong> {generatedFiles.join(', ')}</p>
            ) : null}
            {latestPacketId ? (
              <p className="hq-copy hq-saved-indicator" data-testid="hq-saved-indicator">
                <strong>Saved:</strong> packet {latestPacketId}
              </p>
            ) : null}
          </div>
        </IdePanel>

        <div className="hq-center-stack">
          <IdePanel title="Product Spine Status" testId="hq-spine-panel">
            <div className="hq-spine-strip" data-testid="hq-spine-strip">
              {['Project', 'Design', 'Verify', 'Map Pins', 'Export'].map((step) => (
                <div key={step} className="hq-spine-step">
                  <span>{step}</span>
                  <span className="hq-spine-dot" aria-hidden="true" />
                </div>
              ))}
            </div>
            <IdeCallout tone="info" title="Truth boundaries">
              E2 board programming is not E3 observed behavior. Map Pins assignment is not Verify proof. Draft Export is not Trusted Export.
            </IdeCallout>
          </IdePanel>

          <IdePanel title="Evidence Matrix" testId="hq-evidence-panel">
            <div className="hq-evidence-grid" data-testid="hq-evidence-grid">
              <div className="hq-evidence-cell"><strong>E0</strong><span>{evidenceCounts.E0}</span></div>
              <div className="hq-evidence-cell"><strong>E1</strong><span>{evidenceCounts.E1}</span></div>
              <div className="hq-evidence-cell"><strong>E2</strong><span>{evidenceCounts.E2}</span></div>
              <div className="hq-evidence-cell"><strong>E3</strong><span>{evidenceCounts.E3}</span></div>
            </div>
            <p className="hq-copy">E3 stays manual-required unless physical observation is recorded and marked promotable.</p>
          </IdePanel>

          <IdePanel title="Bench Intelligence" testId="hq-bench-panel">
            <p className="hq-copy" data-testid="hq-bench-latest-run">Latest run: {benchTimeline?.latestRunFolder || evidence?.run_folder || 'unavailable'}</p>
            <p className="hq-copy" data-testid="hq-bench-blocker-summary">
              {benchTimeline?.currentBlockerSummary || evidence?.message || 'Bench evidence unavailable locally.'}
            </p>
            <div className="hq-evidence-grid hq-evidence-grid--compact" data-testid="hq-bench-timeline-counts">
              <div className="hq-evidence-cell"><strong>E0</strong><span>{benchTimelineCounts.E0}</span></div>
              <div className="hq-evidence-cell"><strong>E1</strong><span>{benchTimelineCounts.E1}</span></div>
              <div className="hq-evidence-cell"><strong>E2</strong><span>{benchTimelineCounts.E2}</span></div>
              <div className="hq-evidence-cell"><strong>E3</strong><span>{benchTimelineCounts.E3}</span></div>
            </div>
            <p className="hq-copy" data-testid="hq-bench-manual-needed">
              Manual E3 needed: {benchTimeline?.manualObservationNeededCount ?? 0}
            </p>
            {benchWarningClasses.length ? (
              <div className="hq-chip-row" data-testid="hq-bench-warning-classes">
                {benchWarningClasses.map(([name, count]) => (
                  <span key={name} className="hq-small-chip">{name}: {count}</span>
                ))}
              </div>
            ) : null}
            <div className="hq-target-list" data-testid="hq-bench-timeline-targets">
              {(benchTimeline?.targets || evidence?.targets || []).slice(0, 4).map((target) => (
                <div key={target.target_id} className="hq-target-row">
                  <span>{target.target_id}</span>
                  <span>{target.evidence_level}</span>
                  <span>{target.observed_behavior_status}</span>
                </div>
              ))}
            </div>
            <div className="hq-target-list" data-testid="hq-bench-run-timeline">
              {(benchTimeline?.runs || []).slice(0, 4).map((run) => (
                <div key={run.runFolder} className="hq-target-row">
                  <span>{run.runFolder}</span>
                  <span>{run.targetCount} targets</span>
                  <span>E3 {run.counts.E3}</span>
                </div>
              ))}
            </div>
            <p className="hq-copy">E2 programming remains distinct from E3 observed behavior.</p>
          </IdePanel>
        </div>

        <div className="hq-right-stack">
          <IdePanel title="Memory / Obsidian Status" testId="hq-memory-panel">
            <p className="hq-copy">Index available: {health?.memory.index_available ? 'yes' : 'no'}</p>
            <p className="hq-copy">Chunks: {health?.memory.chunk_count ?? 0}</p>
            <p className="hq-copy">Embedded chunks: {health?.memory.embedded_chunk_count ?? 0}</p>
            <p className="hq-copy">Obsidian writes: disabled in v0</p>
          </IdePanel>

          <IdePanel title="Roadmap Timeline" testId="hq-roadmap-panel">
            <ul className="hq-timeline">
              {timelineItems.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </IdePanel>

          <IdePanel title="Claim Trace" testId="hq-claim-panel">
            <p className="hq-copy">Use Trace Claim to verify high-risk product statements against docs/code/tests.</p>
            <p className="hq-copy">Claims proven: {snapshot?.claims_trace_summary?.proven ?? 'n/a'}</p>
          </IdePanel>

          <IdePanel title="Operator Queue" testId="hq-operator-queue-panel">
            {taskError ? <p className="hq-copy hq-error-copy" data-testid="hq-task-error">{taskError}</p> : null}
            {tasksLoading ? (
              <p className="hq-copy" data-testid="hq-tasks-loading">Loading tasks...</p>
            ) : tasks.length === 0 ? (
              <p className="hq-copy" data-testid="hq-tasks-empty">No operator tasks yet. Select a packet and promote it.</p>
            ) : (
              <ul className="hq-task-list" data-testid="hq-task-list">
                {tasks.slice(0, 8).map((task) => (
                  <li
                    key={task.id}
                    className={`hq-task-row${selectedTask?.id === task.id ? ' hq-task-selected' : ''}`}
                    onClick={() => void selectTask(task.id)}
                    data-testid={`hq-task-row-${task.id}`}
                  >
                    <span className={`hq-task-status hq-task-status-${task.status}`}>{task.status.replace(/_/g, ' ')}</span>
                    <span className="hq-task-title">{task.title}</span>
                    <span className="hq-task-meta">{task.productArea} · {task.evidenceLevel} · {task.sourceConfidence}</span>
                    {task.blockerCount > 0 ? <span className="hq-packet-warn">{task.blockerCount} blockers</span> : null}
                  </li>
                ))}
              </ul>
            )}
            {selectedTask ? (
              <div className="hq-task-detail" data-testid="hq-task-detail">
                <p className="hq-copy"><strong>{selectedTask.title}</strong></p>
                <p className="hq-copy">Status: {selectedTask.status} · Area: {selectedTask.productArea}</p>
                <p className="hq-copy">{selectedTask.summary}</p>
                <p className="hq-copy"><strong>Recommended action:</strong> {selectedTask.recommendedAction}</p>
                {selectedTask.blockers.length ? (
                  <p className="hq-copy"><strong>Blockers:</strong> {selectedTask.blockers.join(' | ')}</p>
                ) : null}
                {selectedTask.tests.length ? (
                  <p className="hq-copy"><strong>Tests:</strong> {selectedTask.tests.join(' | ')}</p>
                ) : null}
                <div className="hq-chip-row">
                  <IdeButton tone="secondary" onClick={() => void draftPatchProposal('task')} testId="hq-draft-task-patch-proposal">
                    Draft Patch Proposal
                  </IdeButton>
                  {(['ready', 'blocked', 'in_progress', 'done', 'archived'] as HqTaskStatus[]).map((status) => (
                    <IdeButton key={status} tone="ghost" onClick={() => void setTaskStatus(status)}>
                      {status.replace(/_/g, ' ')}
                    </IdeButton>
                  ))}
                </div>
                {selectedTask.codexPrompt ? (
                  <pre className="hq-code-preview" data-testid="hq-task-codex-prompt">{selectedTask.codexPrompt}</pre>
                ) : null}
              </div>
            ) : null}
          </IdePanel>

          <IdePanel title="Patch Proposals" testId="hq-patch-proposals-panel">
            <p className="hq-copy">Proposal-only. Marcus does not modify files.</p>
            {patchProposalError ? <p className="hq-copy hq-error-copy" data-testid="hq-patch-proposal-error">{patchProposalError}</p> : null}
            <div className="hq-chip-row">
              <IdeButton tone="secondary" onClick={() => void draftPatchProposal('chat')} testId="hq-draft-chat-patch-proposal">
                Draft From Prompt
              </IdeButton>
            </div>
            {patchProposalLoading ? (
              <p className="hq-copy" data-testid="hq-patch-proposals-loading">Loading proposals...</p>
            ) : patchProposals.length === 0 ? (
              <p className="hq-copy" data-testid="hq-patch-proposals-empty">No patch proposals yet.</p>
            ) : (
              <ul className="hq-task-list" data-testid="hq-patch-proposal-list">
                {patchProposals.slice(0, 6).map((proposal) => (
                  <li
                    key={proposal.id}
                    className={`hq-task-row${selectedPatchProposal?.id === proposal.id ? ' hq-task-selected' : ''}`}
                    onClick={() => void selectPatchProposal(proposal.id)}
                    data-testid={`hq-patch-proposal-row-${proposal.id}`}
                  >
                    <span className="hq-approval-badge" data-testid="hq-proposal-only-badge">{proposal.applyStatus.replace(/_/g, ' ')}</span>
                    <span className="hq-task-title">{proposal.title}</span>
                    <span className="hq-task-meta">{proposal.targetFileCount} files · {proposal.riskCount} risks</span>
                    {proposal.requiresApproval ? <span className="hq-approval-badge">approval required</span> : null}
                  </li>
                ))}
              </ul>
            )}
            {selectedPatchProposal ? (
              <div className="hq-task-detail hq-patch-proposal-detail" data-testid="hq-patch-proposal-detail">
                <div className="hq-detail-header">
                  <p className="hq-copy"><strong>{selectedPatchProposal.title}</strong></p>
                  <span className="hq-approval-badge" data-testid="hq-patch-approval-badge">approval required</span>
                  <span className="hq-approval-badge" data-testid="hq-patch-proposal-only-badge">proposal only</span>
                </div>
                <p className="hq-copy">{selectedPatchProposal.productProblem}</p>
                <p className="hq-copy"><strong>Generated:</strong> {selectedPatchProposal.generatedFiles.join(', ')}</p>
                <div className="hq-packet-text-block" data-testid="hq-patch-target-files">
                  <strong>Target files</strong>
                  <pre>{selectedPatchProposal.targetFiles.join('\n') || 'No target files identified.'}</pre>
                </div>
                <div className="hq-packet-text-block" data-testid="hq-patch-proposed-changes">
                  <strong>Proposed changes</strong>
                  <pre>{selectedPatchProposal.proposedChanges.join('\n')}</pre>
                </div>
                <div className="hq-packet-text-block" data-testid="hq-patch-risks">
                  <strong>Risks</strong>
                  <pre>{selectedPatchProposal.risks.join('\n') || 'No risks listed.'}</pre>
                </div>
                <div className="hq-packet-text-block" data-testid="hq-patch-tests">
                  <strong>Tests / gates</strong>
                  <pre>{selectedPatchProposal.validationCommands.join('\n')}</pre>
                </div>
                <div className="hq-packet-text-block" data-testid="hq-patch-do-not-touch">
                  <strong>Do not touch</strong>
                  <pre>{selectedPatchProposal.doNotTouch.join('\n')}</pre>
                </div>
                <div className="hq-packet-text-block" data-testid="hq-patch-codex-prompt">
                  <strong>Codex prompt</strong>
                  <pre>{selectedPatchProposal.codexPrompt}</pre>
                </div>
              </div>
            ) : null}
          </IdePanel>

          <IdePanel title="Workbench History" testId="hq-workbench-history-panel">
            {packetsLoading ? (
              <p className="hq-copy" data-testid="hq-packets-loading">Loading packets...</p>
            ) : packets.length === 0 ? (
              <p className="hq-copy" data-testid="hq-packets-empty">No saved packets yet. Marcus outputs will appear here.</p>
            ) : (
              <ul className="hq-packet-list" data-testid="hq-packet-list">
                {packets.slice(0, 10).map((pkt) => (
                  <li
                    key={pkt.id}
                    className={`hq-packet-row${selectedPacket?.id === pkt.id ? ' hq-packet-selected' : ''}`}
                    onClick={() => void selectPacket(pkt.id)}
                    data-testid={`hq-packet-row-${pkt.id}`}
                  >
                    <span className="hq-packet-type-chip" data-testid="hq-packet-type">{pkt.type.replace(/_/g, ' ')}</span>
                    <span className="hq-packet-title" data-testid="hq-packet-title">{pkt.title}</span>
                    <span className="hq-packet-meta">
                      <span data-testid="hq-packet-evidence">{pkt.evidenceLevel}</span>
                      <span data-testid="hq-packet-confidence">{pkt.sourceConfidence}</span>
                      {pkt.warningCount > 0 && <span className="hq-packet-warn">{pkt.warningCount}⚠</span>}
                      {pkt.generatedFileCount > 0 && <span>{pkt.generatedFileCount}📄</span>}
                      {pkt.degraded && <span className="hq-packet-degraded">degraded</span>}
                    </span>
                    <span className="hq-packet-time">{new Date(pkt.createdAt).toLocaleTimeString()}</span>
                  </li>
                ))}
              </ul>
            )}
            {selectedPacket ? (
              <div className="hq-packet-preview hq-packet-detail" data-testid="hq-packet-detail">
                <div className="hq-detail-header">
                  <p className="hq-copy"><strong>{selectedPacket.title}</strong></p>
                  {selectedPacket.requiresApproval ? (
                    <span className="hq-approval-badge" data-testid="hq-packet-approval-badge">approval required</span>
                  ) : null}
                </div>
                <p className="hq-copy">Type: {selectedPacket.type.replace(/_/g, ' ')} · Evidence: {selectedPacket.evidenceLevel} · Confidence: {selectedPacket.sourceConfidence}</p>
                <p className="hq-copy" data-testid="hq-packet-detail-summary">{selectedPacket.summary || selectedPacket.reply.slice(0, 240)}</p>
                <div className="hq-packet-text-block" data-testid="hq-packet-detail-prompt">
                  <strong>Prompt</strong>
                  <pre>{selectedPacket.prompt || 'No prompt captured.'}</pre>
                </div>
                <div className="hq-packet-text-block" data-testid="hq-packet-detail-reply">
                  <strong>Reply</strong>
                  <pre>{selectedPacket.reply || 'No reply captured.'}</pre>
                </div>
                {selectedPacket.toolsUsed.length > 0 ? (
                  <p className="hq-copy" data-testid="hq-packet-detail-tools">
                    <strong>Tools:</strong> {selectedPacket.toolsUsed.map((tool) => `${tool.name}:${tool.ok ? 'ok' : 'fail'}`).join(', ')}
                  </p>
                ) : null}
                {selectedPacket.warnings.length > 0 ? (
                  <p className="hq-copy" data-testid="hq-packet-detail-warnings"><strong>Warnings:</strong> {selectedPacket.warnings.join(' | ')}</p>
                ) : null}
                {selectedPacket.generatedFiles.length > 0 && (
                  <p className="hq-copy" data-testid="hq-packet-detail-files">
                    <strong>Generated:</strong> {selectedPacket.generatedFiles.join(', ')}
                  </p>
                )}
                {selectedPacket.sources.length > 0 && (
                  <ul className="hq-source-preview-list" data-testid="hq-packet-detail-sources">
                    {selectedPacket.sources.slice(0, 8).map((source) => (
                      <li key={source.id}>
                        <strong>{source.title}</strong>
                        <span>{source.authority} · {source.freshness} · {sourceKindLabel[source.kind]}</span>
                        {source.path ? <code>{source.path}</code> : null}
                        {source.excerpt ? <p>{source.excerpt}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
                {relatedPacketEvents.length > 0 ? (
                  <div data-testid="hq-packet-related-events">
                    <p className="hq-copy"><strong>Related session events:</strong></p>
                    <ul className="hq-mini-list">
                      {relatedPacketEvents.map((event) => (
                        <li key={event.id}>{event.type.replace(/_/g, ' ')} · {event.title}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="hq-chip-row">
                  <IdeButton tone="secondary" onClick={() => void promoteSelectedPacket()} testId="hq-promote-packet">
                    Promote to Task
                  </IdeButton>
                  <IdeButton tone="secondary" onClick={() => void draftPatchProposal('packet')} testId="hq-draft-packet-patch-proposal">
                    Draft Patch Proposal
                  </IdeButton>
                  {(selectedPacket.type === 'coding_plan' || selectedPacket.prompt || selectedPacket.reply) ? (
                    <IdeButton
                      tone="ghost"
                      onClick={() => setChatInput(selectedPacket.prompt || selectedPacket.reply)}
                      testId="hq-copy-codex-prompt"
                    >
                      Copy Codex prompt
                    </IdeButton>
                  ) : null}
                  <IdeButton tone="ghost" onClick={() => setSelectedPacket(null)}>Close</IdeButton>
                </div>
              </div>
            ) : null}
          </IdePanel>

          <IdePanel title="Session Console" testId="hq-session-console-panel">
            <div className="hq-session-header">
              <IdeButton tone="ghost" onClick={() => void loadSessionEvents()} testId="hq-session-refresh">
                Refresh
              </IdeButton>
            </div>
            {sessionLoading ? (
              <p className="hq-copy" data-testid="hq-session-loading">Loading session events...</p>
            ) : sessionEvents.length === 0 ? (
              <p className="hq-copy" data-testid="hq-session-empty">No session events yet. Ask Marcus something to begin.</p>
            ) : (
              <ul className="hq-session-list" data-testid="hq-session-list">
                {sessionEvents.map((ev) => (
                  <li
                    key={ev.id}
                    className={`hq-session-row hq-session-severity-${ev.severity}`}
                    data-testid={`hq-session-row-${ev.type}`}
                  >
                    <span
                      className={`hq-session-severity-chip hq-session-severity-${ev.severity}`}
                      data-testid="hq-session-severity"
                    >
                      {ev.severity === 'success' ? '✓' : ev.severity === 'warn' ? '⚠' : ev.severity === 'error' ? '✕' : '·'}
                    </span>
                    <span className="hq-session-type" data-testid="hq-session-type">{ev.type.replace(/_/g, ' ')}</span>
                    <span className="hq-session-title" data-testid="hq-session-title">{ev.title}</span>
                    {ev.toolName && (
                      <span className="hq-session-chip" data-testid="hq-session-tool">{ev.toolName}</span>
                    )}
                    {ev.packetId && (
                      <span className="hq-session-chip hq-session-packet-chip" data-testid="hq-session-packet-id">pkt</span>
                    )}
                    {ev.degraded && (
                      <span className="hq-session-chip hq-session-degraded-chip" data-testid="hq-session-degraded">degraded</span>
                    )}
                    <span className="hq-session-time">{new Date(ev.createdAt).toLocaleTimeString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </IdePanel>
        </div>
      </div>
    </div>
  );
};
