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
      {/* Board outline */}
      <rect
        x="10"
        y="10"
        width="600"
        height="240"
        rx="6"
        ry="6"
        fill="#0b1a14"
        stroke="#1a3a2a"
        strokeWidth="1.5"
      />

      {/* LEDs row */}
      {Array.from({ length: 16 }, (_, i) => {
        const idx = 15 - i;
        const cx = 10 + 20 + i * 36 + 18;
        const cy = 40;
        const isOn = ld[idx] === 1;
        const isMapped = mappedLd[idx];
        const isActiveLd = activeSignal?.type === 'ld' && activeSignal.index === idx;

        let fill = '#1a2a20';
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

        return (
          <g key={`ld-${idx}`}>
            <circle
              data-testid={`ide-hw-ld-${idx}`}
              data-active={isActiveLd ? 'true' : undefined}
              className={isActiveLd ? `${styles.ledCircle} ${styles.active}` : styles.ledCircle}
              cx={cx}
              cy={cy}
              r={7}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              opacity={opacity}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectSignal?.({ type: 'ld', index: idx })}
            />
            <text
              x={cx}
              y={58}
              fontSize={7}
              fill="#4a5568"
              textAnchor="middle"
            >
              {`LD${idx}`}
            </text>
          </g>
        );
      })}

      {/* FPGA chip */}
      <rect
        x="220"
        y="90"
        width="180"
        height="90"
        rx="4"
        fill="#0f2518"
        stroke="#2a4a32"
        strokeWidth="1"
      />
      <text
        x="310"
        y="138"
        textAnchor="middle"
        fill="#4a7a5a"
        fontSize="11"
        fontFamily="var(--rb-font-mono)"
      >
        ARTIX-7
      </text>
      <text
        x="310"
        y="152"
        textAnchor="middle"
        fill="#2a4a32"
        fontSize="8"
        fontFamily="var(--rb-font-mono)"
      >
        XC7A35T
      </text>

      {/* Push buttons */}
      {BTN_POSITIONS.map(([cx, cy], i) => (
        <g key={`btn-${i}`}>
          <circle
            data-testid={`ide-hw-btn-${i}`}
            className={styles.btnCircle}
            cx={cx}
            cy={cy}
            r={10}
            fill={btn[i] === 1 ? '#e53e3e' : '#1a2a20'}
            stroke="#2a3a2a"
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
            fill="#4a5568"
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

        return (
          <g
            key={`sw-${idx}`}
            data-testid={`ide-hw-sw-${idx}`}
            data-active={isActiveSw ? 'true' : undefined}
            className={isActiveSw ? `${styles.swGroup} ${styles.active}` : styles.swGroup}
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
              fill="#1a2830"
              stroke={isMapped ? '#2ec4b6' : '#2a3a3a'}
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
              fill={isOn ? '#2ec4b6' : '#2a3a4a'}
            />
            {/* SW label */}
            <text
              x={ledX}
              y={220}
              fontSize={7}
              textAnchor="middle"
              fill="#4a5568"
            >
              {`SW${idx}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
