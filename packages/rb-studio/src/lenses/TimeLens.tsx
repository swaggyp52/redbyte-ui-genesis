import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RuntimeVerifyRun } from '@redbyte/rb-apps/domain';
import {
  SAMPLE_AT,
  laneTicks,
  type EventPlace,
  type LaneTick,
  type LogicValue,
  type RecordingIndex,
  type RecordingMoment,
  type Timeline,
} from '@redbyte/rb-studio-kernel';

/**
 * Temporal perspective: the recording, as recorded. Lanes are read-only — inspecting a lane
 * never edits a stimulus (authoring cases belongs to Simulate's case editor).
 *
 * Inside a tick a value changes only where the recording says it did: at the tick start when
 * the inputs were applied, at the rising clock edge (registers, and the logic they drive), or
 * when the clock fell. Those are the schedule's own boundaries; evaluations inside one of them
 * have a step number, not a time. A recording without retained evaluations has one sample per
 * tick, and a change between two samples is drawn slanted across the gap, never at a moment.
 *
 * Traces are a Canvas2D raster sized for the device pixel ratio; ticks, the meridian, checks and
 * the value table are DOM so they stay crisp, focusable and readable by assistive technology.
 */
export interface TimeLane {
  /** Recorded waveform lane, or null when this object was not recorded. */
  readonly key: string | null;
  /** The value the sheet reads for this lane (`${nodeId}.${pin}`). */
  readonly valueKey: string | null;
  /** The IO row this lane is, when it is one (checks name their output by it). */
  readonly fieldId: string | null;
  readonly label: string;
  readonly sub: string;
  readonly nodeId: string;
  readonly role: 'in' | 'out' | 'selected' | 'clock';
}

export interface TimeLensProps {
  readonly run: RuntimeVerifyRun | null;
  readonly index: RecordingIndex | null;
  readonly timeline: Timeline | null;
  readonly cursor: RecordingMoment | null;
  /** The retained evaluation the Moment stands on, in the event view. */
  readonly place: EventPlace | null;
  readonly lanes: readonly TimeLane[];
  /** The values at the current step (event view), for the screen-reader table; null at a published tick. */
  readonly stepValues?: ReadonlyMap<string, LogicValue> | null;
  readonly selectedNodeId: string | null;
  readonly stale: string | null;
  readonly onSeek: (tick: number) => void;
  readonly onSelectNode: (nodeId: string) => void;
}

const LANE_H = 30;
const RULER_H = 30;
const MIN_TICK_W = 44;

function cssVar(element: Element, name: string, fallback: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}

const isLevel = (value: LogicValue | undefined): value is 0 | 1 => value === 0 || value === 1;

interface Failure {
  readonly lane: string;
  readonly expected: string;
  readonly actual: string;
}

export const TimeLens: React.FC<TimeLensProps> = ({ run, index, timeline, cursor, place, lanes, stepValues = null, selectedNodeId, stale, onSeek, onSelectNode }) => {
  const observerRef = useRef<ResizeObserver | null>(null);
  const trackRef = useCallback((element: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    observerRef.current = new ResizeObserver(measure);
    observerRef.current.observe(element);
  }, []);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const meridianRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [dpr, setDpr] = useState(() => (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
  const ticks = index?.ticks ?? [];
  const tickWidth = ticks.length ? Math.max(MIN_TICK_W, Math.floor(width / ticks.length)) : MIN_TICK_W;
  const traceWidth = tickWidth * ticks.length;

  // Browser zoom and moving between displays change the device pixel ratio: redraw sharp.
  useEffect(() => {
    const query = window.matchMedia(`(resolution: ${dpr}dppx)`);
    const update = () => setDpr(window.devicePixelRatio || 1);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [dpr]);

  const tracks = useMemo<(LaneTick[] | null)[]>(
    () => lanes.map((lane) => (timeline && lane.valueKey ? laneTicks(timeline, lane.valueKey) : null)),
    [lanes, timeline],
  );

  // Checks per tick, and each failure named by the lane of the output it checked.
  const checks = useMemo(() => {
    const laneOf = (signal: string) => lanes.find((lane) => lane.fieldId === signal)?.label
      ?? lanes.find((lane) => lane.label.toLowerCase() === signal.toLowerCase())?.label ?? signal;
    const byTick = new Map<number, { pass: number; failures: Failure[] }>();
    for (const row of run?.report.rows ?? []) {
      const entry = byTick.get(row.tick) ?? { pass: 0, failures: [] };
      if (String(row.expected) === String(row.actual)) entry.pass += 1;
      else entry.failures.push({ lane: laneOf(row.signal), expected: String(row.expected), actual: String(row.actual) });
      byTick.set(row.tick, entry);
    }
    return byTick;
  }, [run, lanes]);
  const failingLanes = useMemo(() => {
    const result = new Map<string, Map<number, Failure>>();
    for (const [tick, entry] of checks) {
      for (const failure of entry.failures) {
        const map = result.get(failure.lane) ?? new Map<number, Failure>();
        map.set(tick, failure);
        result.set(failure.lane, map);
      }
    }
    return result;
  }, [checks]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !run || ticks.length === 0) return;
    const height = lanes.length * LANE_H;
    canvas.width = Math.max(1, Math.round(traceWidth * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${traceWidth}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, traceWidth, height);
    const high = cssVar(canvas, '--mrd-logic-1', '#0a5ba8');
    const low = cssVar(canvas, '--mrd-logic-0', '#7d838c');
    const caution = cssVar(canvas, '--mrd-caution', '#a04e00');
    const faint = cssVar(canvas, '--mrd-ink-3', '#7d838c');
    const rule = cssVar(canvas, '--mrd-rule', '#d9d6cf');
    const failure = cssVar(canvas, '--mrd-failure', '#a8155a');
    lanes.forEach((lane, laneIndex) => {
      const top = laneIndex * LANE_H;
      const yHigh = top + 8;
      const yLow = top + LANE_H - 8;
      const yOf = (value: 0 | 1) => (value === 1 ? yHigh : yLow);
      ctx.strokeStyle = rule;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, top + LANE_H - 0.5);
      ctx.lineTo(traceWidth, top + LANE_H - 0.5);
      ctx.stroke();
      // A failed check on this lane: the same 45° crimson hatch as its check cell.
      const fails = failingLanes.get(lane.label);
      if (fails) {
        ctx.save();
        ctx.strokeStyle = failure;
        ctx.globalAlpha = 0.18;
        ctx.lineWidth = 2;
        ticks.forEach((tick, tickIndex) => {
          if (!fails.has(tick)) return;
          const x0 = tickIndex * tickWidth;
          ctx.save();
          ctx.beginPath();
          ctx.rect(x0, top, tickWidth, LANE_H - 1);
          ctx.clip();
          ctx.beginPath();
          for (let x = x0 - LANE_H; x < x0 + tickWidth; x += 7) {
            ctx.moveTo(x, top + LANE_H);
            ctx.lineTo(x + LANE_H, top);
          }
          ctx.stroke();
          ctx.restore();
        });
        ctx.restore();
      }
      // A clock lane is drawn from its recorded levels like any other lane, in neutral ink: a
      // clock is timing, not data. The schedule's own pulse appears only where it was recorded.
      const neutral = lane.role === 'clock';
      const level = (from: number, to: number, value: LogicValue | undefined) => {
        if (to <= from) return;
        if (isLevel(value)) {
          ctx.strokeStyle = neutral ? faint : value === 1 ? high : low;
          ctx.lineWidth = neutral ? 1.25 : value === 1 ? 2.5 : 1.25;
          ctx.beginPath();
          ctx.moveTo(from, yOf(value));
          ctx.lineTo(to, yOf(value));
          ctx.stroke();
        } else if (value === 'X' || value === 'Z') {
          ctx.strokeStyle = caution;
          ctx.lineWidth = 1;
          for (let x = from; x < to; x += 6) {
            ctx.beginPath();
            ctx.moveTo(x, yLow);
            ctx.lineTo(Math.min(x + 6, to), yHigh);
            ctx.stroke();
          }
        } else {
          ctx.strokeStyle = faint;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(from, (yHigh + yLow) / 2);
          ctx.lineTo(to, (yHigh + yLow) / 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      };
      const edge = (x: number) => {
        ctx.strokeStyle = faint;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, yHigh);
        ctx.lineTo(Math.round(x) + 0.5, yLow);
        ctx.stroke();
      };
      const track = tracks[laneIndex];
      if (!track) {
        level(0, traceWidth, undefined);
        return;
      }
      let last: LogicValue | undefined;
      track.forEach((tick, tickIndex) => {
        const x0 = tickIndex * tickWidth;
        if (tick.evaluated) {
          for (const segment of tick.segments) {
            const from = x0 + segment.from * tickWidth;
            if (tickIndex + segment.from > 0 && isLevel(last) && isLevel(segment.value) && last !== segment.value) edge(from);
            level(from, x0 + segment.to * tickWidth, segment.value);
            last = segment.value;
          }
          return;
        }
        // One sample per tick: known at the sample instant only.
        const value = tick.sample;
        const sampleX = x0 + SAMPLE_AT * tickWidth;
        const changedIn = tickIndex > 0 && isLevel(last) && isLevel(value) && last !== value;
        if (changedIn && isLevel(last) && isLevel(value)) {
          const previous = track[tickIndex - 1];
          const from = previous && !previous.evaluated ? x0 - (1 - SAMPLE_AT) * tickWidth : x0;
          ctx.strokeStyle = faint;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(from, yOf(last));
          ctx.lineTo(sampleX, yOf(value));
          ctx.stroke();
        }
        const next = track[tickIndex + 1];
        const changesOut = next && !next.evaluated && isLevel(next.sample) && isLevel(value) && next.sample !== value;
        level(changedIn ? sampleX : x0, changesOut ? sampleX : x0 + tickWidth, value);
        last = value;
      });
    });
  }, [run, lanes, tracks, ticks, tickWidth, traceWidth, dpr, failingLanes]);

  // A long recording scrolls sideways inside the lens; keep the meridian in view as it moves.
  useEffect(() => {
    const meridian = meridianRef.current;
    const scroller = meridian?.closest('.mrd-lens-body') as HTMLElement | null;
    if (!meridian || !scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    const labels = scroller.querySelector('.mrd-time-labels')?.getBoundingClientRect().width ?? 0;
    const x = meridian.offsetLeft + labels;
    if (x < scroller.scrollLeft + labels + 24 || x > scroller.scrollLeft + scroller.clientWidth - 24) {
      scroller.scrollLeft = Math.max(0, x - labels - (scroller.clientWidth - labels) / 2);
    }
  }, [cursor?.tick, place?.event.order, tickWidth]);

  if (!run || !index) {
    return <div className="mrd-lens-empty" data-testid="meridian-time-empty">No recording yet · Run creates one.</div>;
  }

  const cursorIndex = cursor ? ticks.indexOf(cursor.tick) : -1;
  const meridianAt = place ? place.at : SAMPLE_AT;
  const meridianLabel = cursor ? (place ? `t${cursor.tick} · ${place.step}/${place.of}` : `t${cursor.tick}`) : '';
  const meridianTitle = place ? `t${cursor?.tick} · ${place.phase.words} · step ${place.step} of ${place.of}` : `t${cursor?.tick} · recorded sample (clock high, after the edge)`;
  const columns = `repeat(${ticks.length}, ${tickWidth}px)`;
  const noChecks = run.report.rows.length === 0;
  const onCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || ticks.length === 0) return;
    onSeek(ticks[Math.max(0, Math.min(ticks.length - 1, Math.floor(event.nativeEvent.offsetX / tickWidth)))]);
  };

  return (
    <div className="mrd-time" data-testid="meridian-time" data-run-id={index.runId} data-tick={cursor?.tick ?? ''} data-stale={stale ? '1' : '0'}
      data-evaluated={timeline?.coverage.kind === 'complete' ? 'complete' : timeline?.coverage.kind ?? 'none'}>
      <div className="mrd-time-labels">
        <div className="mrd-time-ruler-label">{stale ? 'as recorded' : 'tick'}</div>
        {lanes.map((lane) => {
          const fails = failingLanes.get(lane.label);
          const now = cursor ? fails?.get(cursor.tick) : undefined;
          return (
            <button
              key={`${lane.role}:${lane.nodeId}:${lane.valueKey ?? lane.key ?? ''}`}
              type="button"
              className="mrd-time-label"
              data-selected={selectedNodeId === lane.nodeId ? '1' : '0'}
              data-lane={lane.key ?? ''}
              data-fail={fails ? '1' : undefined}
              title={lane.key ? `Recorded lane ${lane.key}` : 'Not recorded in this run'}
              onClick={() => onSelectNode(lane.nodeId)}
            >
              {lane.label} <small>{now ? `≠ expected ${now.expected}` : lane.sub}</small>
            </button>
          );
        })}
        <div className="mrd-time-ruler-label">checks</div>
      </div>
      <div className="mrd-time-track" ref={trackRef}>
        <div className="mrd-time-ruler" style={{ gridTemplateColumns: columns }} role="group" aria-label="Recorded ticks">
          {ticks.map((tick) => (
            <button
              key={tick}
              type="button"
              className="mrd-time-tick"
              aria-current={cursor?.tick === tick ? 'true' : undefined}
              data-testid={`meridian-tick-${tick}`}
              onClick={() => onSeek(tick)}
            >
              t{tick}
            </button>
          ))}
        </div>
        <canvas ref={canvasRef} className="mrd-time-canvas" aria-hidden="true" data-testid="meridian-time-canvas" onPointerDown={onCanvasPointerDown} />
        <div className="mrd-time-checks" style={{ gridTemplateColumns: columns }}>
          {noChecks ? (
            <div className="mrd-time-check mrd-time-check--none" data-testid="meridian-checks-none" style={{ gridColumn: '1 / -1' }}>no checks in this recording</div>
          ) : ticks.map((tick) => {
            const entry = checks.get(tick);
            const failures = entry?.failures ?? [];
            const result = !entry ? 'none' : failures.length > 0 ? 'fail' : 'pass';
            const label = !entry ? `t${tick}: no checks`
              : failures.length > 0 ? `t${tick}: ${failures.map((failure) => `${failure.lane} expected ${failure.expected}, recorded ${failure.actual}`).join('; ')}`
                : `t${tick}: ${entry.pass} checks passed`;
            return (
              <button key={tick} type="button" className="mrd-time-check" data-result={result} data-testid={`meridian-check-${tick}`}
                aria-current={cursor?.tick === tick ? 'true' : undefined} aria-label={label} title={label} onClick={() => onSeek(tick)}>
                {!entry ? '' : failures.length > 0 ? `≠ ${failures[0].lane}${failures.length > 1 ? ` +${failures.length - 1}` : ''}` : `✓ ${entry.pass}`}
              </button>
            );
          })}
        </div>
        {cursorIndex >= 0 ? (
          <div ref={meridianRef} className="mrd-meridian" data-testid="meridian-cursor" data-label={meridianLabel} title={meridianTitle}
            data-event-order={place ? place.event.order : undefined} data-at={meridianAt}
            style={{ left: `${cursorIndex * tickWidth + Math.max(1, meridianAt * tickWidth)}px`, height: `${RULER_H + lanes.length * LANE_H}px` }} />
        ) : null}
        <table className="mrd-visually-hidden" aria-label={cursor ? (place && stepValues ? `Values at t${cursor.tick}, step ${place.step} of ${place.of}` : `Recorded sample at t${cursor.tick}${stale ? ' (as recorded)' : ''}`) : 'No tick selected'}>
          <tbody>
            {lanes.map((lane, laneIndex) => {
              const tick = cursor ? tracks[laneIndex]?.find((entry) => entry.tick === cursor.tick) : undefined;
              return (
                <tr key={`${lane.role}:${lane.nodeId}:${lane.valueKey ?? lane.key ?? ''}`}>
                  <th scope="row">{lane.label}</th>
                  <td>{!cursor ? '' : (() => {
                    const value = place && stepValues && lane.valueKey ? stepValues.get(lane.valueKey) : tick?.sample;
                    return value === undefined ? 'not recorded' : String(value);
                  })()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
