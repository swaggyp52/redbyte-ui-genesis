import React, { useMemo } from 'react';
import type { RuntimeVerifyRun } from '../../projectRuntime';

export interface HandoffWaveformFigureProps {
  readonly run: RuntimeVerifyRun;
  /** Figure number in the dossier. */
  readonly figureNumber: number;
  /** Lanes to draw, at most this many (checked outputs first, then inputs). */
  readonly maxLanes?: number;
  /** Ticks to draw, at most this many (centred on the first mismatch when there is one). */
  readonly maxTicks?: number;
  readonly onSelectTick?: (tick: number) => void;
}

const LABEL_W = 132;
const LANE_H = 18;
const RULER_H = 16;

/**
 * A read-only waveform figure for the handoff dossier: the run's samples as
 * stepped lanes, checked outputs first, each lane tagged with its role. It
 * draws exactly what the run recorded, windowed to a legible number of ticks
 * (the caption says which); a mismatch tick is marked. Nothing here is
 * interactive beyond opening the real Waveform document at a tick.
 */
export const HandoffWaveformFigure: React.FC<HandoffWaveformFigureProps> = ({ run, figureNumber, maxLanes = 12, maxTicks = 32, onSelectTick }) => {
  const model = useMemo(() => {
    const samples = run.waveform ?? [];
    const allTicks = samples.map((sample) => sample.tick);
    const failTicks = new Set((run.report?.rows ?? []).filter((row) => row.status === 'fail').map((row) => row.tick));
    // Window: at most maxTicks, centred on the first mismatch when one exists.
    let start = 0;
    if (allTicks.length > maxTicks) {
      const firstFail = Array.from(failTicks).sort((left, right) => left - right)[0];
      const failIndex = firstFail == null ? -1 : allTicks.indexOf(firstFail);
      if (failIndex >= 0) start = Math.max(0, Math.min(allTicks.length - maxTicks, failIndex - Math.floor(maxTicks / 2)));
    }
    const windowSamples = samples.slice(start, start + maxTicks);
    const ticks = windowSamples.map((sample) => sample.tick);
    const roles = run.report?.signalRoles ?? {};
    const checked = new Set((run.report?.rows ?? []).map((row) => row.signal));
    const allNames = new Set<string>();
    for (const sample of samples) for (const key of Object.keys(sample.signals)) allNames.add(key);
    // Node-port keys (a0.out, sum0.in) duplicate the boundary signals; keep the
    // signal names the checks and roles use whenever any exist.
    const boundaryNames = Array.from(allNames).filter((name) => !name.includes('.'));
    const names = new Set(boundaryNames.length > 0 ? boundaryNames : Array.from(allNames));
    const roleOf = (name: string): string => (checked.has(name) ? 'output' : roles[name] ?? 'signal');
    const order = (name: string) => {
      const role = roleOf(name);
      if (checked.has(name)) return 0;
      if (role === 'output') return 1;
      if (role === 'input') return 2;
      if (role === 'clock' || role === 'reset') return 3;
      return 4;
    };
    const lanes = Array.from(names)
      .sort((left, right) => order(left) - order(right) || left.localeCompare(right, undefined, { numeric: true }))
      .slice(0, maxLanes)
      .map((name) => ({
        name,
        role: roleOf(name),
        values: windowSamples.map((sample) => String(sample.signals[name] ?? '-')),
      }));
    return { ticks, allTickCount: allTicks.length, windowStart: ticks[0] ?? 0, windowEnd: ticks[ticks.length - 1] ?? 0, lanes, failTicks, hidden: Math.max(0, names.size - lanes.length) };
  }, [maxLanes, maxTicks, run]);

  if (model.ticks.length === 0 || model.lanes.length === 0) {
    return <div className="wb-empty">No waveform samples recorded.</div>;
  }
  const tickW = Math.max(18, Math.min(48, Math.floor(720 / model.ticks.length)));
  const width = LABEL_W + tickW * model.ticks.length + 8;
  const height = RULER_H + LANE_H * model.lanes.length + 4;
  const roleTag = (role: string) => (role === 'output' ? 'out' : role === 'input' ? 'in' : role === 'clock' ? 'clk' : role === 'reset' ? 'rst' : '');
  const windowed = model.allTickCount > model.ticks.length;
  const failList = Array.from(model.failTicks).sort((left, right) => left - right);

  return (
    <figure className="rb-handoff-figure" data-testid="ide-package-handoff-waveform" data-window-start={model.windowStart} data-window-end={model.windowEnd}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={`Waveform of ${model.lanes.length} signals over ticks ${model.windowStart} to ${model.windowEnd}`}>
        {model.ticks.map((tick, index) => {
          const x = LABEL_W + index * tickW;
          const isFail = model.failTicks.has(tick);
          return (
            <g key={tick} onClick={onSelectTick ? () => onSelectTick(tick) : undefined} style={onSelectTick ? { cursor: 'pointer' } : undefined}>
              {isFail ? <rect x={x} y={RULER_H} width={tickW} height={LANE_H * model.lanes.length} fill="var(--wb-danger-soft, rgba(185, 28, 28, 0.12))" /> : null}
              <line x1={x} y1={RULER_H - 3} x2={x} y2={height} stroke="var(--wb-border)" strokeWidth={1} />
              <text x={x + tickW / 2} y={RULER_H - 5} textAnchor="middle" fontSize={9} fill={isFail ? 'var(--wb-danger, #b91c1c)' : 'var(--wb-text-3)'} fontFamily="var(--wb-font-mono)">
                {isFail ? `✕t${tick}` : `t${tick}`}
              </text>
            </g>
          );
        })}
        {model.lanes.map((lane, laneIndex) => {
          const y0 = RULER_H + laneIndex * LANE_H;
          const hi = y0 + 3;
          const lo = y0 + LANE_H - 4;
          let d = '';
          lane.values.forEach((value, index) => {
            const x = LABEL_W + index * tickW;
            const y = value === '1' ? hi : value === '0' ? lo : (hi + lo) / 2;
            d += index === 0 ? `M ${x} ${y}` : ` V ${y}`;
            d += ` H ${x + tickW}`;
          });
          const tag = roleTag(lane.role);
          return (
            <g key={lane.name} data-role={lane.role}>
              <text x={LABEL_W - 30} y={y0 + LANE_H / 2 + 3} textAnchor="end" fontSize={10} fontFamily="var(--wb-font-mono)" fill="var(--wb-text-2)">
                {lane.name.length > 12 ? `${lane.name.slice(0, 11)}…` : lane.name}
              </text>
              {tag ? (
                <text x={LABEL_W - 6} y={y0 + LANE_H / 2 + 3} textAnchor="end" fontSize={8} fontFamily="var(--wb-font-mono)" fill="var(--wb-text-3)" letterSpacing="0.04em">
                  {tag.toUpperCase()}
                </text>
              ) : null}
              <path d={d} fill="none" stroke={lane.role === 'output' ? 'var(--wb-focus)' : 'var(--wb-text-2)'} strokeWidth={lane.role === 'output' ? 1.6 : 1.2} strokeDasharray={lane.role === 'output' ? undefined : '0'} />
            </g>
          );
        })}
      </svg>
      <figcaption>
        Figure {figureNumber} — Recorded waveform, {model.lanes.length} of {model.lanes.length + model.hidden} signals
        {windowed ? `, ticks t${model.windowStart}–t${model.windowEnd} of ${model.allTickCount}` : ` over ${model.ticks.length} ticks`}
        {failList.length > 0 ? `; mismatch at ${failList.map((tick) => `t${tick}`).join(', ')}` : ''}. OUT lanes are checked outputs, IN lanes stimulus.
      </figcaption>
    </figure>
  );
};
