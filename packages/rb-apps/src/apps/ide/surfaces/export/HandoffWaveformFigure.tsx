import React, { useMemo } from 'react';
import type { RuntimeVerifyRun } from '../../projectRuntime';

export interface HandoffWaveformFigureProps {
  readonly run: RuntimeVerifyRun;
  /** Lanes to draw, at most this many (outputs first, then inputs). */
  readonly maxLanes?: number;
  readonly onSelectTick?: (tick: number) => void;
}

const LABEL_W = 96;
const LANE_H = 18;
const RULER_H = 16;

/**
 * A read-only waveform figure for the handoff dossier: the run's samples as
 * stepped lanes, outputs first. It draws exactly what the run recorded; a
 * mismatch tick is marked. Nothing here is interactive beyond opening the
 * real Waveform document at a tick.
 */
export const HandoffWaveformFigure: React.FC<HandoffWaveformFigureProps> = ({ run, maxLanes = 12, onSelectTick }) => {
  const model = useMemo(() => {
    const samples = run.waveform ?? [];
    const ticks = samples.map((sample) => sample.tick);
    const roles = run.report?.signalRoles ?? {};
    const checked = new Set((run.report?.rows ?? []).map((row) => row.signal));
    const allNames = new Set<string>();
    for (const sample of samples) for (const key of Object.keys(sample.signals)) allNames.add(key);
    // Node-port keys (a0.out, sum0.in) duplicate the boundary signals; keep the
    // signal names the checks and roles use whenever any exist.
    const boundaryNames = Array.from(allNames).filter((name) => !name.includes('.'));
    const names = new Set(boundaryNames.length > 0 ? boundaryNames : Array.from(allNames));
    const order = (name: string) => {
      if (checked.has(name)) return 0;
      const role = roles[name];
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
        role: checked.has(name) ? 'output' : roles[name] ?? 'signal',
        values: samples.map((sample) => String(sample.signals[name] ?? '-')),
      }));
    const failTicks = new Set((run.report?.rows ?? []).filter((row) => row.status === 'fail').map((row) => row.tick));
    return { ticks, lanes, failTicks, hidden: Math.max(0, names.size - lanes.length) };
  }, [maxLanes, run]);

  if (model.ticks.length === 0 || model.lanes.length === 0) {
    return <div className="wb-empty">No waveform samples recorded.</div>;
  }
  const tickW = Math.max(18, Math.min(48, Math.floor(720 / model.ticks.length)));
  const width = LABEL_W + tickW * model.ticks.length + 8;
  const height = RULER_H + LANE_H * model.lanes.length + 4;

  return (
    <figure className="rb-handoff-figure" data-testid="ide-package-handoff-waveform">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={`Waveform of ${model.lanes.length} signals over ${model.ticks.length} ticks`}>
        {model.ticks.map((tick, index) => {
          const x = LABEL_W + index * tickW;
          const isFail = model.failTicks.has(tick);
          return (
            <g key={tick} onClick={onSelectTick ? () => onSelectTick(tick) : undefined} style={onSelectTick ? { cursor: 'pointer' } : undefined}>
              {isFail ? <rect x={x} y={RULER_H} width={tickW} height={LANE_H * model.lanes.length} fill="var(--wb-danger-soft, rgba(185, 28, 28, 0.12))" /> : null}
              <line x1={x} y1={RULER_H - 3} x2={x} y2={height} stroke="var(--wb-border)" strokeWidth={1} />
              <text x={x + tickW / 2} y={RULER_H - 5} textAnchor="middle" fontSize={9} fill={isFail ? 'var(--wb-danger, #b91c1c)' : 'var(--wb-text-3)'} fontFamily="var(--wb-font-mono)">
                t{tick}
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
          return (
            <g key={lane.name} data-role={lane.role}>
              <text x={LABEL_W - 6} y={y0 + LANE_H / 2 + 3} textAnchor="end" fontSize={10} fontFamily="var(--wb-font-mono)" fill={lane.role === 'output' ? 'var(--wb-text-1, var(--wb-text-2))' : 'var(--wb-text-2)'}>
                {lane.name.length > 12 ? `${lane.name.slice(0, 11)}…` : lane.name}
              </text>
              <path d={d} fill="none" stroke={lane.role === 'output' ? 'var(--wb-focus)' : 'var(--wb-text-2)'} strokeWidth={1.4} />
            </g>
          );
        })}
      </svg>
      <figcaption>
        Figure 2 — Recorded waveform, {model.lanes.length} of {model.lanes.length + model.hidden} signals over {model.ticks.length} ticks
        {model.failTicks.size > 0 ? `; mismatch at ${Array.from(model.failTicks).map((tick) => `t${tick}`).join(', ')}` : ''}.
      </figcaption>
    </figure>
  );
};
