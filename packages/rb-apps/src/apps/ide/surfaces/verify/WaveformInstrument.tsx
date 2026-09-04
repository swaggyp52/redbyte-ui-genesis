import React, { useEffect, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WaveformSignalRow {
  signal: string;
  values: Array<{ tick: number; value: string }>;
}

export type SignalLaneGroup = 'Inputs' | 'Outputs' | 'Internal';

export interface WaveformViewerProps {
  signals: WaveformSignalRow[];
  ticks: number[];
  failTicks: Set<number>;
  failingSignalKeys: Set<string>;
  selectedTick: number | null;
  cursorA: number | null;
  cursorB: number | null;
  pinnedSignals: Set<string>;
  onSelectTick: (tick: number) => void;
  onSelectSignal: (signal: string) => void;
  rowHeight?: number;
  tickWidth?: number;
  emptyMessage?: string;
  signalMeta?: Map<string, { direction: 'in' | 'out'; pin?: string }>;
  isSequential?: boolean;
  clockSignals?: Set<string>;
  onHoverSignal?: (signal: string | null) => void;
  selectedSignal?: string | null;
  signalGroups?: Map<string, SignalLaneGroup>;
  ghostSignals?: Array<{ signal: string; label?: string; direction: 'in' | 'out' | 'internal' }>;
  /** Toggles a lane in the pinned set (pinned lanes sort to the top). */
  onTogglePinSignal?: (signal: string) => void;
  /** Hides a lane; the surface offers the restore affordance. */
  onHideSignal?: (signal: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toTestId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

// ─── WaveformViewer ──────────────────────────────────────────────────────────

const GROUP_LABELS: Record<SignalLaneGroup, string> = {
  Inputs: 'Stimulus',
  Outputs: 'Observed',
  Internal: 'Internal',
};

export const WaveformViewer: React.FC<WaveformViewerProps> = ({
  signals,
  ticks,
  failTicks,
  failingSignalKeys,
  selectedTick,
  cursorA,
  cursorB,
  pinnedSignals,
  onSelectTick,
  onSelectSignal,
  rowHeight = 44,
  tickWidth = 54,
  emptyMessage = 'Run simulation to see waveforms',
  signalMeta,
  isSequential = false,
  clockSignals,
  onHoverSignal,
  selectedSignal = null,
  signalGroups,
  ghostSignals,
  onTogglePinSignal,
  onHideSignal,
}) => {
  const LABEL_W = 128;
  const ROW_H = rowHeight;
  const ROW_HI = Math.round(ROW_H * 0.22);
  const ROW_LO = Math.round(ROW_H * 0.78);
  const HEADER_H = 28;
  const BASE_TICK_W = tickWidth;
  const GROUP_HEADER_H = 20;

  // Hover cursor state (vertical line tracking mouse X)
  const [hoverTickX, setHoverTickX] = useState<number | null>(null);
  const waveformRef = useRef<SVGSVGElement | null>(null);
  const [viewportTrackWidth, setViewportTrackWidth] = useState(0);

  type LayoutRow =
    | { kind: 'header'; group: SignalLaneGroup; y: number }
    | { kind: 'signal'; signalRow: WaveformSignalRow; stripeIndex: number; y: number };

  const { layoutRows, totalHeight } = (() => {
    const rows: LayoutRow[] = [];
    let y = HEADER_H;
    let lastGroup: SignalLaneGroup | null = null;
    let stripeIndex = 0;
    for (const signalRow of signals) {
      const group = signalGroups?.get(signalRow.signal) ?? 'Internal';
      if (group !== lastGroup && signalGroups) {
        rows.push({ kind: 'header', group, y });
        y += GROUP_HEADER_H;
        lastGroup = group;
      }
      rows.push({ kind: 'signal', signalRow, stripeIndex: stripeIndex++, y });
      y += ROW_H;
    }
    return { layoutRows: rows, totalHeight: y };
  })();

  useEffect(() => {
    if (signals.length === 0 || ticks.length === 0) return;
    const measure = () => {
      const containerWidth = waveformRef.current?.parentElement?.clientWidth ?? 0;
      const nextTrackWidth = containerWidth > LABEL_W ? Math.round(containerWidth - LABEL_W) : 0;
      setViewportTrackWidth(nextTrackWidth);
    };
    measure();
    if (typeof window === 'undefined') return;
    const container = waveformRef.current?.parentElement;
    const resizeObserver =
      container && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(measure)
        : null;
    resizeObserver?.observe(container);
    window.addEventListener('resize', measure);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [signals.length, ticks.length, LABEL_W]);

  const trackWidth = ticks.length > 0
    ? Math.max(ticks.length * BASE_TICK_W, viewportTrackWidth)
    : 0;
  const TICK_W = ticks.length > 0 ? trackWidth / ticks.length : BASE_TICK_W;
  const width = LABEL_W + trackWidth;
  const height = totalHeight;
  const ghostViewportRef = useRef<HTMLDivElement | null>(null);
  const [ghostTrackWidth, setGhostTrackWidth] = useState(640);

  useEffect(() => {
    if (signals.length !== 0 || !ghostSignals || ghostSignals.length === 0) return;
    const measure = () => {
      const containerWidth = ghostViewportRef.current?.clientWidth ?? 0;
      const nextWidth = containerWidth > LABEL_W ? containerWidth - LABEL_W : 640;
      setGhostTrackWidth(Math.max(360, nextWidth));
    };
    measure();
    if (typeof window === 'undefined') return;
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [ghostSignals, signals.length, LABEL_W]);

  if (signals.length === 0) {
    // Ghost lanes: if mapped signals exist, render empty instrument channels waiting for data
    if (ghostSignals && ghostSignals.length > 0) {
      const GHOST_LABEL_W = 112;
      const GHOST_ROW_H = ROW_H;
      const GHOST_HEADER_H = 16;
      const GHOST_TRACK_W = ghostTrackWidth;
      const inputs = ghostSignals.filter(s => s.direction === 'in');
      const outputs = ghostSignals.filter(s => s.direction === 'out' || s.direction === 'internal');

      // Build rows with group headers
      type GhostRow =
        | { kind: 'group-header'; label: string; y: number }
        | { kind: 'lane'; sig: typeof ghostSignals[0]; y: number; stripe: number };
      const ghostRows: GhostRow[] = [];
      let gy = GHOST_HEADER_H;
      let stripe = 0;
      const appendGroup = (label: string, sigs: typeof ghostSignals) => {
        if (sigs.length === 0) return;
        ghostRows.push({ kind: 'group-header', label, y: gy });
        gy += 20;
        for (const sig of sigs) {
          ghostRows.push({ kind: 'lane', sig, y: gy, stripe: stripe++ });
          gy += GHOST_ROW_H;
        }
      };
      appendGroup('Stimulus', inputs);
      appendGroup('Observed', outputs);

      return (
        <div
          ref={ghostViewportRef}
          className="ide-verify-waveform-ghost"
          data-testid="ide-verify-waveform-empty"
          style={{ width: '100%', overflowX: 'auto' }}
        >
          <svg
            width={GHOST_LABEL_W + GHOST_TRACK_W}
            height={gy}
            style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', overflow: 'visible', minWidth: '100%' }}
          >
            <rect x={0} y={0} width={GHOST_LABEL_W + GHOST_TRACK_W} height={gy} fill="var(--rb-wave-bg)" />
            <line x1={0} y1={GHOST_HEADER_H - 1} x2={GHOST_LABEL_W + GHOST_TRACK_W} y2={GHOST_HEADER_H - 1} stroke="var(--rb-wave-grid)" strokeWidth={1} />

            {ghostRows.map((row, i) => {
              if (row.kind === 'group-header') {
                const isObserved = row.label === 'Observed';
                return (
                  <g key={`gh-${i}`} data-testid={`ide-verify-waveform-ghost-group-${row.label.toLowerCase()}`}>
                    <rect x={0} y={row.y} width={GHOST_LABEL_W + GHOST_TRACK_W} height={20} fill="var(--rb-wave-header-bg)" />
                    <line x1={0} y1={row.y} x2={GHOST_LABEL_W + GHOST_TRACK_W} y2={row.y}
                      stroke={isObserved ? 'var(--rb-wave-out-soft)' : 'var(--rb-wave-in-soft)'}
                      strokeWidth={1} />
                    <text x={10} y={row.y + 13}
                      fill={isObserved ? 'var(--rb-wave-out)' : 'var(--rb-wave-in)'}
                      fontSize={9} fontWeight={700} letterSpacing={2}>
                      {row.label.toUpperCase()}
                    </text>
                  </g>
                );
              }
              const { sig, y, stripe: s } = row;
              const midY = y + GHOST_ROW_H / 2;
              const label = sig.label ?? sig.signal;
              const isInput = sig.direction === 'in';
              return (
                <g key={`gl-${i}`}>
                  {/* Lane stripe */}
                  <rect x={0} y={y} width={GHOST_LABEL_W + GHOST_TRACK_W} height={GHOST_ROW_H}
                    fill={s % 2 === 0 ? 'var(--rb-wave-stripe)' : 'var(--rb-wave-bg)'} />
                  {/* Label */}
                  <text x={12} y={midY + 4} fill="var(--rb-wave-text-2)" fontSize={11} fontWeight={500}>
                    {label.length > 14 ? label.slice(0, 13) + '…' : label}
                  </text>
                  {/* Direction dot */}
                  <circle cx={GHOST_LABEL_W - 12} cy={midY} r={3.5}
                    fill={isInput ? 'var(--rb-wave-in)' : 'var(--rb-wave-out)'}
                    stroke={isInput ? 'var(--rb-wave-grid)' : 'var(--rb-wave-out-soft)'}
                    strokeWidth={1} />
                  {/* Divider */}
                  <line x1={GHOST_LABEL_W} y1={y} x2={GHOST_LABEL_W} y2={y + GHOST_ROW_H} stroke="var(--rb-wave-grid-strong)" strokeWidth={1} />
                  {/* Single quiet baseline to show where trace data will appear */}
                  <line x1={GHOST_LABEL_W + 8} y1={midY} x2={GHOST_LABEL_W + GHOST_TRACK_W} y2={midY}
                    stroke={isInput ? 'var(--rb-wave-in)' : 'var(--rb-wave-out)'}
                    strokeWidth={1}
                    strokeDasharray="6 8" />
                  {/* Row bottom border */}
                  <line x1={0} y1={y + GHOST_ROW_H} x2={GHOST_LABEL_W + GHOST_TRACK_W} y2={y + GHOST_ROW_H} stroke="var(--rb-wave-row-line)" strokeWidth={1} />
                </g>
              );
            })}
          </svg>
        </div>
      );
    }
    return (
      <div className="ide-verify-waveform-empty" data-testid="ide-verify-waveform-empty">
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <svg
      ref={waveformRef}
      width={width}
      height={height}
      style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', overflow: 'visible', shapeRendering: 'crispEdges' }}
      data-testid="ide-verify-waveform-svg"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        setHoverTickX(x > LABEL_W ? x : null);
      }}
      onMouseLeave={() => setHoverTickX(null)}
    >
      <defs>
        <filter id="wfCursorGlow" x="-30%" y="0%" width="160%" height="100%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Dark PCB-style background */}
      <rect width={width} height={height} fill="var(--rb-wave-bg)" />
      {/* Header strip — distinct background */}
      <rect width={width} height={HEADER_H} fill="var(--rb-wave-header-bg)" />
      {/* Label column background */}
      <rect x={0} y={HEADER_H} width={LABEL_W} height={height - HEADER_H} fill="var(--rb-wave-gutter-bg)" />

      {/* Minor + major vertical grid lines (steel-blue, not teal) */}
      {ticks.map((tick, i) => (
        <line key={`grid-${tick}`}
          x1={LABEL_W + i * TICK_W} y1={HEADER_H} x2={LABEL_W + i * TICK_W} y2={height}
          stroke="var(--rb-wave-grid)" strokeWidth="1" />
      ))}
      {ticks.map((tick, i) => (ticks.length <= 32 || i % 5 === 0) ? (
        <line key={`grid-major-${tick}`}
          x1={LABEL_W + i * TICK_W} y1={HEADER_H} x2={LABEL_W + i * TICK_W} y2={height}
          stroke="var(--rb-wave-grid-strong)" strokeWidth="1.2" />
      ) : null)}

      {/* Fail markers in header rail */}
      {ticks.map((tick, i) => failTicks.has(tick) ? (
        <line
          key={`fail-marker-${tick}`}
          x1={LABEL_W + i * TICK_W + TICK_W / 2}
          y1={2}
          x2={LABEL_W + i * TICK_W + TICK_W / 2}
          y2={HEADER_H}
          stroke="var(--rb-wave-fail)"
          strokeWidth="2"
        />
      ) : null)}

      {/* Fail column full-height overlay — drawn before signal rows so it sits behind traces */}
      {ticks.map((tick, i) => failTicks.has(tick) ? (
        <rect
          key={`fcol-${tick}`}
          x={LABEL_W + i * TICK_W}
          y={HEADER_H}
          width={TICK_W}
          height={height - HEADER_H}
          fill="var(--rb-wave-fail-band)"
        />
      ) : null)}

      {/* Clock edge markers — small ↑ glyphs for sequential circuits */}
      {isSequential && ticks.map((tick, i) => (
        <text
          key={`clk-${tick}`}
          x={LABEL_W + i * TICK_W + TICK_W / 2}
          y={HEADER_H - 4}
          textAnchor="middle"
          fontSize={7}
          fill="var(--rb-wave-text-3)"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          ↑
        </text>
      ))}

      {/* Tick labels in header — number every 5th, dot otherwise */}
      {ticks.map((tick, i) => i % 5 === 0 ? (
        <text
          key={`label-${tick}`}
          x={LABEL_W + i * TICK_W + TICK_W / 2}
          y={15}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--rb-wave-text-2)"
          fontSize={11}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {tick}
        </text>
      ) : (
        <circle
          key={`label-${tick}`}
          cx={LABEL_W + i * TICK_W + TICK_W / 2}
          cy={15}
          r={1.5}
          fill="var(--rb-wave-grid)"
        />
      ))}

      {/* Signal rows with group headers */}
      {layoutRows.map((layoutRow) => {
        if (layoutRow.kind === 'header') {
          const { group, y } = layoutRow;
          return (
            <g key={`group-header-${group}`} data-testid={`ide-verify-waveform-group-${group.toLowerCase()}`}>
              <rect x={0} y={y} width={width} height={GROUP_HEADER_H}
                fill={group === 'Outputs' ? 'var(--rb-wave-out-soft)' : 'var(--rb-wave-in-soft)'} />
              <line x1={0} y1={y} x2={width} y2={y}
                stroke={group === 'Outputs' ? 'var(--rb-wave-out)' : 'var(--rb-wave-grid-strong)'} strokeWidth="1" />
              <text
                x={LABEL_W - 8}
                y={y + GROUP_HEADER_H / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="9"
                fontWeight="700"
                fill={group === 'Outputs' ? 'var(--rb-wave-out)' : 'var(--rb-wave-in)'}
                style={{ pointerEvents: 'none', userSelect: 'none' } as React.CSSProperties}
              >
                {GROUP_LABELS[group]}
              </text>
              <line x1={LABEL_W} y1={y} x2={LABEL_W} y2={y + GROUP_HEADER_H}
                stroke={group === 'Outputs' ? 'var(--rb-wave-out)' : 'var(--rb-wave-grid-strong)'} strokeWidth={group === 'Outputs' ? '2' : '1.5'} />
            </g>
          );
        }

        const { signalRow, stripeIndex, y } = layoutRow;
        const normalizedKey = signalRow.signal.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const isFailing = failingSignalKeys.has(normalizedKey);
        const isPinned = pinnedSignals.has(signalRow.signal);
        const isClockSignal = clockSignals?.has(normalizedKey) ?? false;
        const signalDirection = signalGroups?.get(signalRow.signal)?.toLowerCase() ?? 'unknown';
        const isInputSignal = signalDirection === 'inputs';

        return (
          <g
            key={signalRow.signal}
            data-testid={`ide-verify-waveform-row-${toTestId(signalRow.signal)}`}
            data-selected={selectedSignal === signalRow.signal ? 'true' : 'false'}
            data-direction={signalDirection}
          >
            {/* Alternating row background */}
            <rect
              x={0}
              y={y}
              width={width}
              height={ROW_H}
              fill={stripeIndex % 2 === 0 ? 'var(--rb-wave-stripe)' : 'transparent'}
            />
            {/* Row separator */}
            <line x1={0} y1={y + ROW_H - 1} x2={width} y2={y + ROW_H - 1}
              stroke="var(--rb-wave-row-line)" strokeWidth="1" />

          {/* Signal label column */}
            <g
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectSignal(signalRow.signal)}
              onMouseEnter={() => onHoverSignal?.(signalRow.signal)}
              onMouseLeave={() => onHoverSignal?.(null)}
            >
              <title>{signalRow.signal}</title>
              {onTogglePinSignal ? (
                <text
                  x={4}
                  y={y + Math.round(ROW_H / 2) + 4}
                  fontSize="11"
                  fill={isPinned ? 'var(--rb-wave-pin)' : 'var(--rb-wave-text-3)'}
                  data-testid={`ide-verify-lane-pin-${toTestId(signalRow.signal)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onTogglePinSignal(signalRow.signal);
                  }}
                >
                  <title>{isPinned ? `Unpin ${signalRow.signal}` : `Pin ${signalRow.signal} to the top`}</title>
                  {isPinned ? '★' : '☆'}
                </text>
              ) : null}
              {onHideSignal ? (
                <text
                  x={17}
                  y={y + Math.round(ROW_H / 2) + 4}
                  fontSize="11"
                  fill="var(--rb-wave-text-3)"
                  data-testid={`ide-verify-lane-hide-${toTestId(signalRow.signal)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onHideSignal(signalRow.signal);
                  }}
                >
                  <title>{`Hide ${signalRow.signal} for this session`}</title>
                  ×
                </text>
              ) : null}
              {/* Name */}
              <text
                x={LABEL_W - 8}
                y={y + (signalMeta?.has(signalRow.signal) ? Math.round(ROW_H * 0.38) : Math.round(ROW_H / 2) + 4)}
                textAnchor="end"
                fontSize="11"
                fill={isFailing ? 'var(--rb-wave-fail-text)' : isClockSignal ? 'var(--rb-wave-clock)' : 'var(--rb-wave-text)'}
              >
                {`${isPinned && !onTogglePinSignal ? '★ ' : ''}${isClockSignal ? '⏱ ' : ''}${
                  signalRow.signal.length > 14 ? `${signalRow.signal.slice(0, 13)}…` : signalRow.signal
                }`}
              </text>
              {/* Direction + pin sub-line */}
              {(() => {
                const meta = signalMeta?.get(signalRow.signal);
                if (!meta) return null;
                const dirLabel = meta.direction === 'in' ? '▲ IN' : '▼ OUT';
                const pinLabel = meta.pin ? ` · ${meta.pin}` : '';
                return (
                  <text
                    x={LABEL_W - 8}
                    y={y + Math.round(ROW_H * 0.7)}
                    textAnchor="end"
                    fontSize="9"
                    fill={isFailing ? 'var(--rb-wave-fail-text)' : isInputSignal ? 'var(--rb-wave-in)' : 'var(--rb-wave-out)'}
                  >
                    {`${dirLabel}${pinLabel}`}
                  </text>
                );
              })()}
            </g>

            {/* Signal trace */}
            {signalRow.values.map((point, i) => {
              const isHigh = point.value === '1';
              const isUnknown = point.value === 'X' || point.value === 'Z';
              const tickX = LABEL_W + i * TICK_W;
              const isFail = failTicks.has(point.tick);
              const isSelected = point.tick === selectedTick;
              const prevValue = i > 0 ? signalRow.values[i - 1]?.value : null;
              const hasBinaryTransition =
                (prevValue === '0' || prevValue === '1') &&
                (point.value === '0' || point.value === '1') &&
                prevValue !== point.value;

              return (
                <g key={`${signalRow.signal}-${point.tick}`}>
                  {/* Fail segment highlight */}
                  {isFail && (
                    <rect x={tickX} y={y} width={TICK_W} height={ROW_H} fill="var(--rb-wave-fail-band)" />
                  )}

                  {/* Selected tick column highlight — drawn once, on the first lane, for the whole column */}
                  {isSelected && stripeIndex === 0 && (
                    <rect
                      x={tickX}
                      y={HEADER_H}
                      width={TICK_W}
                      height={height - HEADER_H}
                      fill="var(--rb-wave-select-soft)"
                    />
                  )}

                  {/* Signal rail — 3px horizontal line at hi or lo position */}
                  {point.value !== '-' && !isUnknown && (
                    <line
                      x1={tickX + 2}          y1={isHigh ? y + ROW_HI : y + ROW_LO}
                      x2={tickX + TICK_W - 2} y2={isHigh ? y + ROW_HI : y + ROW_LO}
                      stroke={
                        isFail
                          ? (isHigh ? 'var(--rb-wave-fail)' : 'var(--rb-wave-fail)')
                          : isClockSignal
                            ? (isHigh ? 'var(--rb-wave-clock)' : 'var(--rb-wave-clock)')
                            : isInputSignal
                              ? (isHigh ? 'var(--rb-wave-in)' : 'var(--rb-wave-in)')
                              : (isHigh ? 'var(--rb-wave-out)' : 'var(--rb-wave-out)')
                      }
                      strokeWidth="5.5" strokeLinecap="round"
                    />
                  )}

                  {/* Unknown/high-impedance values use a labeled center rail so they cannot be mistaken for LOW. */}
                  {isUnknown && (
                    <>
                      <line
                        x1={tickX + 2}
                        y1={y + ROW_H / 2}
                        x2={tickX + TICK_W - 2}
                        y2={y + ROW_H / 2}
                        stroke="var(--rb-wave-clock)"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray="5 4"
                      />
                      <text
                        x={tickX + TICK_W / 2}
                        y={y + ROW_H / 2 + 4}
                        textAnchor="middle"
                        fill="var(--rb-wave-marker-fill)"
                        fontSize="11"
                        fontWeight="800"
                        aria-hidden="true"
                      >
                        {point.value}
                      </text>
                    </>
                  )}

                  {/* Transition vertical line connecting rail positions */}
                  {hasBinaryTransition && (
                    <line
                      x1={tickX} y1={y + ROW_HI} x2={tickX} y2={y + ROW_LO}
                      stroke={isFail ? 'var(--rb-wave-fail)' : isClockSignal ? 'var(--rb-wave-clock)' : isInputSignal ? 'var(--rb-wave-in)' : 'var(--rb-wave-out)'}
                      strokeWidth="2.5" strokeLinecap="round"
                    />
                  )}

                  {/* Transparent click target */}
                  <rect
                    x={tickX}
                    y={y}
                    width={TICK_W}
                    height={ROW_H}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      onSelectTick(point.tick);
                      onSelectSignal(signalRow.signal);
                    }}
                    onMouseEnter={() => onHoverSignal?.(signalRow.signal)}
                    onMouseLeave={() => onHoverSignal?.(null)}
                    data-testid="ide-verify-waveform-point"
                    data-value={String(point.value)}
                  />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* A/B cursors */}
      {([
        { id: 'A', tick: cursorA, stroke: 'var(--rb-wave-cursor-a)', fill: 'var(--rb-wave-select-soft)' },
        { id: 'B', tick: cursorB, stroke: 'var(--rb-wave-cursor-b)', fill: 'var(--rb-wave-select-soft)' },
      ] as const).map((cursor) => {
        if (cursor.tick === null) return null;
        const i = ticks.indexOf(cursor.tick);
        if (i < 0) return null;
        const cx = LABEL_W + i * TICK_W + TICK_W / 2;
        return (
          <g key={`cursor-${cursor.id}`} style={{ pointerEvents: 'none' }}>
            <line
              x1={cx}
              y1={HEADER_H}
              x2={cx}
              y2={height}
              stroke={cursor.stroke}
              strokeWidth="1.25"
              strokeDasharray="4 3"
            />
            <rect x={cx - 9} y={2} width={18} height={12} rx={2} fill={cursor.fill} />
            <text
              x={cx}
              y={8}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={cursor.stroke}
              fontSize={9}
              fontWeight="700"
            >
              {cursor.id}
            </text>
          </g>
        );
      })}

      {/* Selected tick vertical cursor + badge */}
      {selectedTick !== null && (() => {
        const i = ticks.indexOf(selectedTick);
        if (i < 0) return null;
        const cx = LABEL_W + i * TICK_W + TICK_W / 2;
        return (
          <g style={{ pointerEvents: 'none' }}>
            <line
              x1={cx} y1={HEADER_H}
              x2={cx} y2={height}
              stroke="var(--rb-wave-hover)"
              strokeWidth="1.5"
              filter="url(#wfCursorGlow)"
            />
            {/* Tick badge pinned to top of cursor */}
            <rect x={cx - 14} y={1} width={28} height={14} rx={3} fill="var(--rb-wave-select-soft)" />
            <text
              x={cx} y={9}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--rb-wave-hover)"
              fontSize={9}
              fontWeight="700"
              style={{ userSelect: 'none' }}
            >
              t{selectedTick}
            </text>
          </g>
        );
      })()}

      {/* Selected-tick highlight column — subtle background fill */}
      {selectedTick !== null && (() => {
        const i = ticks.indexOf(selectedTick);
        if (i < 0) return null;
        return (
          <rect
            x={LABEL_W + i * TICK_W}
            y={HEADER_H}
            width={TICK_W}
            height={height - HEADER_H}
            fill="var(--rb-wave-select-soft)"
            style={{ pointerEvents: 'none' }}
          />
        );
      })()}

      {/* Hover cursor — vertical line following mouse */}
      {hoverTickX !== null && (
        <line
          x1={hoverTickX}
          y1={HEADER_H}
          x2={hoverTickX}
          y2={height}
          stroke="var(--rb-wave-grid-strong)"
          strokeWidth="1"
          strokeDasharray="2 2"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Label column separator */}
      <line
        x1={LABEL_W}
        y1={0}
        x2={LABEL_W}
        y2={height}
        stroke="var(--rb-wave-grid-strong)"
        strokeWidth="1.5"
      />
    </svg>
  );
};
