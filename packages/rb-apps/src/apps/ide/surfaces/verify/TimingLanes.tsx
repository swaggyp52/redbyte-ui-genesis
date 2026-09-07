import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { VerifyAuthorVector, VerifyVectorDraftInput } from '../ScenarioBuilderPanel';
import type { StimulusCaseEvidenceState } from '../../components/StimulusCanvas';

// Timing lanes — the sequential authoring instrument. A horizontal tick ruler,
// one lane per driven input (clock first, reset next), one lane per output with
// the expected value overlaid on the observed trace, edge markers on the ruler,
// the selected tick as a column. Clicking an input cell drives that input at
// that tick (creating the event if the tick has none); clicking an output cell
// cycles its expected value (unset → 0 → 1 → unset). Values between events hold.

export interface TimingLanesProps {
  readonly vectors: readonly VerifyAuthorVector[];
  readonly inputFields: readonly VerifyVectorDraftInput[];
  readonly outputFields: readonly VerifyVectorDraftInput[];
  readonly clockFieldIds: ReadonlySet<string>;
  readonly selectedTick: number | null;
  readonly editable: boolean;
  readonly observedValuesByTick?: Readonly<Record<number, Readonly<Record<string, string>>>>;
  readonly caseEvidenceByTick?: Readonly<Record<number, StimulusCaseEvidenceState>>;
  readonly onSelectTick: (tick: number) => void;
  readonly onDriveInput: (tick: number, fieldId: string, value: 0 | 1) => void;
  readonly onCycleExpected: (tick: number, fieldId: string) => void;
  /** Ticks shown beyond the last event so new events can be authored by clicking. */
  readonly spareTicks?: number;
  /** Lanes the clock policy generates at run time; shown as the run will use them and not editable here. */
  readonly generatedFieldIds?: ReadonlySet<string>;
  readonly generatedValueAt?: (fieldId: string, tick: number) => 0 | 1 | null;
  readonly generatedNote?: string;
}

const LABEL_W = 132;
/**
 * The instrument sizes itself to the room it is given.
 *
 * These were fixed at 30px per tick and 26px per lane, so a fourteen-tick scenario drew 552px of
 * a 1000px pane and five signals occupied 130px of a 460px region: a small diagram stranded in an
 * empty box, which no container change can fix from the outside. The tick width now fits the
 * scenario to the available width when it can, and falls back to a legible minimum with
 * horizontal scrolling when the scenario is long. Lane height follows the room the same way,
 * within bounds that keep a trace readable and stop five lanes stretching down a tall display.
 */
/** Longest label the 132px name column can hold beside a tag before the two overlap. */
const LABEL_CHARS_WITH_TAG = 9;
const LABEL_CHARS = 15;
function fitLabel(text: string, hasTag: boolean): string {
  const limit = hasTag ? LABEL_CHARS_WITH_TAG : LABEL_CHARS;
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

const TICK_W_MIN = 22;
const TICK_W_MAX = 64;
const TICK_W_FALLBACK = 30;
const LANE_H_MIN = 26;
/* 52 left 160px of a 478px region empty with five signals on a 900px display: the instrument
   was capped below the room it had. A trace lane taller than this stops reading as a trace. */
const LANE_H_MAX = 80;
const LANE_H_FALLBACK = 34;
const RULER_H = 22;
const GROUP_H = 18;

const NAMES_ITSELF_CLOCK = /^(clk|clock)\b|\bclk\b/i;
const NAMES_ITSELF_RESET = /^(rst|reset|nrst|clr|clear)$/i;

function isResetField(field: VerifyVectorDraftInput): boolean {
  return /^(rst|reset|nrst|clr|clear)$/i.test(field.id) || /\b(reset|rst)\b/i.test(field.label);
}

export const TimingLanes: React.FC<TimingLanesProps> = ({
  vectors,
  inputFields,
  outputFields,
  clockFieldIds,
  generatedFieldIds,
  generatedValueAt,
  generatedNote,
  selectedTick,
  editable,
  observedValuesByTick,
  caseEvidenceByTick,
  onSelectTick,
  onDriveInput,
  onCycleExpected,
  spareTicks = 4,
}) => {
  // The available box, observed rather than assumed. Until it is known the instrument draws at
  // its fallback size, which is what the previous fixed geometry produced.
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const element = boxRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setBox((current) =>
        current && Math.abs(current.width - rect.width) < 1 && Math.abs(current.height - rect.height) < 1
          ? current
          : { width: rect.width, height: rect.height }
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const ordered = useMemo(() => [...vectors].sort((a, b) => a.tick - b.tick), [vectors]);
  const lastTick = ordered.length ? ordered[ordered.length - 1].tick : 0;
  const observedTicks = Object.keys(observedValuesByTick ?? {}).map(Number);
  const maxTick = Math.max(lastTick, ...observedTicks, selectedTick ?? 0) + spareTicks;
  const ticks = useMemo(() => Array.from({ length: maxTick + 1 }, (_, index) => index), [maxTick]);
  const eventTicks = useMemo(() => new Set(ordered.map((vector) => vector.tick)), [ordered]);

  // Inputs: clock lanes first, then reset, then the rest. A clock the policy
  // generates (not authored as an input) still gets a read-only lane: the
  // clocked schedule applies one active edge per tick.
  const generatedClocks = useMemo(
    () => Array.from(clockFieldIds).filter((id) => !inputFields.some((field) => field.id === id)),
    [clockFieldIds, inputFields]
  );
  const lanes = useMemo(() => {
    const known = new Set(inputFields.map((field) => field.id));
    const driven = new Set<string>();
    for (const vector of ordered) for (const id of Object.keys(vector.inputs)) if (!known.has(id) && !clockFieldIds.has(id)) driven.add(id);
    const extra: VerifyVectorDraftInput[] = Array.from(driven).map((id) => ({ id, label: id.toUpperCase() }));
    const all = [...inputFields, ...extra];
    const clocks = all.filter((field) => clockFieldIds.has(field.id));
    const resets = all.filter((field) => !clockFieldIds.has(field.id) && isResetField(field));
    const rest = all.filter((field) => !clockFieldIds.has(field.id) && !isResetField(field));
    return [...clocks, ...resets, ...rest];
  }, [clockFieldIds, inputFields, ordered]);

  /** Held input value at a tick: the last event at or before it. */
  const inputAt = (fieldId: string, tick: number): 0 | 1 => {
    let value: 0 | 1 = 0;
    for (const vector of ordered) {
      if (vector.tick > tick) break;
      value = vector.inputs[fieldId] === 1 ? 1 : 0;
    }
    return value;
  };
  const expectedAt = (fieldId: string, tick: number): 0 | 1 | null => {
    const vector = ordered.find((entry) => entry.tick === tick);
    const value = vector?.expected?.[fieldId];
    return value === 0 || value === 1 ? value : null;
  };
  const observedAt = (fieldId: string, tick: number): string | null => {
    const value = observedValuesByTick?.[tick]?.[fieldId];
    return value == null ? null : String(value);
  };

  // Rising edges: any clock lane going 0 → 1 between consecutive ticks.
  const risingEdges = useMemo(() => {
    const edges = new Set<number>();
    const clocks = lanes.filter((field) => clockFieldIds.has(field.id));
    for (const clock of clocks) {
      for (let tick = 1; tick <= maxTick; tick += 1) {
        if (inputAt(clock.id, tick - 1) === 0 && inputAt(clock.id, tick) === 1) edges.add(tick);
      }
    }
    // A generated (board) clock rises once per tick: every tick is an edge.
    if (generatedClocks.length > 0) for (let tick = 1; tick <= maxTick; tick += 1) edges.add(tick);
    return edges;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lanes, ordered, maxTick, clockFieldIds, generatedClocks.length]);
  const sortedEdges = useMemo(() => Array.from(risingEdges).sort((left, right) => left - right), [risingEdges]);

  const stimulusLaneCount = generatedClocks.length + lanes.length;
  const laneCount = stimulusLaneCount + outputFields.length;

  // Fit the scenario across the pane when it fits at a legible tick; otherwise draw at the
  // minimum and let the time axis scroll. Never wider than TICK_W_MAX: a three-tick scenario
  // stretched across an ultrawide display is not more readable, only larger.
  const TICK_W = useMemo(() => {
    if (!box || box.width <= 0 || ticks.length === 0) return TICK_W_FALLBACK;
    const perTick = (box.width - LABEL_W) / ticks.length;
    if (!Number.isFinite(perTick) || perTick <= 0) return TICK_W_FALLBACK;
    return Math.round(Math.min(TICK_W_MAX, Math.max(TICK_W_MIN, perTick)));
  }, [box, ticks.length]);

  // Lane height follows the height actually available, so five boundary signals are comfortable
  // on a short laptop instead of 26px each in a half-empty region.
  const LANE_H = useMemo(() => {
    if (!box || box.height <= 0 || laneCount === 0) return LANE_H_FALLBACK;
    const chrome = RULER_H + GROUP_H * 2 + 4;
    const perLane = (box.height - chrome) / laneCount;
    if (!Number.isFinite(perLane) || perLane <= 0) return LANE_H_FALLBACK;
    return Math.round(Math.min(LANE_H_MAX, Math.max(LANE_H_MIN, perLane)));
  }, [box, laneCount]);

  const width = LABEL_W + ticks.length * TICK_W;
  const height = RULER_H + GROUP_H + stimulusLaneCount * LANE_H + GROUP_H + outputFields.length * LANE_H + 4;
  const inputsTop = RULER_H + GROUP_H;
  const outputsTop = inputsTop + stimulusLaneCount * LANE_H + GROUP_H;
  const x = (tick: number) => LABEL_W + tick * TICK_W;

  /** Stepped 0/1 trace across ticks for one lane. */
  const tracePath = (valueAt: (tick: number) => 0 | 1 | null, top: number): string => {
    const hi = top + 5;
    const lo = top + LANE_H - 6;
    let d = '';
    let previous: 0 | 1 | null = null;
    for (const tick of ticks) {
      const value = valueAt(tick);
      if (value === null) {
        previous = null;
        continue;
      }
      const y = value === 1 ? hi : lo;
      const x0 = x(tick);
      const x1 = x(tick) + TICK_W;
      if (previous === null) d += ` M ${x0} ${y}`;
      else if (previous !== value) d += ` V ${y}`;
      d += ` H ${x1}`;
      previous = value;
    }
    return d.trim();
  };

  return (
    <div
      className="rb-tl"
      data-testid="ide-timing-lanes"
      role="grid"
      aria-label="Timing lanes — left and right move the selected tick; with Shift, to the next or previous clock edge"
      tabIndex={0}
      onKeyDown={(event) => {
        if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && event.shiftKey && sortedEdges.length > 0) {
          // Shift+Arrow snaps to the next/previous rising edge.
          event.preventDefault();
          const current = selectedTick ?? 0;
          const next = event.key === 'ArrowRight'
            ? sortedEdges.find((tick) => tick > current)
            : [...sortedEdges].reverse().find((tick) => tick < current);
          if (next != null && next !== current) onSelectTick(next);
        } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          const current = selectedTick ?? 0;
          const next = Math.min(maxTick, Math.max(0, current + (event.key === 'ArrowRight' ? 1 : -1)));
          if (next !== current) onSelectTick(next);
        } else if (event.key === 'Home') {
          event.preventDefault();
          onSelectTick(0);
        } else if (event.key === 'End') {
          event.preventDefault();
          onSelectTick(maxTick);
        }
      }}
    >
      <div className="rb-tl-scroll" ref={boxRef}>
        <svg className="rb-tl-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="presentation">
          {/* selected tick column */}
          {selectedTick != null && selectedTick <= maxTick ? (
            <rect className="rb-tl-selected" x={x(selectedTick)} y={0} width={TICK_W} height={height} />
          ) : null}
          {/* ruler */}
          <g className="rb-tl-ruler">
            <text className="rb-tl-ruler-label" x={8} y={RULER_H - 7}>t</text>
            {ticks.map((tick) => (
              <g key={tick} className={`rb-tl-tick${eventTicks.has(tick) ? ' is-event' : ''}${risingEdges.has(tick) ? ' is-edge' : ''}`}>
                <rect
                  className="rb-tl-tick-hit"
                  x={x(tick)}
                  y={0}
                  width={TICK_W}
                  height={RULER_H}
                  onClick={() => onSelectTick(tick)}
                  data-testid={`ide-timing-lanes-tick-${tick}`}
                />
                <line x1={x(tick)} x2={x(tick)} y1={RULER_H - 5} y2={height} className="rb-tl-grid" />
                <text className="rb-tl-tick-label" x={x(tick) + TICK_W / 2} y={RULER_H - 7} textAnchor="middle">
                  {tick}
                </text>
                {risingEdges.has(tick) ? (
                  <path className="rb-tl-edge" d={`M ${x(tick) - 4} ${RULER_H - 2} L ${x(tick)} ${RULER_H - 6} L ${x(tick) + 4} ${RULER_H - 2} Z`} />
                ) : null}
                {caseEvidenceByTick?.[tick] === 'fail' ? (
                  <circle className="rb-tl-fail" cx={x(tick) + TICK_W / 2} cy={3.5} r={2.5} />
                ) : null}
              </g>
            ))}
          </g>
          {/* group headers */}
          <text className="rb-tl-group" x={8} y={RULER_H + GROUP_H - 5}>Stimulus</text>
          <line className="rb-tl-group-rule" x1={0} x2={width} y1={RULER_H + GROUP_H} y2={RULER_H + GROUP_H} />
          <text className="rb-tl-group" x={8} y={outputsTop - 5}>Outputs · expected over observed</text>
          <line className="rb-tl-group-rule" x1={0} x2={width} y1={outputsTop} y2={outputsTop} />
          {/* generated clock lanes: one active edge per tick, read-only */}
          {generatedClocks.map((clockId, laneIndex) => {
            const top = inputsTop + laneIndex * LANE_H;
            const hi = top + 5;
            const lo = top + LANE_H - 6;
            const d = ticks.map((tick) => `M ${x(tick)} ${lo} H ${x(tick) + TICK_W / 2} V ${hi} H ${x(tick) + TICK_W} V ${lo}`).join(" ");
            return (
              <g key={clockId} className="rb-tl-lane rb-tl-lane--input is-clock is-generated" data-testid={`ide-timing-lane-${clockId}`}>
                <line className="rb-tl-lane-rule" x1={0} x2={width} y1={top + LANE_H} y2={top + LANE_H} />
                <title>{`${clockId.toUpperCase()} — generated by the clock policy: one active edge per tick`}</title>
                <text className="rb-tl-label" x={8} y={top + LANE_H / 2 + 4}>{fitLabel(clockId.toUpperCase(), true)}</text>
                <text className="rb-tl-tag" x={LABEL_W - 8} y={top + LANE_H / 2 + 4} textAnchor="end">1 edge/tick</text>
                <path className="rb-tl-trace" d={d} />
              </g>
            );
          })}
          {/* input lanes */}
          {lanes.map((field, laneIndex) => {
            const top = inputsTop + (generatedClocks.length + laneIndex) * LANE_H;
            const isClock = clockFieldIds.has(field.id);
            const isReset = !isClock && isResetField(field);
            const isGenerated = generatedFieldIds?.has(field.id) ?? false;
            const laneValueAt = (tick: number) => (isGenerated ? generatedValueAt?.(field.id, tick) ?? inputAt(field.id, tick) : inputAt(field.id, tick));
            return (
              <g
                key={field.id}
                className={`rb-tl-lane rb-tl-lane--input${isClock ? ' is-clock' : ''}${isReset ? ' is-reset' : ''}${isGenerated ? ' is-generated' : ''}`}
                data-testid={`ide-timing-lane-${field.id}`}
                data-generated={isGenerated ? 'true' : undefined}
              >
                {isGenerated && generatedNote ? <title>{generatedNote}</title> : null}
                <line className="rb-tl-lane-rule" x1={0} x2={width} y1={top + LANE_H} y2={top + LANE_H} />
                <title>{field.label}</title>
                <text className="rb-tl-label" x={8} y={top + LANE_H / 2 + 4}>
                  {fitLabel(
                    field.label,
                    (isClock && !NAMES_ITSELF_CLOCK.test(field.label)) ||
                      (isReset && !NAMES_ITSELF_RESET.test(field.label))
                  )}
                </text>
                {/* The tag says what the lane is when its name does not already say it. A lane
                    called RST tagged "rst" is the same word twice in 132px. */}
                {isClock && !NAMES_ITSELF_CLOCK.test(field.label) ? (
                  <text className="rb-tl-tag" x={LABEL_W - 8} y={top + LANE_H / 2 + 4} textAnchor="end">clk</text>
                ) : null}
                {isReset && !NAMES_ITSELF_RESET.test(field.label) ? (
                  <text className="rb-tl-tag" x={LABEL_W - 8} y={top + LANE_H / 2 + 4} textAnchor="end">rst</text>
                ) : null}
                <path className="rb-tl-trace" d={tracePath((tick) => laneValueAt(tick), top)} />
                {ticks.map((tick) => {
                  const value = laneValueAt(tick);
                  return (
                    <rect
                      key={tick}
                      className={`rb-tl-cell${!isGenerated && eventTicks.has(tick) && ordered.find((v) => v.tick === tick)?.inputs[field.id] != null ? ' is-event' : ''}${isGenerated ? ' is-generated' : ''}`}
                      x={x(tick)}
                      y={top}
                      width={TICK_W}
                      height={LANE_H}
                      role="gridcell"
                      aria-label={`${field.label} at t${tick}: ${value}${isGenerated ? ' (generated by the clock policy)' : ''}`}
                      aria-readonly={isGenerated ? 'true' : undefined}
                      data-generated={isGenerated ? 'true' : undefined}
                      data-testid={`ide-timing-cell-${field.id}-${tick}`}
                      onClick={() => {
                        onSelectTick(tick);
                        if (editable && !isGenerated) onDriveInput(tick, field.id, value === 1 ? 0 : 1);
                      }}
                    />
                  );
                })}
              </g>
            );
          })}
          {/* output lanes */}
          {outputFields.map((field, laneIndex) => {
            const top = outputsTop + laneIndex * LANE_H;
            const observedTrace = tracePath((tick) => {
              const observed = observedAt(field.id, tick);
              return observed === '1' ? 1 : observed === '0' ? 0 : null;
            }, top);
            return (
              <g key={field.id} className="rb-tl-lane rb-tl-lane--output" data-testid={`ide-timing-lane-${field.id}`}>
                <line className="rb-tl-lane-rule" x1={0} x2={width} y1={top + LANE_H} y2={top + LANE_H} />
                <title>{field.label}</title>
                <text className="rb-tl-label" x={8} y={top + LANE_H / 2 + 4}>
                  {fitLabel(field.label, false)}
                </text>
                <path className="rb-tl-trace rb-tl-trace--observed" d={observedTrace} />
                {ticks.map((tick) => {
                  const expected = expectedAt(field.id, tick);
                  const observed = observedAt(field.id, tick);
                  const mismatch = expected != null && observed != null && String(expected) !== observed;
                  const y = expected === 1 ? top + 5 : top + LANE_H - 6;
                  return (
                    <g key={tick}>
                      {expected != null ? (
                        <g className={`rb-tl-expected${mismatch ? ' is-fail' : observed != null ? ' is-pass' : ''}`}>
                          <line x1={x(tick) + 4} x2={x(tick) + TICK_W - 4} y1={y} y2={y} />
                          <text x={x(tick) + TICK_W / 2} y={expected === 1 ? y + 12 : y - 4} textAnchor="middle" className="rb-tl-expected-label">
                            {expected}
                          </text>
                        </g>
                      ) : null}
                      <rect
                        className={`rb-tl-cell rb-tl-cell--output${mismatch ? ' is-fail' : ''}`}
                        x={x(tick)}
                        y={top}
                        width={TICK_W}
                        height={LANE_H}
                        role="gridcell"
                        aria-label={`${field.label} at t${tick}: expected ${expected ?? 'unset'}, observed ${observed ?? 'none'}`}
                        data-testid={`ide-timing-check-${field.id}-${tick}`}
                        onClick={() => {
                          onSelectTick(tick);
                          if (editable) onCycleExpected(tick, field.id);
                        }}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
