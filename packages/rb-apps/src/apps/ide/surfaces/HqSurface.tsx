import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IdeButton, IdeCallout, IdePanel, IdeStatusPill } from '../components/IdePrimitives';
import {
  getHqBenchEvidence,
  getHqHealth,
  getHqSnapshot,
  runMemorySearch,
  runProblemIntake,
  runTraceClaim,
  sendMarcusChat,
} from './hq/hqClient';
import type { HqBenchEvidence, HqChatMessage, HqHealth, HqSnapshot } from './hq/hqTypes';
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
  const [messages, setMessages] = useState<HqChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Marcus online. I protect RedByte truth boundaries: E2 is not E3, Map Pins is not Verify proof, Draft Export is not Trusted Export.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offline = !health || !health.agent.ollama_online;

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
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
      setError(message);
    }
  }, []);

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
        const response = await sendMarcusChat(text, history);
        setMessages((current) => [...current, { role: 'assistant', content: response.reply }]);
      } catch (chatError) {
        const message = chatError instanceof Error ? chatError.message : String(chatError);
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            content: 'Marcus could not reach the HQ backend. Start pnpm rb:hq:server and try again.',
          },
        ]);
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [messages],
  );

  const runAction = useCallback(
    async (type: 'problem' | 'trace' | 'memory') => {
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
    },
    [chatInput],
  );

  const evidenceCounts = evidence?.counts ?? { E0: 0, E1: 0, E2: 0, E3: 0 };

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
          <IdeStatusPill tone={offline ? 'warn' : 'ok'} testId="hq-ollama-status">
            {offline ? 'OLLAMA OFFLINE' : 'OLLAMA ONLINE'}
          </IdeStatusPill>
          <IdeButton tone="secondary" onClick={() => void refresh()} testId="hq-refresh">
            Refresh HQ
          </IdeButton>
        </div>
      </div>

      {error ? (
        <IdeCallout tone="warn" title="HQ connectivity" testId="hq-connectivity-callout">
          {error}
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
        </div>
      </div>
    </div>
  );
};
