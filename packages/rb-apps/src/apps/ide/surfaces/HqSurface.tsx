import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IdeButton, IdeCallout, IdePanel, IdeStatusPill } from '../components/IdePrimitives';
import {
  generateMarcusCodingPlan,
  getHqBenchEvidence,
  getHqHealth,
  getHqSnapshot,
  listHqPackets,
  readHqPacket,
  runMemorySearch,
  runProblemIntake,
  runTraceClaim,
  sendMarcusChat,
} from './hq/hqClient';
import type {
  HqBenchEvidence,
  HqChatMessage,
  HqChatMode,
  HqHealth,
  HqPacket,
  HqPacketHeader,
  HqSnapshot,
  HqSourceConfidence,
  HqSourceRecord,
  HqEvidenceLevel,
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

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [nextHealth, nextSnapshot, nextEvidence] = await Promise.all([
        getHqHealth(),
        getHqSnapshot(),
        getHqBenchEvidence(),
      ]);
      setHealth(nextHealth);
      setSnapshot(nextSnapshot);
      setEvidence(nextEvidence);
      setBackendOnline(true);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
      setError(message);
      setBackendOnline(false);
    }
    void loadPackets();
  }, [loadPackets]);

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
    [allowTools, messages, mode],
  );

  const runAction = useCallback(
    async (type: 'problem' | 'trace' | 'memory' | 'coding-plan') => {
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
    },
    [chatInput, loadPackets],
  );

  const selectPacket = useCallback(async (id: string) => {
    try {
      const result = await readHqPacket(id);
      setSelectedPacket(result.packet);
    } catch {
      // non-fatal
    }
  }, []);

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
            <p className="hq-copy">Run folder: {evidence?.run_folder || 'unavailable'}</p>
            <div className="hq-target-list">
              {(evidence?.targets || []).slice(0, 4).map((target) => (
                <div key={target.target_id} className="hq-target-row">
                  <span>{target.target_id}</span>
                  <span>{target.evidence_level}</span>
                  <span>{target.observed_behavior_status}</span>
                </div>
              ))}
            </div>
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
              <div className="hq-packet-preview" data-testid="hq-packet-preview">
                <p className="hq-copy"><strong>{selectedPacket.title}</strong></p>
                <p className="hq-copy">{selectedPacket.summary || selectedPacket.reply.slice(0, 240)}</p>
                {selectedPacket.generatedFiles.length > 0 && (
                  <p className="hq-copy" data-testid="hq-packet-preview-files">
                    <strong>Generated:</strong> {selectedPacket.generatedFiles.join(', ')}
                  </p>
                )}
                {selectedPacket.sources.length > 0 && (
                  <p className="hq-copy">
                    <strong>Sources:</strong> {selectedPacket.sources.map((s) => s.title).join(', ')}
                  </p>
                )}
                <IdeButton tone="ghost" onClick={() => setSelectedPacket(null)}>Close</IdeButton>
              </div>
            ) : null}
          </IdePanel>
        </div>
      </div>
    </div>
  );
};
