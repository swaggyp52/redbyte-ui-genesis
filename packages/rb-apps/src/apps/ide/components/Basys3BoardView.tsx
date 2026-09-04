import React from 'react';
import styles from './Basys3BoardView.module.css';

/** Presentation layers for the board twin. They change what is drawn, never the mapping. */
export interface Basys3BoardLayers {
  /** Resource alias labels (LD0, SW3, BTNC …). */
  readonly labels: boolean;
  /** Mapped-resource highlighting. */
  readonly mapped: boolean;
  /** Compatible-target highlighting while a signal is selected. */
  readonly compatible: boolean;
  /** Conflict highlighting (two signals on one pin, wrong direction). */
  readonly conflicts: boolean;
}

export const DEFAULT_BASYS3_BOARD_LAYERS: Basys3BoardLayers = Object.freeze({
  labels: true,
  mapped: true,
  compatible: true,
  conflicts: true,
});

const EMPTY_ALIASES: Set<string> = new Set();

export interface Basys3BoardViewProps {
  mappedAliases: Set<string>;
  /** Aliases whose mapping is in conflict; drawn in the failure colour when the layer is on. */
  conflictAliases?: Set<string>;
  layers?: Basys3BoardLayers;
  highlightedAlias?: string | null;
  allowedAliases?: Set<string>;
  assignmentMode?: boolean;
  onSelectAlias: (alias: string) => void;
}

const BTN_DEFS = [
  { cx: 155, cy: 135, alias: 'BTNC', label: 'C', labelX: 155, labelY: 139 },
  { cx: 155, cy: 108, alias: 'BTNU', label: 'U', labelX: 155, labelY: 89 },
  { cx: 155, cy: 162, alias: 'BTND', label: 'D', labelX: 155, labelY: 185 },
  { cx: 128, cy: 135, alias: 'BTNL', label: 'L', labelX: 101, labelY: 139 },
  { cx: 182, cy: 135, alias: 'BTNR', label: 'R', labelX: 209, labelY: 139 },
];

// AN3 = leftmost digit, AN0 = rightmost (Basys3 convention)
const SSD_DIGITS = [
  { cx: 420, cy: 127, an: 'AN3' },
  { cx: 454, cy: 127, an: 'AN2' },
  { cx: 488, cy: 127, an: 'AN1' },
  { cx: 522, cy: 127, an: 'AN0' },
];

// 7-segment defs relative to digit center (CA=top, CB=top-right, ... CG=middle)
const SEG_DEFS = [
  { alias: 'CA', dx: -9,  dy: -18, w: 18, h: 4,  rx: 2 }, // top
  { alias: 'CB', dx: 8,   dy: -16, w: 4,  h: 12, rx: 2 }, // top-right
  { alias: 'CC', dx: 8,   dy: 2,   w: 4,  h: 12, rx: 2 }, // bot-right
  { alias: 'CD', dx: -9,  dy: 14,  w: 18, h: 4,  rx: 2 }, // bottom
  { alias: 'CE', dx: -14, dy: 2,   w: 4,  h: 12, rx: 2 }, // bot-left
  { alias: 'CF', dx: -14, dy: -16, w: 4,  h: 12, rx: 2 }, // top-left
  { alias: 'CG', dx: -9,  dy: -2,  w: 18, h: 4,  rx: 2 }, // middle
];

function isAllowed(alias: string, allowedAliases?: Set<string>): boolean {
  return !allowedAliases || allowedAliases.has(alias);
}

type ResourceVisualState = 'selected' | 'conflict' | 'mapped' | 'mapped-unavailable' | 'available' | 'idle' | 'unavailable';

function resourceVisualState(
  alias: string,
  mappedAliases: Set<string>,
  highlightedAlias?: string | null,
  allowedAliases?: Set<string>,
  assignmentMode = false,
  conflictAliases?: Set<string>
): ResourceVisualState {
  if (alias === highlightedAlias) return 'selected';
  if (conflictAliases?.has(alias)) return 'conflict';
  if (!isAllowed(alias, allowedAliases)) return mappedAliases.has(alias) ? 'mapped-unavailable' : 'unavailable';
  if (mappedAliases.has(alias)) return 'mapped';
  return assignmentMode ? 'available' : 'idle';
}

function resourceClassName(state: ResourceVisualState): string {
  return [
    styles.resource,
    state === 'selected' ? styles.resourceSelected : '',
    state === 'mapped' ? styles.resourceMapped : '',
    state === 'mapped-unavailable' ? styles.resourceMappedUnavailable : '',
    state === 'conflict' ? styles.resourceConflict : '',
    state === 'unavailable' ? styles.resourceUnavailable : '',
    state === 'selected' ? 'map-hl' : '',
  ].filter(Boolean).join(' ');
}

function regionFill(
  alias: string,
  mappedAliases: Set<string>,
  highlightedAlias?: string | null,
  allowedAliases?: Set<string>,
  assignmentMode = false,
  conflictAliases?: Set<string>
): string {
  const state = resourceVisualState(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases);
  if (state === 'unavailable') return 'rgba(100,116,139,0.14)';
  if (state === 'selected') return 'rgba(245,158,11,0.94)';
  if (state === 'conflict') return 'rgba(239,68,68,0.86)';
  if (state === 'mapped') return 'rgba(34,197,94,0.86)';
  if (state === 'mapped-unavailable') return 'rgba(34,197,94,0.42)';
  if (state === 'available') return 'rgba(56,189,248,0.3)';
  return 'rgba(148,163,184,0.26)';
}

function regionStroke(
  alias: string,
  mappedAliases: Set<string>,
  highlightedAlias?: string | null,
  allowedAliases?: Set<string>,
  assignmentMode = false,
  conflictAliases?: Set<string>
): string {
  const state = resourceVisualState(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases);
  if (state === 'unavailable') return 'rgba(100,116,139,0.34)';
  if (state === 'selected') return '#fff7d6';
  if (state === 'conflict') return '#fecaca';
  if (state === 'mapped') return '#86efac';
  if (state === 'mapped-unavailable') return 'rgba(134,239,172,0.6)';
  if (state === 'available') return '#7dd3fc';
  return '#94a3b8';
}

function regionStrokeWidth(
  alias: string,
  mappedAliases: Set<string>,
  highlightedAlias?: string | null,
  allowedAliases?: Set<string>,
  assignmentMode = false,
  compact = false,
  conflictAliases?: Set<string>
): number {
  const state = resourceVisualState(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases);
  if (state === 'selected') return compact ? 2.2 : 3.2;
  if (state === 'conflict' || state === 'mapped') return compact ? 1.5 : 2;
  if (state === 'available') return compact ? 1.1 : 1.5;
  return compact ? 0.8 : 1;
}

function labelFill(
  alias: string,
  mappedAliases: Set<string>,
  highlightedAlias?: string | null,
  allowedAliases?: Set<string>,
  assignmentMode = false,
  conflictAliases?: Set<string>
): string {
  const state = resourceVisualState(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases);
  if (state === 'unavailable') return '#64748b';
  if (state === 'selected') return '#fff7d6';
  if (state === 'conflict') return '#fecaca';
  if (state === 'mapped') return '#bbf7d0';
  if (state === 'mapped-unavailable') return 'rgba(187,247,208,0.7)';
  if (state === 'available') return '#e0f2fe';
  return '#cbd5e1';
}

function boardCursor(alias: string, allowedAliases?: Set<string>): React.CSSProperties {
  return { cursor: isAllowed(alias, allowedAliases) ? 'pointer' : 'not-allowed' };
}

function selectAllowed(alias: string, allowedAliases: Set<string> | undefined, onSelectAlias: (alias: string) => void): void {
  if (!isAllowed(alias, allowedAliases)) return;
  onSelectAlias(alias);
}

export const Basys3BoardView: React.FC<Basys3BoardViewProps> = ({
  mappedAliases: mappedAliasesProp,
  highlightedAlias,
  allowedAliases: allowedAliasesProp,
  assignmentMode = false,
  onSelectAlias,
  conflictAliases: conflictAliasesProp,
  layers = DEFAULT_BASYS3_BOARD_LAYERS,
}) => {
  // Layers gate what the renderer sees; the mapping itself is untouched.
  const mappedAliases = layers.mapped ? mappedAliasesProp : EMPTY_ALIASES;
  const allowedAliases = layers.compatible ? allowedAliasesProp : undefined;
  const conflictAliases = layers.conflicts ? conflictAliasesProp : undefined;
  return (
    <svg
      data-testid="ide-hw-board-map"
      className={styles.board}
      data-layer-labels={layers.labels ? '1' : '0'}
      viewBox="0 -48 620 308"
      preserveAspectRatio="xMidYMid meet"
      width="100%"
    >
      <defs>
        <pattern id="mapPcbGrid" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M12 0 L0 0 0 12" fill="none" stroke="rgba(0,200,100,0.05)" strokeWidth="0.4" />
        </pattern>
        <linearGradient id="mapChipGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d2035" />
          <stop offset="100%" stopColor="#070f1c" />
        </linearGradient>
        <style>{`
          @keyframes mapHlPulse { 0%,100%{opacity:0.65} 50%{opacity:1} }
          .map-hl { animation: mapHlPulse 1200ms ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) { .map-hl { animation: none; } }
        `}</style>
      </defs>

      {/* The clock is a first-class assignment resource, not an overlay on
          the LED bank. Keep it in a dedicated reference strip so its alias,
          package pin, and frequency remain readable at the native board zoom. */}
      <rect x="10" y="-42" width="600" height="36" rx="8" ry="8"
        fill="#09192e" stroke="rgba(94,234,212,0.36)" strokeWidth="1.5" />
      <text x="26" y="-19" className={styles.sectionLabel} fontFamily="IBM Plex Mono, monospace" fontSize="10"
        fill="#93a9c3" letterSpacing="0.8" style={{ pointerEvents: 'none' }}>
        SYSTEM CLOCK
      </text>

      {/* Board body */}
      <rect x="10" y="10" width="600" height="240" rx="8" ry="8" fill="#0b203d" />
      <rect x="10" y="10" width="600" height="240" rx="8" ry="8" fill="url(#mapPcbGrid)" opacity="0.9" />
      <rect x="10" y="10" width="600" height="240" rx="8" ry="8"
        fill="none" stroke="rgba(94,234,212,0.36)" strokeWidth="1.5" />

      {/* Section dividers */}
      <line x1="18" y1="55" x2="602" y2="55" stroke="rgba(0,200,100,0.07)" strokeWidth="1" />
      <line x1="18" y1="175" x2="602" y2="175" stroke="rgba(0,200,100,0.07)" strokeWidth="1" />

      {/* Silkscreen labels */}
      <text x="20" y="23" className={styles.sectionLabel} fontFamily="IBM Plex Mono, monospace" fontSize="9"
        fill="#93a9c3" letterSpacing="0.8" style={{ pointerEvents: 'none' }}>
        LED OUTPUTS
      </text>
      <text x="20" y="185" className={styles.sectionLabel} fontFamily="IBM Plex Mono, monospace" fontSize="9"
        fill="#93a9c3" letterSpacing="0.8" style={{ pointerEvents: 'none' }}>
        SLIDE SWITCH INPUTS
      </text>
      <text x="20" y="118" className={styles.sectionLabel} fontFamily="IBM Plex Mono, monospace" fontSize="9"
        fill="#93a9c3" style={{ pointerEvents: 'none' }}>BUTTONS</text>

      {/* === 100 MHz oscillator / system clock === */}
      <g
        onClick={() => selectAllowed('CLK100MHZ', allowedAliases, onSelectAlias)}
        style={boardCursor('CLK100MHZ', allowedAliases)}
      >
        <rect
          data-testid="ide-hw-map-clock"
          data-resource-state={resourceVisualState('CLK100MHZ', mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
          x="322"
          y="-37"
          width="272"
          height="26"
          rx="6"
          fill={regionFill('CLK100MHZ', mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
          stroke={regionStroke('CLK100MHZ', mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
          strokeWidth={regionStrokeWidth('CLK100MHZ', mappedAliases, highlightedAlias, allowedAliases, assignmentMode, false, conflictAliases)}
          className={resourceClassName(resourceVisualState('CLK100MHZ', mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases))}
        />
        <rect
          data-testid="ide-hw-map-clock-hit"
          x="314"
          y="-44"
          width="288"
          height="38"
          rx="8"
          fill="transparent"
        />
        <text data-testid="ide-hw-map-clock-alias" data-board-alias="CLK100MHZ" data-board-alias-kind="clock"
          x="458" y="-24" className={styles.aliasLabel} fontFamily="IBM Plex Mono, monospace" fontSize="13"
          fill={labelFill('CLK100MHZ', mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
          textAnchor="middle" style={{ pointerEvents: 'none' }}>
          CLK100MHZ · W5 · 100 MHz
        </text>
      </g>

      {/* FPGA chip */}
      <rect x="238" y="78" width="144" height="104" rx="6" ry="6"
        fill="url(#mapChipGrad)" stroke="rgba(0,180,150,0.22)" strokeWidth="1.5" />
      <rect x="242" y="82" width="136" height="96" rx="4" ry="4"
        fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <text x="310" y="117" className={styles.secondaryLabel} fontFamily="IBM Plex Mono, monospace" fontSize="10"
        fill="#5eead4" textAnchor="middle" style={{ pointerEvents: 'none' }}>
        ARTIX-7
      </text>
      <text x="310" y="132" className={styles.secondaryLabel} fontFamily="IBM Plex Mono, monospace" fontSize="8.5"
        fill="#6fa9aa" textAnchor="middle" style={{ pointerEvents: 'none' }}>
        XC7A35T-1CPG236C
      </text>

      {/* === 7-Segment Display === */}
      <rect x="396" y="72" width="144" height="118" rx="6" ry="6"
        fill="rgba(0,0,0,0.55)" stroke="rgba(255,200,0,0.25)" strokeWidth="1" />
      <text x="468" y="86" className={styles.secondaryLabel} fontFamily="IBM Plex Mono, monospace" fontSize="9.5"
        fill="#f9cf74" textAnchor="middle" style={{ pointerEvents: 'none' }}>
        7-SEG
      </text>

      {SSD_DIGITS.map(({ cx, cy, an }) => (
        <g key={an}>
          {/* Digit background */}
          <rect x={cx - 16} y={cy - 23} width={32} height={42} rx={3}
            fill="rgba(0,0,0,0.5)" stroke="rgba(255,200,0,0.1)" strokeWidth="0.5" />

          {/* Segments — all digits share the same segment signals (CA-CG) */}
          {SEG_DEFS.map((seg) => (
            <rect
              key={`${an}-${seg.alias}`}
              data-testid={`ide-hw-map-seg-${seg.alias.toLowerCase()}-${an.toLowerCase()}`}
              data-resource-state={resourceVisualState(seg.alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
              x={cx + seg.dx}
              y={cy + seg.dy}
              width={seg.w}
              height={seg.h}
              rx={seg.rx}
              fill={regionFill(seg.alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
              stroke={regionStroke(seg.alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
              strokeWidth={regionStrokeWidth(seg.alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, true, conflictAliases)}
              style={boardCursor(seg.alias, allowedAliases)}
              className={resourceClassName(resourceVisualState(seg.alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases))}
              onClick={() => selectAllowed(seg.alias, allowedAliases, onSelectAlias)}
            />
          ))}

          {/* Decimal point */}
          <circle
            data-testid={`ide-hw-map-dp-${an.toLowerCase()}`}
            data-resource-state={resourceVisualState('DP', mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
            cx={cx + 14}
            cy={cy + 15}
            r={3}
            fill={regionFill('DP', mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
            stroke={regionStroke('DP', mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
            strokeWidth={regionStrokeWidth('DP', mappedAliases, highlightedAlias, allowedAliases, assignmentMode, true, conflictAliases)}
            style={boardCursor('DP', allowedAliases)}
            className={resourceClassName(resourceVisualState('DP', mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases))}
            onClick={() => selectAllowed('DP', allowedAliases, onSelectAlias)}
          />

          {/* Digit-enable (AN) region */}
          <rect
            data-testid={`ide-hw-map-${an.toLowerCase()}`}
            data-resource-state={resourceVisualState(an, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
            x={cx - 14}
            y={cy + 22}
            width={28}
            height={13}
            rx={3}
            fill={regionFill(an, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
            stroke={regionStroke(an, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
            strokeWidth={regionStrokeWidth(an, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, true, conflictAliases)}
            style={boardCursor(an, allowedAliases)}
            className={resourceClassName(resourceVisualState(an, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases))}
            onClick={() => selectAllowed(an, allowedAliases, onSelectAlias)}
          />
          <text
            x={cx}
            y={cy + 32}
            data-board-alias={an}
            data-board-alias-kind="display-enable"
            className={styles.aliasLabel}
            fontFamily="IBM Plex Mono, monospace"
            fontSize="9.5"
            fill={labelFill(an, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
            textAnchor="middle"
            style={{ pointerEvents: 'none' }}
          >
            {an}
          </text>
        </g>
      ))}

      {/* === LEDs === */}
      {Array.from({ length: 16 }, (_, i) => {
        const idx = 15 - i;
        const alias = `LD${idx}`;
        const cx = 10 + 20 + i * 36 + 18;
        const cy = 40;
        const state = resourceVisualState(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases);
        return (
          <g key={alias} onClick={() => selectAllowed(alias, allowedAliases, onSelectAlias)} style={boardCursor(alias, allowedAliases)}>
            <circle
              data-testid={`ide-hw-map-ld-${idx}`}
              data-resource-state={state}
              cx={cx} cy={cy} r={7}
              fill={regionFill(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
              stroke={regionStroke(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
              strokeWidth={regionStrokeWidth(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, false, conflictAliases)}
              className={resourceClassName(state)}
            />
            {/* expanded hitbox */}
            <circle
              data-testid={`ide-hw-map-ld-${idx}-hit`}
              cx={cx}
              cy={cy}
              r={16}
              fill="transparent"
            />
            <text data-testid={`ide-hw-map-ld-${idx}-alias`} data-board-alias={alias} data-board-alias-kind="led"
              x={cx} y={65} fontSize={12} className={styles.aliasLabel} fontFamily="IBM Plex Mono, monospace"
              fill={labelFill(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
              textAnchor="middle" style={{ pointerEvents: 'none' }}>
              {alias}
            </text>
          </g>
        );
      })}

      {/* === Buttons === */}
      {BTN_DEFS.map(({ cx, cy, alias, label, labelX, labelY }) => {
        const state = resourceVisualState(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases);
        return (
          <g key={alias} onClick={() => selectAllowed(alias, allowedAliases, onSelectAlias)} style={boardCursor(alias, allowedAliases)}>
            <circle
              data-testid={`ide-hw-map-btn-${label.toLowerCase()}`}
              data-resource-state={state}
              cx={cx} cy={cy} r={9}
              fill={regionFill(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
              stroke={regionStroke(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
              strokeWidth={regionStrokeWidth(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, false, conflictAliases)}
              className={resourceClassName(state)}
            />
            {/* expanded hitbox */}
            <circle
              data-testid={`ide-hw-map-btn-${label.toLowerCase()}-hit`}
              cx={cx}
              cy={cy}
              r={18}
              fill="transparent"
            />
            <text data-testid={`ide-hw-map-btn-${label.toLowerCase()}-alias`} data-board-alias={alias} data-board-alias-kind="button"
              x={labelX} y={labelY} fontSize={11} className={styles.aliasLabel} fontFamily="IBM Plex Mono, monospace"
              fill={labelFill(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
              textAnchor="middle" style={{ pointerEvents: 'none' }}>
              {alias}
            </text>
          </g>
        );
      })}

      {/* === Switches === */}
      {Array.from({ length: 16 }, (_, i) => {
        const idx = 15 - i;
        const alias = `SW${idx}`;
        const centerX = 10 + 20 + i * 36 + 18;
        const trackX = centerX - 7;
        const trackY = 188;
        const trackW = 14;
        const trackH = 22;
        const state = resourceVisualState(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases);
        return (
          <g key={alias} onClick={() => selectAllowed(alias, allowedAliases, onSelectAlias)} style={boardCursor(alias, allowedAliases)}>
            <rect
              data-testid={`ide-hw-map-sw-${idx}`}
              data-resource-state={state}
              x={trackX} y={trackY} width={trackW} height={trackH} rx={4}
              fill={regionFill(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
              stroke={regionStroke(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
              strokeWidth={regionStrokeWidth(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, false, conflictAliases)}
              className={resourceClassName(state)}
            />
            {/* expanded hitbox */}
            <rect data-testid={`ide-hw-map-sw-${idx}-hit`}
              x={trackX - 11} y={trackY - 8} width={trackW + 22} height={trackH + 16}
              rx={6} fill="transparent" />
            <text data-testid={`ide-hw-map-sw-${idx}-alias`} data-board-alias={alias} data-board-alias-kind="switch"
              x={centerX} y={230} fontSize={12} className={styles.aliasLabel} fontFamily="IBM Plex Mono, monospace"
              textAnchor="middle"
              fill={labelFill(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode, conflictAliases)}
              style={{ pointerEvents: 'none' }}>
              {alias}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
