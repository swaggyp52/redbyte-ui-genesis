import React from 'react';
import { TruthTableRow } from './types';

interface SevenSegmentProps {
  seg: TruthTableRow['seg'];
  size?: number;
}

export const SevenSegmentDisplay: React.FC<SevenSegmentProps> = ({ seg, size = 100 }) => {
  const [a, b, c, d, e, f, g] = seg;

  const styles: React.CSSProperties = {
    display: 'inline-block',
    position: 'relative',
    width: size,
    height: size * 1.5,
    backgroundColor: '#1a1a1a',
    padding: size * 0.1,
    borderRadius: 4,
  };

  const segmentStyle = (active: 0 | 1): React.CSSProperties => ({
    position: 'absolute',
    backgroundColor: active === 0 ? '#00ff00' : '#333333',
    transition: 'background-color 0.2s',
  });

  const w = size * 0.8;
  const h = size * 0.4;
  const t = size * 0.1;

  return (
    <div style={styles}>
      {/* Top (a) */}
      <div style={{ ...segmentStyle(a), top: t, left: '10%', width: '80%', height: h / 2 }} />

      {/* Top-left (f) */}
      <div style={{ ...segmentStyle(f), top: t + h / 2, left: t, width: h / 2, height: h }} />

      {/* Top-right (b) */}
      <div style={{ ...segmentStyle(b), top: t + h / 2, right: t, width: h / 2, height: h }} />

      {/* Middle (g) */}
      <div style={{ ...segmentStyle(g), top: t + h, left: '10%', width: '80%', height: h / 2 }} />

      {/* Bottom-left (e) */}
      <div style={{ ...segmentStyle(e), top: t + h + h / 2, left: t, width: h / 2, height: h }} />

      {/* Bottom-right (c) */}
      <div style={{ ...segmentStyle(c), top: t + h + h / 2, right: t, width: h / 2, height: h }} />

      {/* Bottom (d) */}
      <div style={{ ...segmentStyle(d), bottom: t, left: '10%', width: '80%', height: h / 2 }} />
    </div>
  );
};
