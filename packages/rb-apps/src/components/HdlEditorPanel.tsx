import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getToolchainBackend,
  getToolchainBackendId,
  type BuildLogEntry,
  type ToolchainBackendId,
  type ToolchainPreflightStatus,
  type ToolProbeResult,
  type ToolchainProjectInput,
  type SynthRunDoneSummary,
  type SynthArtifactRef,
} from '../fpga/toolchainBackend';
import type { RBFpgaConfig } from '../export/projectFormat';
import { stableStringify } from '../export/stableStringify';
import { basys3XdcPresets, getBasys3XdcPresetText, type Basys3XdcPresetId } from '../fpga/boards/basys3/presets';
import { basys3TopModuleContract } from '../fpga/boards/basys3/basys3Contract';
import {
  basys3VerilogExamples,
  getBasys3VerilogExample,
  type Basys3ExampleId,
} from '../fpga/boards/basys3/examples';

interface HdlEditorPanelProps {
  project: ToolchainProjectInput;
  onProjectChange: (next: ToolchainProjectInput) => void;
  fpga?: RBFpgaConfig;
  onFpgaChange?: (next: RBFpgaConfig) => void;
  backendId?: ToolchainBackendId;
}

function upsertSource(
  project: ToolchainProjectInput,
  path: string,
  patch: { language?: 'verilog' | 'vhdl'; text?: string }
): ToolchainProjectInput {
  const sources = Array.isArray(project.sources) ? project.sources : [];
  const idx = sources.findIndex((s) => s.path === path);
  const nextSources =
    idx >= 0
      ? sources.map((s, i) => (i === idx ? { ...s, ...patch } : s))
      : [
          ...sources,
          {
            path,
            language: patch.language ?? 'verilog',
            text: patch.text ?? '',
          },
        ];

  nextSources.sort((a, b) => a.path.localeCompare(b.path));
  return { ...project, sources: nextSources };
}

function normalizeXdcText(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function normalizeHdlSourcePath(value: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : 'top.v';
}

export const HdlEditorPanel: React.FC<HdlEditorPanelProps> = ({
  project,
  onProjectChange,
  fpga,
  onFpgaChange,
  backendId,
}) => {
  const resolvedBackendId = backendId ?? getToolchainBackendId();
  const backend = useMemo(() => getToolchainBackend(resolvedBackendId), [resolvedBackendId]);
  const [logs, setLogs] = useState<BuildLogEntry[]>([]);
  const [lastProbe, setLastProbe] = useState<ToolProbeResult | null>(null);
  const [lastPreflight, setLastPreflight] = useState<ToolchainPreflightStatus | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isProbing, setIsProbing] = useState(false);
  const [isPreflighting, setIsPreflighting] = useState(false);
  const [synthRunId, setSynthRunId] = useState<string | null>(null);
  const [synthStatus, setSynthStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [synthArtifact, setSynthArtifact] = useState<SynthArtifactRef | null>(null);
  const buildRunSeqRef = useRef(0);
  const synthOffsetRef = useRef(0);
  const synthPollTimerRef = useRef<number | null>(null);
  const synthStreamRef = useRef<{ close: () => void } | null>(null);
  const [presetToApply, setPresetToApply] = useState<Basys3XdcPresetId | ''>('');

  const fileName = useMemo(() => {
    const names = (project.sources ?? []).map((s) => s.path).filter(Boolean).sort();
    const topName = normalizeHdlSourcePath(project.top ?? '');
    const topCandidates = [topName, `${topName}.v`, `${topName}.sv`, `${topName}.vhd`, `${topName}.vhdl`];
    const topFile = topCandidates.find((candidate) => names.includes(candidate));
    if (topFile) return topFile;
    return names[0] ?? 'top.v';
  }, [project.sources, project.top]);

  const activeSource = useMemo(() => {
    return (project.sources ?? []).find((s) => s.path === fileName) ?? null;
  }, [project.sources, fileName]);

  const fileText = activeSource?.text ?? '';
  const fileLanguage = activeSource?.language ?? 'verilog';

  const resolvedFpga: RBFpgaConfig = fpga ?? { board: 'basys3' };
  const xdcText = resolvedFpga.constraints?.text ?? '';
  const activePreset = resolvedFpga.preset ?? '';
  const buildSnapshot = useCallback(
    () => ({
      hdl: project,
      fpga: {
        board: 'basys3' as const,
        constraints: resolvedFpga.constraints,
        preset: resolvedFpga.preset,
        top: resolvedFpga.top,
      },
    }),
    [project, resolvedFpga.constraints, resolvedFpga.preset, resolvedFpga.top]
  );

  const readinessChecks = useMemo(() => {
    const preflight = lastPreflight;
    const hasTop = Boolean(preflight?.project.top?.trim());
    const hasXdc = Boolean(preflight?.project.hasXdc);
    const portsOk = Boolean(preflight?.lint.ok);
    const probeReady = (preflight?.tools ?? []).some((tool) => tool.ok) || Boolean(lastProbe?.ok);

    return [
      {
        id: 'top',
        label: 'Top',
        ok: hasTop,
        detail: hasTop
          ? preflight?.project.top ?? basys3TopModuleContract.topModule
          : `Set top module (${basys3TopModuleContract.topModule})`,
      },
      {
        id: 'xdc',
        label: 'XDC',
        ok: hasXdc,
        detail: hasXdc ? 'constraints loaded' : 'load a Basys3 preset',
      },
      {
        id: 'ports',
        label: 'Ports',
        ok: portsOk,
        detail: portsOk ? 'preflight lint ok' : 'run preflight or review lint',
      },
      {
        id: 'probe',
        label: 'Probe',
        ok: probeReady,
        detail: probeReady ? 'toolchain available' : 'run Probe Toolchain',
      },
    ] as const;
  }, [lastPreflight, lastProbe?.ok]);

  const appendLog = useCallback((entry: BuildLogEntry) => {
    setLogs((prev) => [...prev, entry]);
  }, []);
  const appendLogs = useCallback((entries: BuildLogEntry[]) => {
    if (!entries.length) return;
    setLogs((prev) => [...prev, ...entries]);
  }, []);

  const clearSynthMonitoring = useCallback(() => {
    if (synthStreamRef.current) {
      synthStreamRef.current.close();
      synthStreamRef.current = null;
    }
    if (synthPollTimerRef.current !== null) {
      window.clearInterval(synthPollTimerRef.current);
      synthPollTimerRef.current = null;
    }
  }, []);

  const finalizeSynthRun = useCallback(
    (summary: SynthRunDoneSummary) => {
      clearSynthMonitoring();
      synthOffsetRef.current = summary.nextOffset;
      setIsSynthesizing(false);
      setSynthRunId(summary.runId);
      if (summary.artifact) {
        setSynthArtifact(summary.artifact);
      }
      if (summary.state === 'done' && summary.ok) {
        setSynthStatus('success');
        return;
      }
      setSynthStatus('failed');
    },
    [clearSynthMonitoring]
  );

  const runPreflight = useCallback(
    async (options?: { refreshProbe?: boolean }) => {
      const status = await backend.preflight(buildSnapshot(), options);
      setLastPreflight(status);
      return status;
    },
    [backend, buildSnapshot]
  );

  useEffect(() => {
    let cancelled = false;
    setIsPreflighting(true);
    runPreflight()
      .catch(() => {
        if (!cancelled) setLastPreflight(null);
      })
      .finally(() => {
        if (!cancelled) setIsPreflighting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runPreflight]);

  useEffect(() => {
    return () => {
      clearSynthMonitoring();
    };
  }, [clearSynthMonitoring]);

  const pollSynthRunStatus = useCallback(
    async (runId: string) => {
      try {
        const status = await backend.getSynthRunStatus(runId, synthOffsetRef.current);
        appendLogs(status.logs ?? []);
        synthOffsetRef.current = status.nextOffset;
        if (status.state !== 'running') {
          finalizeSynthRun({
            runId: status.runId,
            artifactId: status.artifactId,
            state: status.state === 'done' || status.state === 'error' || status.state === 'canceled' ? status.state : 'error',
            ok: status.ok === true,
            exitCode: status.exitCode,
            nextOffset: status.nextOffset,
            ...(status.error ? { error: status.error } : {}),
            ...(status.artifact ? { artifact: status.artifact } : {}),
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'synth_status_failed';
        appendLog({
          run_id: runId,
          ts: synthOffsetRef.current,
          step: 'synth',
          level: 'error',
          msg: `[${backend.id}] synth: poll failed: ${message}`,
        });
        clearSynthMonitoring();
        setIsSynthesizing(false);
        setSynthStatus('failed');
      }
    },
    [appendLog, appendLogs, backend.id, clearSynthMonitoring, finalizeSynthRun]
  );

  const startSynthPolling = useCallback(
    (runId: string, offset: number) => {
      clearSynthMonitoring();
      synthOffsetRef.current = Math.max(0, offset);
      void pollSynthRunStatus(runId);
      synthPollTimerRef.current = window.setInterval(() => {
        void pollSynthRunStatus(runId);
      }, 500);
    },
    [clearSynthMonitoring, pollSynthRunStatus]
  );

  const startSynthStreaming = useCallback(
    (runId: string, offset: number) => {
      clearSynthMonitoring();
      synthOffsetRef.current = Math.max(0, offset);
      const subscription = backend.openSynthRunStream(
        runId,
        {
          onLog(entry) {
            appendLog(entry);
            synthOffsetRef.current = Math.max(synthOffsetRef.current, entry.ts + 1);
          },
          onDone(summary) {
            finalizeSynthRun(summary);
          },
          onError() {
            startSynthPolling(runId, synthOffsetRef.current);
          },
        },
        { offset: synthOffsetRef.current }
      );
      if (!subscription) {
        startSynthPolling(runId, synthOffsetRef.current);
        return;
      }
      synthStreamRef.current = subscription;
    },
    [appendLog, backend, clearSynthMonitoring, finalizeSynthRun, startSynthPolling]
  );

  const handleInsertExample = useCallback(
    (exampleId: Basys3ExampleId) => {
      const example = getBasys3VerilogExample(exampleId);
      if (!example) return;
      const nextProject = upsertSource(project, example.defaultPath, {
        language: example.language,
        text: example.text,
      });
      onProjectChange({
        ...nextProject,
        top: example.top,
      });
      if (onFpgaChange) {
        onFpgaChange({
          ...resolvedFpga,
          top: example.top,
        });
      }
    },
    [onFpgaChange, onProjectChange, project, resolvedFpga]
  );

  const handleSynthesize = useCallback(async () => {
    if (isSynthesizing) return;
    setLogs([]);
    setSynthArtifact(null);
    setSynthRunId(null);
    setSynthStatus('running');
    setIsSynthesizing(true);

    const run_id = `ui-synth-${buildRunSeqRef.current++}`;
    let ts = 0;
    const emitLocal = (level: 'info' | 'warn' | 'error', msg: string, data?: Record<string, unknown>) => {
      appendLog({
        run_id,
        ts: ts++,
        step: 'synth',
        level,
        msg,
        ...(data ? { data } : {}),
      });
    };

    try {
      setIsPreflighting(true);
      const preflight = await runPreflight();
      setIsPreflighting(false);
      appendLogs([...(preflight.lint.warnings ?? []), ...(preflight.lint.errors ?? [])]);
      if (!preflight.overallOk) {
        emitLocal('error', `[${backend.id}] synth: blocked by preflight (${preflight.lint.errors.length} error(s))`);
        setSynthStatus('failed');
        setIsSynthesizing(false);
        return;
      }

      const top = (project.top ?? resolvedFpga.top ?? basys3TopModuleContract.topModule).trim();
      const verilogSources = (project.sources ?? [])
        .filter((source) => source.language === 'verilog')
        .map((source) => ({
          path: source.path,
          language: 'verilog' as const,
          text: source.text,
        }));

      const result = await backend.synth({
        board: 'basys3',
        top,
        sources: verilogSources,
      });
      setSynthRunId(result.runId);
      appendLogs(result.logs ?? []);
      synthOffsetRef.current = result.nextOffset ?? 0;
      if (result.artifact) {
        setSynthArtifact(result.artifact);
      }

      if (result.state !== 'running') {
        finalizeSynthRun({
          runId: result.runId,
          artifactId: result.artifactId,
          state: result.state === 'done' || result.state === 'error' || result.state === 'canceled' ? result.state : 'error',
          ok: result.ok === true,
          exitCode: result.exitCode,
          nextOffset: result.nextOffset,
          ...(result.error ? { error: result.error } : {}),
          ...(result.artifact ? { artifact: result.artifact } : {}),
        });
        return;
      }

      startSynthStreaming(result.runId, result.nextOffset);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'synth_failed';
      emitLocal('error', `[${backend.id}] synth: failed: ${message}`);
      setIsSynthesizing(false);
      setSynthStatus('failed');
      clearSynthMonitoring();
    } finally {
      setIsPreflighting(false);
    }
  }, [
    appendLog,
    appendLogs,
    backend,
    clearSynthMonitoring,
    finalizeSynthRun,
    isSynthesizing,
    project.sources,
    project.top,
    resolvedFpga.top,
    runPreflight,
    startSynthStreaming,
  ]);

  const handleBuild = useCallback(async () => {
    setLogs([]);
    setIsBuilding(true);

    const run_id = `ui-build-${buildRunSeqRef.current++}`;
    let ts = 0;
    const sink = {
      log: (entry: BuildLogEntry) => {
        appendLog({ ...entry, run_id, ts: ts++ });
      },
    };

    try {
      setIsPreflighting(true);
      const preflight = await runPreflight();
      setIsPreflighting(false);
      const preflightLogs = [...(preflight.lint.warnings ?? []), ...(preflight.lint.errors ?? [])];
      for (const entry of preflightLogs) {
        sink.log({
          step: entry.step,
          level: entry.level,
          msg: entry.msg,
          data: entry.data,
        });
      }

      if (!preflight.overallOk) {
        sink.log({
          step: 'preflight',
          level: 'error',
          msg: `[${backend.id}] build: blocked by preflight (${preflight.lint.errors.length} error(s))`,
        });
        return;
      }

      const netlist = await backend.synthesize(project, sink);
      const implemented = await backend.implement(netlist, sink);
      await backend.bitgen(implemented, sink);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'build_failed';
      appendLog({
        run_id,
        ts: ts++,
        step: 'synth',
        level: 'error',
        msg: `[${backend.id}] build: failed: ${message}`,
      });
    } finally {
      setIsPreflighting(false);
      setIsBuilding(false);
    }
  }, [appendLog, backend, project, runPreflight]);

  const handleProbe = useCallback(async () => {
    setLogs([]);
    setIsProbing(true);

    try {
      const result = await backend.probeTools();
      setLastProbe(result);
      setLogs(result.logs ?? []);
      setIsPreflighting(true);
      try {
        const preflight = await runPreflight({ refreshProbe: false });
        setLastPreflight(preflight);
      } finally {
        setIsPreflighting(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'probe_failed';
      setLastProbe(null);
      setLogs([
        {
          run_id: 'ui-probe',
          ts: 0,
          step: 'probe',
          level: 'error',
          msg: `[${backend.id}] probe: failed: ${message}`,
        },
      ]);
    } finally {
      setIsProbing(false);
    }
  }, [backend, runPreflight]);

  const handleExportReport = useCallback(() => {
    void (async () => {
      const report = await backend.doctorReport(buildSnapshot(), {
        logs,
        probe: lastProbe,
        preflight: lastPreflight,
      });
      const json = stableStringify(report);
      const fileTag = report.reportId ? `-${report.reportId}` : lastProbe?.run_id ? `-${lastProbe.run_id}` : '';
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rb-toolchain-report${fileTag}.json`;
      link.click();
      URL.revokeObjectURL(url);
    })().catch((error) => {
      const message = error instanceof Error ? error.message : 'report_export_failed';
      setLogs((prev) => [
        ...prev,
        {
          run_id: 'ui-report',
          ts: prev.length,
          step: 'preflight',
          level: 'error',
          msg: `[${backend.id}] doctor report export failed: ${message}`,
        },
      ]);
    });
  }, [backend, buildSnapshot, lastPreflight, lastProbe, logs]);

  const displayLogs = useMemo(() => logs.map((l) => l.msg).join('\n'), [logs]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1B2028]/60 bg-[#0D1117]/80">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-[#E6EDF3]">HDL Editor</div>
            <div className="text-[10px] text-[#6E7681]">
              Backend: <span className="font-mono text-[#8B949E]">{resolvedBackendId}</span>
            </div>
            <div className="text-[10px] text-[#6E7681]">
              Board: <span className="font-mono text-[#8B949E]">basys3</span>
            </div>
            <div className="text-[10px] text-[#6E7681]" data-testid="hdl-preflight-status">
              Preflight:{' '}
              <span className="font-mono text-[#8B949E]">
                {isPreflighting
                  ? 'running'
                  : lastPreflight
                    ? lastPreflight.overallOk
                      ? 'ok'
                      : 'errors'
                    : 'unknown'}
              </span>
            </div>
            <div className="text-[10px] text-[#6E7681]" data-testid="hdl-synth-status">
              Synth:{' '}
              <span className="font-mono text-[#8B949E]">
                {isSynthesizing ? 'running' : synthStatus}
              </span>
              {synthRunId ? (
                <span className="ml-2 text-[#8B949E]">
                  run: <span className="font-mono">{synthRunId}</span>
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportReport}
              className="px-2 py-1 text-[10px] rounded border border-[#8B949E]/30 text-[#8B949E] hover:bg-[#161B22] disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled={!lastProbe || isBuilding || isProbing || isSynthesizing}
              data-testid="hdl-export-report-button"
              title={!lastProbe ? 'Run Probe Toolchain first' : 'Download a JSON doctor report'}
            >
              Export Report
            </button>
            <button
              onClick={handleProbe}
              className="px-2 py-1 text-[10px] rounded border border-[#8B949E]/30 text-[#8B949E] hover:bg-[#161B22] disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled={isBuilding || isProbing || isSynthesizing}
              data-testid="hdl-probe-button"
            >
              {isProbing ? 'Probing...' : 'Probe Toolchain'}
            </button>
            <button
              onClick={handleSynthesize}
              className="px-2 py-1 text-[10px] rounded border border-[#22C55E]/40 text-[#22C55E] hover:bg-[#22C55E]/10 disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled={isBuilding || isProbing || isSynthesizing}
              data-testid="hdl-synth-button"
            >
              {isSynthesizing ? 'Synthesizing...' : 'Synthesize (Yosys)'}
            </button>
            <button
              onClick={handleBuild}
              className="px-2 py-1 text-[10px] rounded border border-[#22D3EE]/40 text-[#22D3EE] hover:bg-[#22D3EE]/10 disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled={isBuilding || isProbing || isSynthesizing}
              data-testid="hdl-build-button"
            >
              {isBuilding ? 'Building...' : 'Build (stub)'}
            </button>
            <button
              onClick={() => setLogs([])}
              className="px-2 py-1 text-[10px] rounded border border-[#8B949E]/30 text-[#8B949E] hover:bg-[#161B22]"
              type="button"
              disabled={logs.length === 0}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="text-[10px] text-[#6E7681]">
            File: <span className="font-mono text-[#8B949E]">{fileName}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-[10px] text-[#6E7681]">
              <span>Top</span>
              <input
                value={project.top ?? ''}
                onChange={(e) => {
                  const nextTop = e.target.value.trim();
                  onProjectChange({
                    ...project,
                    top: nextTop.length > 0 ? nextTop : undefined,
                  });
                  if (onFpgaChange) {
                    onFpgaChange({
                      ...resolvedFpga,
                      top: nextTop.length > 0 ? nextTop : undefined,
                    });
                  }
                }}
                className="bg-[#0B0F14] border border-[#1B2028] rounded px-2 py-1 text-[10px] text-[#E6EDF3] outline-none w-24"
                placeholder={basys3TopModuleContract.topModule}
                data-testid="hdl-top-input"
              />
            </label>
            <label className="flex items-center gap-2 text-[10px] text-[#6E7681]">
              <span>Language</span>
              <select
                className="bg-[#0B0F14] border border-[#1B2028] rounded px-2 py-1 text-[10px] text-[#E6EDF3] outline-none"
                value={fileLanguage}
                onChange={(e) => {
                  const nextLanguage = e.target.value === 'vhdl' ? 'vhdl' : 'verilog';
                  onProjectChange(upsertSource(project, fileName, { language: nextLanguage }));
                }}
                data-testid="hdl-language-select"
              >
                <option value="verilog">Verilog</option>
                <option value="vhdl">VHDL</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="text-[10px] text-[#6E7681]">Examples</div>
          {basys3VerilogExamples.map((example) => (
            <button
              key={example.id}
              onClick={() => handleInsertExample(example.id)}
              className="px-2 py-1 text-[10px] rounded border border-[#8B949E]/30 text-[#8B949E] hover:bg-[#161B22]"
              type="button"
              disabled={isBuilding || isProbing || isSynthesizing}
              data-testid={`hdl-example-${example.id}`}
              title={example.description}
            >
              {example.label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="text-[10px] text-[#6E7681]">
            Constraints:{' '}
            {xdcText.trim().length > 0 ? (
              <span className="text-[#22D3EE]">loaded</span>
            ) : (
              <span className="text-[#D29922]">none</span>
            )}
            {activePreset ? (
              <span className="ml-2 text-[#8B949E]">
                preset: <span className="font-mono">{activePreset}</span>
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-[10px] text-[#6E7681]">
              <span>Preset</span>
              <select
                className="bg-[#0B0F14] border border-[#1B2028] rounded px-2 py-1 text-[10px] text-[#E6EDF3] outline-none"
                value={presetToApply}
                onChange={(e) => {
                  const next = e.target.value as Basys3XdcPresetId | '';
                  setPresetToApply(next);
                }}
                data-testid="hdl-xdc-preset-select"
              >
                <option value="">Select...</option>
                {basys3XdcPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                if (!onFpgaChange || !presetToApply) return;
                const nextText = getBasys3XdcPresetText(presetToApply);
                onFpgaChange({
                  ...resolvedFpga,
                  preset: presetToApply,
                  constraints: { type: 'xdc', text: nextText },
                });
              }}
              className="px-2 py-1 text-[10px] rounded border border-[#8B949E]/30 text-[#8B949E] hover:bg-[#161B22] disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled={!onFpgaChange || !presetToApply || isBuilding || isProbing || isSynthesizing}
              data-testid="hdl-xdc-apply-preset-button"
              title={!onFpgaChange ? 'FPGA project data not available' : undefined}
            >
              Apply Preset
            </button>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2" data-testid="hdl-readiness-checklist">
          {readinessChecks.map((item) => (
            <div
              key={item.id}
              className={`rounded border px-2 py-1 text-[10px] ${
                item.ok
                  ? 'border-green-500/40 bg-green-500/10 text-green-200'
                  : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-100'
              }`}
              data-testid={`hdl-readiness-${item.id}`}
            >
              <span className="font-semibold">{item.label}:</span> {item.detail}
            </div>
          ))}
        </div>

        {synthArtifact ? (
          <div className="mt-2 rounded border border-[#22C55E]/30 bg-[#22C55E]/10 px-2 py-1 text-[10px] text-[#86EFAC]" data-testid="hdl-synth-artifact-summary">
            artifact: <span className="font-mono">{synthArtifact.artifactId}</span> - netlist{' '}
            <span className="font-mono">{synthArtifact.outputs.netlistVerilog}</span>
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-hidden p-3 flex flex-col gap-3">
        <div className="flex-1 overflow-hidden">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-[#6E7681]">HDL</div>
          <textarea
            value={fileText}
            onChange={(e) => {
              const nextText = e.target.value;
              onProjectChange(upsertSource(project, fileName, { text: nextText, language: fileLanguage }));
            }}
            className="w-full h-full resize-none rounded bg-[#0B0F14] border border-[#1B2028] p-2 font-mono text-xs text-[#E6EDF3] outline-none focus:border-[#22D3EE]/40"
            spellCheck={false}
            data-testid="hdl-editor-textarea"
          />
        </div>

        <div className="h-40 overflow-hidden">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wide text-[#6E7681]">XDC Constraints</div>
            {xdcText.trim().length === 0 ? (
              <div className="text-[10px] text-[#6E7681]">No constraints loaded</div>
            ) : null}
          </div>
          <textarea
            value={xdcText}
            onChange={(e) => {
              if (!onFpgaChange) return;
              const nextText = normalizeXdcText(e.target.value);
              const nextConstraints = nextText.trim().length > 0 ? { type: 'xdc' as const, text: nextText } : undefined;
              onFpgaChange({
                ...resolvedFpga,
                preset: undefined,
                constraints: nextConstraints,
              });
            }}
            className="w-full h-full resize-none rounded bg-[#0B0F14] border border-[#1B2028] p-2 font-mono text-xs text-[#E6EDF3] outline-none focus:border-[#22D3EE]/40 disabled:opacity-60 disabled:cursor-not-allowed"
            spellCheck={false}
            disabled={!onFpgaChange}
            data-testid="hdl-xdc-textarea"
          />
        </div>
      </div>

      <div className="border-t border-[#1B2028]/60 bg-[#0B0F14]">
        <div className="px-4 py-2 text-[10px] uppercase tracking-wide text-[#6E7681]">
          Build Console
        </div>
        <div className="px-4 pb-3 max-h-40 overflow-auto">
          {logs.length === 0 ? (
            <div className="text-xs text-[#6E7681]">No logs yet.</div>
          ) : (
            <pre className="text-xs text-[#E6EDF3] whitespace-pre-wrap" data-testid="hdl-build-logs">
              {displayLogs}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
