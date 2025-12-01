import React from 'react';

interface BadgeProps {
  label: string;
}

export default function Badge({ label }: BadgeProps) {
  return (
    <span className="rb-badge">
      <span className="rb-badge-dot" />
      {label}
    </span>
  );
}

