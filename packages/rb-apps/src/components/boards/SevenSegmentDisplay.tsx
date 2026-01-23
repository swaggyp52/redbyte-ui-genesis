// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * SevenSegmentDisplay - Realistic LED 7-segment display
 *
 * Renders authentic-looking 7-segment digits with proper segment
 * lighting, glow effects, and common-anode control.
 */

import React from 'react';

interface SevenSegmentDisplayProps {
  /** Segment pattern (bits: DP-G-F-E-D-C-B-A, active low for common anode) */
  segments: number;
  /** Anode enable (active low, one bit per digit) */
  anodes: number;
  /** Number of digits */
  digits?: number;
  /** Color theme */
  color?: 'red' | 'green' | 'amber' | 'cyan';
  /** Size multiplier */
  size?: 'sm' | 'md' | 'lg';
}

// Segment layout:
//    AAA
//   F   B
//   F   B
//    GGG
//   E   C
//   E   C
//    DDD  .DP

const Segment: React.FC<{
  on: boolean;
  type: 'h' | 'v'; // horizontal or vertical
  color: string;
  glowColor: string;
  style?: React.CSSProperties;
}> = ({ on, type, color, glowColor, style }) => {
  const baseColor = '#1a1210';

  if (type === 'h') {
    // Horizontal segment (A, G, D)
    return (
      <div
        className="absolute transition-all duration-50"
        style={{
          width: 16,
          height: 3,
          clipPath: 'polygon(2px 0, calc(100% - 2px) 0, 100% 50%, calc(100% - 2px) 100%, 2px 100%, 0 50%)',
          background: on ? color : baseColor,
          boxShadow: on ? `0 0 6px 2px ${glowColor}` : 'none',
          ...style,
        }}
      />
    );
  }

  // Vertical segment (B, C, E, F)
  return (
    <div
      className="absolute transition-all duration-50"
      style={{
        width: 3,
        height: 10,
        clipPath: 'polygon(0 2px, 50% 0, 100% 2px, 100% calc(100% - 2px), 50% 100%, 0 calc(100% - 2px))',
        background: on ? color : baseColor,
        boxShadow: on ? `0 0 6px 2px ${glowColor}` : 'none',
        ...style,
      }}
    />
  );
};

const Digit: React.FC<{
  segments: number;
  enabled: boolean;
  color: string;
  glowColor: string;
}> = ({ segments, enabled, color, glowColor }) => {
  // Parse segments (active low for common anode displays)
  // Bit order: DP-G-F-E-D-C-B-A (MSB to LSB)
  const segA = enabled && !(segments & 0x01);
  const segB = enabled && !(segments & 0x02);
  const segC = enabled && !(segments & 0x04);
  const segD = enabled && !(segments & 0x08);
  const segE = enabled && !(segments & 0x10);
  const segF = enabled && !(segments & 0x20);
  const segG = enabled && !(segments & 0x40);
  const segDP = enabled && !(segments & 0x80);

  return (
    <div
      className="relative"
      style={{ width: 24, height: 36 }}
    >
      {/* Background plate */}
      <div
        className="absolute inset-0 rounded-sm"
        style={{
          background: 'linear-gradient(135deg, #0a0806 0%, #151210 100%)',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)',
        }}
      />

      {/* Segments */}
      <Segment on={segA} type="h" color={color} glowColor={glowColor} style={{ top: 2, left: 4 }} />
      <Segment on={segB} type="v" color={color} glowColor={glowColor} style={{ top: 4, left: 18 }} />
      <Segment on={segC} type="v" color={color} glowColor={glowColor} style={{ top: 16, left: 18 }} />
      <Segment on={segD} type="h" color={color} glowColor={glowColor} style={{ top: 28, left: 4 }} />
      <Segment on={segE} type="v" color={color} glowColor={glowColor} style={{ top: 16, left: 2 }} />
      <Segment on={segF} type="v" color={color} glowColor={glowColor} style={{ top: 4, left: 2 }} />
      <Segment on={segG} type="h" color={color} glowColor={glowColor} style={{ top: 15, left: 4 }} />

      {/* Decimal point */}
      <div
        className="absolute rounded-full transition-all duration-50"
        style={{
          width: 3,
          height: 3,
          bottom: 3,
          right: 1,
          background: segDP ? color : '#1a1210',
          boxShadow: segDP ? `0 0 4px 2px ${glowColor}` : 'none',
        }}
      />
    </div>
  );
};

export const SevenSegmentDisplay: React.FC<SevenSegmentDisplayProps> = ({
  segments,
  anodes,
  digits = 4,
  color = 'red',
  size = 'md',
}) => {
  const colors = {
    red: { lit: '#ff2020', glow: 'rgba(255, 32, 32, 0.6)' },
    green: { lit: '#20ff40', glow: 'rgba(32, 255, 64, 0.6)' },
    amber: { lit: '#ffaa00', glow: 'rgba(255, 170, 0, 0.6)' },
    cyan: { lit: '#00ffff', glow: 'rgba(0, 255, 255, 0.6)' },
  };
  const c = colors[color];

  const scale = { sm: 0.7, md: 1, lg: 1.4 }[size];

  return (
    <div
      className="flex gap-1 p-1.5 rounded"
      style={{
        background: 'linear-gradient(180deg, #0a0806 0%, #151210 100%)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.05)',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}
    >
      {Array.from({ length: digits }).map((_, i) => {
        // Each digit is enabled when its anode bit is LOW (active low)
        const enabled = !(anodes & (1 << (digits - 1 - i)));
        return (
          <Digit
            key={i}
            segments={segments}
            enabled={enabled}
            color={c.lit}
            glowColor={c.glow}
          />
        );
      })}
    </div>
  );
};

export default SevenSegmentDisplay;
