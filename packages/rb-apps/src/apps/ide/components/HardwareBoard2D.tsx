import React from 'react';
import type { Bit } from '../ioBus';
import type { BoardSignal } from '../BoardSignalContext';
import styles from './HardwareBoard2D.module.css';

export interface HardwareBoard2DProps {
  sw: Bit[];           // length 16 — switch states
  ld: Bit[];           // length 16 — LED states
  btn: Bit[];          // length 5 — button states
  mappedSw: boolean[]; // length 16 — whether each SW has a nodeId mapping
  mappedLd: boolean[]; // length 16 — whether each LD has a nodeId mapping
  onToggleSwitch(i: number): void;
  onPressButton(i: number, down: boolean): void;
  activeSignal?: BoardSignal | null;
  onSelectSignal?: (sig: BoardSignal) => void;
}

const BTN_POSITIONS: [number, number][] = [
  [155, 135], // BTNC (index 0)
  [155, 108], // BTNU (index 1)
  [155, 162], // BTND (index 2)
  [128, 135], // BTNL (index 3)
  [182, 135], // BTNR (index 4)
];
const BTN_LABELS = ['C', 'U', 'D', 'L', 'R'];

export const HardwareBoard2D: React.FC<HardwareBoard2DProps> = ({
  sw,
  ld,
  btn,
  mappedSw,
  mappedLd,
  onToggleSwitch,
  onPressButton,
  activeSignal,
  onSelectSignal,
}) => {
  return (
    <svg
      data-testid="ide-hardware-board-2d"
      className={styles.board}
      viewBox="0 0 620 260"
      preserveAspectRatio="xMidYMid meet"
      width="100%"
    >
      <defs>
        <linearGradient id="pcbGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a3d6e" />
          <stop offset="100%" stopColor="#0f2a52" />
        </linearGradient>
        <filter id="ledGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Board outline */}
      <rect
        x="10"
        y="10"
        width="600"
        height="240"
        rx="6"
        ry="6"
        fill="url(#pcbGrad)"
        stroke="#1a3a6a"
        strokeWidth="1.5"
      />

      {/* PCB inner border — silkscreen style */}
      <rect x="4" y="4" width="612" height="252" rx="8" ry="8"
        fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

      {/* Section dividers */}
      <line x1="18" y1="55" x2="602" y2="55" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <line x1="18" y1="175" x2="602" y2="175" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

      {/* Silkscreen labels */}
      <text x="18" y="14" fontFamily="monospace" fontSize="7" fill="rgba(255,255,255,0.45)" letterSpacing="1">LD15                                                                    LD0</text>
      <text x="18" y="192" fontFamily="monospace" fontSize="7" fill="rgba(255,255,255,0.45)" letterSpacing="1">SW15                                                                    SW0</text>
      <text x="18" y="118" fontFamily="monospace" fontSize="7" fill="rgba(255,255,255,0.45)">BTN</text>

      {/* LEDs row */}
      {Array.from({ length: 16 }, (_, i) => {
        const idx = 15 - i;
        const cx = 10 + 20 + i * 36 + 18;
        const cy = 40;
        const isOn = ld[idx] === 1;
        const isMapped = mappedLd[idx];
        const isActiveLd = activeSignal?.type === 'ld' && activeSignal.index === idx;

        let fill = '#1a2a40';
        if (isOn) fill = 'var(--rb-signal)';

        let stroke: string | undefined;
        let strokeWidth: string | undefined;
        let opacity: number = 1;

        if (!isMapped) {
          opacity = 0.3;
        } else if (isMapped && isOn) {
          stroke = 'var(--rb-signal)';
          strokeWidth = '2';
        } else if (isMapped && !isOn) {
          stroke = '#2ec4b6';
          strokeWidth = '1';
          opacity = 0.6;
        }

        const ledClassName = [
          styles.ledCircle,
          isActiveLd ? styles.active : '',
          isOn ? styles.ledOn : '',
        ].filter(Boolean).join(' ');

        return (
          <g key={`ld-${idx}`}>
            <circle
              data-testid={`ide-hw-ld-${idx}`}
              data-active={isActiveLd ? 'true' : undefined}
              className={ledClassName}
              cx={cx}
              cy={cy}
              r={7}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              opacity={opacity}
              filter={isOn ? 'url(#ledGlow)' : undefined}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectSignal?.({ type: 'ld', index: idx })}
            />
            <text
              x={cx}
              y={58}
              fontSize={7}
              fill="rgba(255,255,255,0.3)"
              textAnchor="middle"
            >
              {`LD${idx}`}
            </text>
          </g>
        );
      })}

      {/* FPGA chip */}
      <rect x="240" y="80" width="140" height="100" rx="3" ry="3"
        fill="#0a1a30" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <text x="310" y="126" fontFamily="monospace" fontSize="9" fill="rgba(255,255,255,0.3)"
        textAnchor="middle" letterSpacing="0.5">ARTIX-7</text>
      <text x="310" y="138" fontFamily="monospace" fontSize="7" fill="rgba(255,255,255,0.2)"
        textAnchor="middle">XC7A35T</text>

      {/* Push buttons */}
      {BTN_POSITIONS.map(([cx, cy], i) => (
        <g key={`btn-${i}`}>
          <circle
            data-testid={`ide-hw-btn-${i}`}
            className={styles.btnCircle}
            cx={cx}
            cy={cy}
            r={10}
            fill={btn[i] === 1 ? '#e53e3e' : '#1a2a40'}
            stroke="#2a3a5a"
            strokeWidth="1"
            cursor="pointer"
            onMouseDown={() => onPressButton(i, true)}
            onMouseUp={() => onPressButton(i, false)}
            onMouseLeave={() => onPressButton(i, false)}
          />
          <text
            x={cx}
            y={cy + 20}
            fontSize={7}
            fill="rgba(255,255,255,0.3)"
            textAnchor="middle"
          >
            {BTN_LABELS[i]}
          </text>
        </g>
      ))}

      {/* SW slider switches row */}
      {Array.from({ length: 16 }, (_, i) => {
        const idx = 15 - i;
        const ledX = 10 + 20 + i * 36 + 18;
        const bodyX = ledX - 6;
        const bodyY = 190;
        const isOn = sw[idx] === 1;
        const isMapped = mappedSw[idx];
        const handleY = isOn ? 191 : 201;
        const isActiveSw = activeSignal?.type === 'sw' && activeSignal.index === idx;

        const swGroupClassName = [
          styles.swGroup,
          isActiveSw ? styles.active : '',
          isOn ? styles.swOn : '',
        ].filter(Boolean).join(' ');

        return (
          <g
            key={`sw-${idx}`}
            data-testid={`ide-hw-sw-${idx}`}
            data-active={isActiveSw ? 'true' : undefined}
            className={swGroupClassName}
            cursor="pointer"
            onClick={() => onToggleSwitch(idx)}
          >
            {/* Switch body */}
            <rect
              x={bodyX}
              y={bodyY}
              width="12"
              height="20"
              rx="2"
              fill="#0f2040"
              stroke={isMapped ? '#2ec4b6' : '#1a2a5a'}
              strokeWidth={isMapped ? '1.5' : '1'}
              opacity={isMapped ? 1 : 0.4}
            />
            {/* Switch handle */}
            <rect
              className={styles.swHandle}
              x={bodyX + 1}
              y={handleY}
              width="10"
              height="8"
              rx="1"
              fill={isOn ? '#2ec4b6' : '#1a2840'}
            />
            {/* SW label */}
            <text
              x={ledX}
              y={220}
              fontSize={7}
              textAnchor="middle"
              fill="rgba(255,255,255,0.3)"
            >
              {`SW${idx}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
