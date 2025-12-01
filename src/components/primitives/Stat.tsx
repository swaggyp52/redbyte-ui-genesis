import React from 'react';

interface StatProps {
  label: string;
  value: string;
  meta?: string;
}

export default function Stat({ label, value, meta }: StatProps) {
  return (
    <div className="rb-stat">
      <div className="rb-stat-label">{label}</div>
      <div className="rb-stat-value">{value}</div>
      {meta && <div className="rb-stat-meta">{meta}</div>}
    </div>
  );
}
