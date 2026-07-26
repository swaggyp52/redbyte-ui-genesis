import React from 'react';
import styles from './Basys3BoardView.module.css';

export interface Basys3BoardViewProps {
  mappedAliases: Set<string>;
  highlightedAlias?: string | null;
  allowedAliases?: Set<string>;
  assignmentMode?: boolean;
  onSelectAlias: (alias: string) => void;
}

const BTN_DEFS = [
  { cx: 155, cy: 135, alias: 'BTNC', label: 'C' },
  { cx: 155, cy: 108, alias: 'BTNU', label: 'U' },
  { cx: 155, cy: 162, alias: 'BTND', label: 'D' },
  { cx: 128, cy: 135, alias: 'BTNL', label: 'L' },
  { cx: 182, cy: 135, alias: 'BTNR', label: 'R' },
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

function regionFill(
  alias: string,
  mappedAliases: Set<string>,
  highlightedAlias?: string | null,
  allowedAliases?: Set<string>,
  assignmentMode = false
): string {
  if (!isAllowed(alias, allowedAliases)) return 'rgba(255,255,255,0.05)';
  if (alias === highlightedAlias) return 'rgba(56,189,248,0.85)';
  if (mappedAliases.has(alias))   return 'rgba(61,186,110,0.8)';
  if (assignmentMode) return 'rgba(56,189,248,0.22)';
  return 'rgba(255,255,255,0.12)';
}

function regionStroke(
  alias: string,
  mappedAliases: Set<string>,
  highlightedAlias?: string | null,
  allowedAliases?: Set<string>,
  assignmentMode = false
): string {
  if (!isAllowed(alias, allowedAliases)) return 'rgba(255,255,255,0.08)';
  if (alias === highlightedAlias) return '#38bdf8';
  if (mappedAliases.has(alias))   return 'rgba(61,186,110,0.9)';
  if (assignmentMode) return 'rgba(56,189,248,0.58)';
  return 'rgba(255,255,255,0.2)';
}

function labelFill(
  alias: string,
  mappedAliases: Set<string>,
  highlightedAlias?: string | null,
  allowedAliases?: Set<string>,
  assignmentMode = false
): string {
  if (!isAllowed(alias, allowedAliases)) return 'rgba(255,255,255,0.1)';
  if (alias === highlightedAlias || mappedAliases.has(alias)) return 'rgba(180,230,220,0.7)';
  if (assignmentMode) return 'rgba(186,235,255,0.64)';
  return 'rgba(255,255,255,0.2)';
}

function boardCursor(alias: string, allowedAliases?: Set<string>): React.CSSProperties {
  return { cursor: isAllowed(alias, allowedAliases) ? 'pointer' : 'not-allowed' };
}

function selectAllowed(alias: string, allowedAliases: Set<string> | undefined, onSelectAlias: (alias: string) => void): void {
  if (!isAllowed(alias, allowedAliases)) return;
  onSelectAlias(alias);
}

export const Basys3BoardView: React.FC<Basys3BoardViewProps> = ({
  mappedAliases,
  highlightedAlias,
  allowedAliases,
  assignmentMode = false,
  onSelectAlias,
}) => {
  return (
    <svg
      data-testid="ide-hw-board-map"
      className={styles.board}
      viewBox="0 0 620 260"
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
          .map-hl { animation: mapHlPulse 900ms ease-in-out infinite; }
        `}</style>
      </defs>

      {/* Board body */}
      <rect x="10" y="10" width="600" height="240" rx="8" ry="8" fill="#0b1b3a" />
      <rect x="10" y="10" width="600" height="240" rx="8" ry="8" fill="url(#mapPcbGrid)" opacity="0.9" />
      <rect x="10" y="10" width="600" height="240" rx="8" ry="8"
        fill="none" stroke="rgba(0,160,80,0.14)" strokeWidth="1.5" />

      {/* Section dividers */}
      <line x1="18" y1="55" x2="602" y2="55" stroke="rgba(0,200,100,0.07)" strokeWidth="1" />
      <line x1="18" y1="175" x2="602" y2="175" stroke="rgba(0,200,100,0.07)" strokeWidth="1" />

      {/* Silkscreen labels */}
      <text x="18" y="14" fontFamily="IBM Plex Mono, monospace" fontSize="7"
        fill="rgba(210,220,240,0.18)" letterSpacing="1" style={{ pointerEvents: 'none' }}>
        {'LD15                                                    LD0'}
      </text>
      <text x="18" y="192" fontFamily="IBM Plex Mono, monospace" fontSize="7"
        fill="rgba(210,220,240,0.18)" letterSpacing="1" style={{ pointerEvents: 'none' }}>
        {'SW15                                                    SW0'}
      </text>
      <text x="18" y="118" fontFamily="IBM Plex Mono, monospace" fontSize="7"
        fill="rgba(210,220,240,0.18)" style={{ pointerEvents: 'none' }}>BTN</text>

      {/* === 100 MHz oscillator / system clock === */}
      <g
        onClick={() => selectAllowed('CLK100MHZ', allowedAliases, onSelectAlias)}
        style={boardCursor('CLK100MHZ', allowedAliases)}
      >
        <rect
          data-testid="ide-hw-map-clock"
          x="248"
          y="24"
          width="124"
          height="30"
          rx="6"
          fill={regionFill('CLK100MHZ', mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
          stroke={regionStroke('CLK100MHZ', mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
          strokeWidth={'CLK100MHZ' === highlightedAlias ? '2.4' : assignmentMode && isAllowed('CLK100MHZ', allowedAliases) ? '1.6' : '1'}
          className={'CLK100MHZ' === highlightedAlias ? 'map-hl' : undefined}
        />
        <rect
          data-testid="ide-hw-map-clock-hit"
          x="240"
          y="18"
          width="140"
          height="42"
          rx="8"
          fill="transparent"
        />
        <text x="310" y="36" fontFamily="IBM Plex Mono, monospace" fontSize="8"
          fill={labelFill('CLK100MHZ', mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
          textAnchor="middle" style={{ pointerEvents: 'none' }}>
          CLK100MHZ
        </text>
        <text x="310" y="47" fontFamily="IBM Plex Mono, monospace" fontSize="6.5"
          fill={labelFill('CLK100MHZ', mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
          textAnchor="middle" style={{ pointerEvents: 'none' }}>
          W5 100MHz
        </text>
      </g>

      {/* FPGA chip */}
      <rect x="238" y="78" width="144" height="104" rx="6" ry="6"
        fill="url(#mapChipGrad)" stroke="rgba(0,180,150,0.22)" strokeWidth="1.5" />
      <rect x="242" y="82" width="136" height="96" rx="4" ry="4"
        fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <text x="310" y="117" fontFamily="IBM Plex Mono, monospace" fontSize="8"
        fill="rgba(0,180,150,0.35)" textAnchor="middle" style={{ pointerEvents: 'none' }}>
        ARTIX-7
      </text>
      <text x="310" y="130" fontFamily="IBM Plex Mono, monospace" fontSize="6.5"
        fill="rgba(0,180,150,0.22)" textAnchor="middle" style={{ pointerEvents: 'none' }}>
        XC7A35T-1CPG236C
      </text>

      {/* === 7-Segment Display === */}
      <rect x="396" y="72" width="144" height="118" rx="6" ry="6"
        fill="rgba(0,0,0,0.55)" stroke="rgba(255,200,0,0.25)" strokeWidth="1" />
      <text x="468" y="83" fontFamily="IBM Plex Mono, monospace" fontSize="7"
        fill="rgba(255,200,0,0.55)" textAnchor="middle" style={{ pointerEvents: 'none' }}>
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
              x={cx + seg.dx}
              y={cy + seg.dy}
              width={seg.w}
              height={seg.h}
              rx={seg.rx}
              fill={regionFill(seg.alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
              stroke={regionStroke(seg.alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
              strokeWidth={assignmentMode && isAllowed(seg.alias, allowedAliases) ? '0.9' : '0.5'}
              style={boardCursor(seg.alias, allowedAliases)}
              className={seg.alias === highlightedAlias ? 'map-hl' : undefined}
              onClick={() => selectAllowed(seg.alias, allowedAliases, onSelectAlias)}
            />
          ))}

          {/* Decimal point */}
          <circle
            data-testid={`ide-hw-map-dp-${an.toLowerCase()}`}
            cx={cx + 14}
            cy={cy + 15}
            r={3}
            fill={regionFill('DP', mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
            stroke={regionStroke('DP', mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
            strokeWidth={assignmentMode && isAllowed('DP', allowedAliases) ? '0.9' : '0.5'}
            style={boardCursor('DP', allowedAliases)}
            className={'DP' === highlightedAlias ? 'map-hl' : undefined}
            onClick={() => selectAllowed('DP', allowedAliases, onSelectAlias)}
          />

          {/* Digit-enable (AN) region */}
          <rect
            data-testid={`ide-hw-map-${an.toLowerCase()}`}
            x={cx - 14}
            y={cy + 22}
            width={28}
            height={13}
            rx={3}
            fill={regionFill(an, mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
            stroke={regionStroke(an, mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
            strokeWidth={assignmentMode && isAllowed(an, allowedAliases) ? '1.2' : '0.8'}
            style={boardCursor(an, allowedAliases)}
            className={an === highlightedAlias ? 'map-hl' : undefined}
            onClick={() => selectAllowed(an, allowedAliases, onSelectAlias)}
          />
          <text
            x={cx}
            y={cy + 31}
            fontFamily="IBM Plex Mono, monospace"
            fontSize="6"
            fill={labelFill(an, mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
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
        return (
          <g key={alias} onClick={() => selectAllowed(alias, allowedAliases, onSelectAlias)} style={boardCursor(alias, allowedAliases)}>
            <circle
              data-testid={`ide-hw-map-ld-${idx}`}
              cx={cx} cy={cy} r={7}
              fill={regionFill(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
              stroke={regionStroke(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
              strokeWidth={alias === highlightedAlias ? '2.4' : assignmentMode && isAllowed(alias, allowedAliases) ? '1.6' : '1'}
              className={alias === highlightedAlias ? 'map-hl' : undefined}
            />
            {/* expanded hitbox */}
            <circle
              data-testid={`ide-hw-map-ld-${idx}-hit`}
              cx={cx}
              cy={cy}
              r={16}
              fill="transparent"
            />
            <text x={cx} y={58} fontSize={7} fontFamily="IBM Plex Mono, monospace"
              fill={labelFill(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
              textAnchor="middle" style={{ pointerEvents: 'none' }}>
              {alias}
            </text>
          </g>
        );
      })}

      {/* === Buttons === */}
      {BTN_DEFS.map(({ cx, cy, alias, label }) => (
        <g key={alias} onClick={() => selectAllowed(alias, allowedAliases, onSelectAlias)} style={boardCursor(alias, allowedAliases)}>
          <circle
            data-testid={`ide-hw-map-btn-${label.toLowerCase()}`}
            cx={cx} cy={cy} r={9}
            fill={regionFill(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
            stroke={regionStroke(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
            strokeWidth={alias === highlightedAlias ? '2.4' : assignmentMode && isAllowed(alias, allowedAliases) ? '1.6' : '1'}
            className={alias === highlightedAlias ? 'map-hl' : undefined}
          />
          {/* expanded hitbox */}
          <circle
            data-testid={`ide-hw-map-btn-${label.toLowerCase()}-hit`}
            cx={cx}
            cy={cy}
            r={18}
            fill="transparent"
          />
          <text x={cx} y={cy + 22} fontSize={7} fontFamily="IBM Plex Mono, monospace"
            fill={labelFill(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
            textAnchor="middle" style={{ pointerEvents: 'none' }}>
            {alias}
          </text>
        </g>
      ))}

      {/* === Switches === */}
      {Array.from({ length: 16 }, (_, i) => {
        const idx = 15 - i;
        const alias = `SW${idx}`;
        const centerX = 10 + 20 + i * 36 + 18;
        const trackX = centerX - 7;
        const trackY = 188;
        const trackW = 14;
        const trackH = 22;
        return (
          <g key={alias} onClick={() => selectAllowed(alias, allowedAliases, onSelectAlias)} style={boardCursor(alias, allowedAliases)}>
            <rect
              data-testid={`ide-hw-map-sw-${idx}`}
              x={trackX} y={trackY} width={trackW} height={trackH} rx={4}
              fill={regionFill(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
              stroke={regionStroke(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
              strokeWidth={alias === highlightedAlias ? '2.4' : assignmentMode && isAllowed(alias, allowedAliases) ? '1.6' : '1'}
              className={alias === highlightedAlias ? 'map-hl' : undefined}
            />
            {/* expanded hitbox */}
            <rect data-testid={`ide-hw-map-sw-${idx}-hit`}
              x={trackX - 11} y={trackY - 8} width={trackW + 22} height={trackH + 16}
              rx={6} fill="transparent" />
            <text x={centerX} y={220} fontSize={7} fontFamily="IBM Plex Mono, monospace"
              textAnchor="middle"
              fill={labelFill(alias, mappedAliases, highlightedAlias, allowedAliases, assignmentMode)}
              style={{ pointerEvents: 'none' }}>
              {alias}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
