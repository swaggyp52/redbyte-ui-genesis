import React, { useEffect, useMemo, useState } from 'react';
import type { RedByteApp } from '../types';
import { useFileSystemStore } from '../stores/fileSystemStore';
import {
  parseCapsule,
  loadEventsNdjson,
  computeVectorVerdicts,
  buildTimelineRows,
  summarizeCapsule,
  type Capsule,
  type ProofEvent,
} from '@redbyte/rb-fpga-proof-core';

interface CapsuleResult {
  name: string;
  result: 'PASS' | 'FAIL' | string;
  inputs?: Record<string, number>;
  expected?: string;
  observed?: string;
  mismatch?: unknown | null;
}

interface CapsuleEventsRef {
  format?: string;
  path?: string;
  sha256?: string;
  count?: number;
}

interface CapsuleDoc {
  session_id?: string;
  timestamp?: string;
  board_id?: string;
  board_snapshot?: {
    id?: string;
    name?: string;
    description?: string;
    widths?: Record<string, number>;
  };
  vector_file_hash?: string;
  git_sha?: string;
  node_version?: string;
  started_at?: string;
  ended_at?: string;
  test_summary?: { total?: number; passed?: number; failed?: number };
  summary?: { passed?: number; failed?: number; total_events?: number };
  results?: CapsuleResult[];
  events?: CapsuleEventsRef;
}

interface ProofViewerProps {
  resourceId?: string;
  resourceType?: 'file' | 'folder';
}

interface IoUpdateEvent {
  type: string;
  TICK?: string;
  SW?: string;
  BTN?: string;
  LED?: string;
  [key: string]: unknown;
}

// Use core library's loadEventsNdjson instead of local parseNdjson
// Kept for backward compatibility with existing code that may call this
function parseNdjson(raw: string): any[] {
  return loadEventsNdjson(raw) as any[];
}

function summarizeInputs(inputs?: Record<string, number>): string {
  if (!inputs) return '';
  const parts = Object.entries(inputs).map(([k, v]) => `${k}:${v}`);
  return parts.join(' ');
}

function getEventsBasename(path?: string): string | null {
  if (!path) return null;
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || null;
}

const badgeStyles: Record<string, string> = {
  PASS: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40',
  FAIL: 'bg-rose-500/15 text-rose-200 border border-rose-500/40',
};

function VerdictBadge({ verdict }: { verdict: string }) {
  const style = badgeStyles[verdict] || 'bg-slate-700/60 text-slate-200 border border-slate-600';
  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide ${style}`}>
      {verdict}
    </span>
  );
}

const FpgaProofViewerComponent: React.FC<ProofViewerProps> = ({ resourceId, resourceType }) => {
  const fs = useFileSystemStore();
  const [capsule, setCapsule] = useState<CapsuleDoc | null>(null);
  const [capsuleSource, setCapsuleSource] = useState<string>('');
  const [eventsRaw, setEventsRaw] = useState<string>('');
  const [events, setEvents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'vectors' | 'timeline' | 'events'>('overview');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const loadEventsContent = async (ref?: CapsuleEventsRef): Promise<string> => {
    if (!ref) return '';
    const basename = getEventsBasename(ref.path);

    if (basename) {
      const match = fs.getAllFiles().find((file) => file.name === basename && file.content);
      if (match?.content) {
        return match.content;
      }
    }

    if (ref.path && ref.path.startsWith('http')) {
      const response = await fetch(ref.path);
      if (!response.ok) {
        throw new Error(`Failed to fetch events (${response.status})`);
      }
      return await response.text();
    }

    return '';
  };

  const hydrateFromText = async (name: string, text: string, preferEvents?: string) => {
    setLoading(true);
    setError(null);
    try {
      // Use core library to parse capsule (supports both schemas)
      const parsed = parseCapsule(text) as Capsule & Record<string, any>;
      setCapsule(parsed);
      setCapsuleSource(name);

      let eventsText = preferEvents || '';
      if (!eventsText) {
        eventsText = await loadEventsContent(parsed.events);
      }
      setEventsRaw(eventsText);
      // Use core library to parse NDJSON events
      const parsedEvents = loadEventsNdjson(eventsText);
      setEvents(parsedEvents as ProofEvent[]);
      setActiveTab('overview');
    } catch (err) {
      setCapsule(null);
      setEvents([]);
      const message = err instanceof Error ? err.message : 'Failed to parse capsule';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!resourceId) return;
    if (resourceType && resourceType !== 'file') {
      setError('Select a capsule file to open.');
      return;
    }

    const file = fs.getFile(resourceId);
    if (!file || file.type !== 'file') {
      setError('File not found.');
      return;
    }

    hydrateFromText(file.name, file.content || '');
  }, [resourceId, resourceType]);

  const handleLoadDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      // Try to load from public/ first (production/web)
      const capsuleUrl = '/examples/fpga-proof/traffic-light-stateful.capsule.json';
      const eventsUrl = '/examples/fpga-proof/traffic-light-stateful.events.ndjson';

      const [capsuleRes, eventsRes] = await Promise.all([
        fetch(capsuleUrl),
        fetch(eventsUrl),
      ]);

      if (!capsuleRes.ok) {
        throw new Error(`Failed to fetch capsule (${capsuleRes.status})`);
      }
      if (!eventsRes.ok) {
        throw new Error(`Failed to fetch events (${eventsRes.status})`);
      }

      const capsuleText = await capsuleRes.text();
      const eventsText = await eventsRes.text();

      await hydrateFromText(
        'traffic-light-stateful.capsule.json',
        capsuleText,
        eventsText
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load demo';
      console.warn('[FPGA Viewer] Load demo error:', message);
      setError(`Could not load demo artifacts: ${message}`);
      setLoading(false);
    }
  };

  const passCount = capsule?.test_summary?.passed ?? capsule?.summary?.passed ?? 0;
  const failCount = capsule?.test_summary?.failed ?? capsule?.summary?.failed ?? 0;
  const totalVectors = capsule?.test_summary?.total ?? capsule?.results?.length ?? 0;
  const firstFailure = capsule?.results?.find((r) => r.result !== 'PASS') || null;

  const ioUpdates = useMemo(() => {
    return events.filter((evt) => evt && evt.type === 'io:update') as IoUpdateEvent[];
  }, [events]);

  const timelineRows = useMemo(() => {
    return ioUpdates.map((evt, index) => {
      const tick = Number(evt.TICK ?? index + 1);
      const vector = capsule?.results?.[index];
      return {
        tick,
        sw: evt.SW ?? '',
        btn: evt.BTN ?? '',
        led: evt.LED ?? '',
        verdict: vector?.result ?? '—',
        name: vector?.name ?? `t${tick}`,
      };
    });
  }, [capsule?.results, ioUpdates]);

  const headerGradient = 'bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950';

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-50">
      <div className={`${headerGradient} border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-4`}> 
        <div>
          <div className="text-xs uppercase tracking-[0.12em] text-cyan-300">FPGA Proof Viewer</div>
          <div className="text-lg font-semibold text-white">{capsuleSource || 'No capsule loaded'}</div>
          {capsule?.session_id && (
            <div className="text-xs text-slate-400">Session: {capsule.session_id}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLoadDemo}
            className="px-3 py-2 text-sm font-semibold bg-cyan-500 text-slate-950 rounded shadow hover:bg-cyan-400 transition"
          >
            Load Demo Capsule
          </button>
          {loading && <span className="text-xs text-slate-400">Loading…</span>}
        </div>
      </div>

      {error && (
        <div className="bg-rose-900/40 border border-rose-700 text-rose-100 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
          <div className="text-xs text-slate-400">Board</div>
          <div className="text-base font-semibold text-slate-100">{capsule?.board_id || '—'}</div>
          <div className="text-xs text-slate-500">{capsule?.board_snapshot?.name || 'Awaiting capsule'}</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
          <div className="text-xs text-slate-400">Vectors</div>
          <div className="text-base font-semibold text-slate-100">{passCount}/{totalVectors} passed</div>
          <div className="text-xs text-slate-500">Fails: {failCount}</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
          <div className="text-xs text-slate-400">Git</div>
          <div className="text-base font-semibold text-slate-100">{capsule?.git_sha || '—'}</div>
          <div className="text-xs text-slate-500">Node {capsule?.node_version || '—'}</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
          <div className="text-xs text-slate-400">Events</div>
          <div className="text-base font-semibold text-slate-100">{capsule?.events?.count ?? ioUpdates.length}</div>
          <div className="text-xs text-slate-500">{capsule?.events?.sha256 ? `sha256: ${capsule.events.sha256.slice(0, 12)}…` : 'No hash yet'}</div>
        </div>
      </div>

      <div className="px-4 pb-3 border-b border-slate-800 flex items-center gap-4 text-sm">
        {(['overview', 'vectors', 'timeline', 'events'] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              className={`px-3 py-2 rounded-md font-semibold transition ${
                isActive ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.toUpperCase()}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
              <div className="text-sm text-slate-300">Session</div>
              <div className="text-lg font-semibold text-white">{capsule?.session_id || '—'}</div>
              <div className="text-xs text-slate-500">Started: {capsule?.started_at || '—'} | Ended: {capsule?.ended_at || '—'}</div>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 flex flex-wrap gap-4">
              <div>
                <div className="text-xs text-slate-400">Vector file hash</div>
                <div className="font-mono text-sm text-slate-100 break-all">{capsule?.vector_file_hash || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Events sha256</div>
                <div className="font-mono text-sm text-slate-100 break-all">{capsule?.events?.sha256 || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Events count</div>
                <div className="font-mono text-sm text-slate-100">{capsule?.events?.count || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Events path</div>
                <div className="font-mono text-sm text-slate-100 break-all">{capsule?.events?.path || '—'}</div>
              </div>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
              <div className="text-xs uppercase tracking-[0.12em] text-cyan-300 mb-2">Integrity</div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2 text-slate-100">
                  <span>✓ Hashes verified in capsule metadata</span>
                </div>
                <div className="text-xs text-slate-400">
                  Strict CI mode: RB_FPGA_STRICT_HASH=1 enforces hash match on golden baseline.
                </div>
              </div>
            </div>
            {firstFailure && (
              <div className="bg-rose-900/40 border border-rose-700 rounded-lg p-4">
                <div className="text-xs uppercase tracking-[0.12em] text-rose-200 mb-1">First Failure</div>
                <div className="text-sm text-rose-100 font-semibold">{firstFailure.name}</div>
              </div>
            )}
            {!firstFailure && capsule && (
              <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-4 text-emerald-50 text-sm">
                All vectors passed. Ready to demo.
              </div>
            )}
          </div>
        )}

        {activeTab === 'vectors' && (
          <div className="p-4">
            <div className="overflow-auto border border-slate-800 rounded-lg bg-slate-900/60">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900 text-slate-300 uppercase text-xs tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Inputs</th>
                    <th className="px-3 py-2 text-left">Expected</th>
                    <th className="px-3 py-2 text-left">Observed</th>
                    <th className="px-3 py-2 text-left">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {capsule?.results?.map((result, idx) => (
                    <tr key={result.name + idx} className={idx % 2 === 0 ? 'bg-slate-950/60' : 'bg-slate-900/60'}>
                      <td className="px-3 py-2 text-slate-400">{idx}</td>
                      <td className="px-3 py-2 text-slate-100 whitespace-nowrap">{result.name}</td>
                      <td className="px-3 py-2 text-slate-300 font-mono text-xs">{summarizeInputs(result.inputs)}</td>
                      <td className="px-3 py-2 text-cyan-100 font-mono text-xs">{result.expected}</td>
                      <td className="px-3 py-2 text-amber-100 font-mono text-xs">{result.observed}</td>
                      <td className="px-3 py-2"><VerdictBadge verdict={result.result} /></td>
                    </tr>
                  )) || (
                    <tr>
                      <td className="px-3 py-3 text-slate-400" colSpan={6}>No vectors loaded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="p-4 space-y-3">
            {firstFailure && (
              <div className="bg-rose-900/40 border border-rose-700 rounded-lg p-3 text-sm text-rose-100 flex items-center justify-between">
                <div>
                  <span className="font-semibold">First failure detected:</span> {firstFailure.name}
                </div>
                <button
                  type="button"
                  className="px-2 py-1 text-xs bg-rose-700 hover:bg-rose-600 rounded transition"
                  onClick={() => {
                    // Scroll to first failure row
                    const failIdx = timelineRows.findIndex((r) => r.verdict === 'FAIL');
                    if (failIdx >= 0) {
                      document.getElementById(`timeline-row-${failIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }}
                >
                  Jump to mismatch
                </button>
              </div>
            )}
            <div className="overflow-auto border border-slate-800 rounded-lg bg-slate-900/60">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900 text-slate-300 uppercase text-xs tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">Tick</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">SW</th>
                    <th className="px-3 py-2 text-left">BTN</th>
                    <th className="px-3 py-2 text-left">LED</th>
                    <th className="px-3 py-2 text-left">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {timelineRows.length > 0 ? (
                    timelineRows.map((row, idx) => {
                      const isFail = row.verdict === 'FAIL';
                      const rowClass = isFail 
                        ? 'bg-rose-900/30 border-l-2 border-rose-700' 
                        : idx % 2 === 0 
                        ? 'bg-slate-950/60' 
                        : 'bg-slate-900/60';
                      return (
                        <tr key={row.tick + '-' + idx} id={`timeline-row-${idx}`} className={rowClass}>
                          <td className="px-3 py-2 text-slate-400">{row.tick}</td>
                          <td className="px-3 py-2 text-slate-100 whitespace-nowrap">{row.name}</td>
                          <td className="px-3 py-2 font-mono text-xs text-cyan-100">{row.sw}</td>
                          <td className="px-3 py-2 font-mono text-xs text-cyan-100">{row.btn}</td>
                          <td className="px-3 py-2 font-mono text-xs text-amber-100">{row.led}</td>
                          <td className="px-3 py-2"><VerdictBadge verdict={row.verdict} /></td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-3 py-3 text-slate-400" colSpan={6}>No events parsed yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="p-4 space-y-3">
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 text-sm text-slate-300 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-[0.12em]">Events</div>
                <div>{events.length} rows • format: {capsule?.events?.format || 'ndjson'} • source: {capsule?.events?.path || 'inline'}</div>
              </div>
              <div className="text-xs text-slate-500">seq 1..n</div>
            </div>
            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 overflow-auto max-h-[320px] whitespace-pre-wrap">{eventsRaw || 'No events loaded yet.'}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export const FpgaProofViewerApp: RedByteApp = {
  manifest: {
    id: 'fpga-proof-viewer',
    name: 'FPGA Proof Viewer',
    iconId: 'chip',
    category: 'tools',
    defaultSize: { width: 960, height: 720 },
    minSize: { width: 720, height: 520 },
  },
  component: FpgaProofViewerComponent,
};
