// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { IntegrityStatus } from '../utils/evidenceManifest';

interface IntegrityBadgeProps {
  status: IntegrityStatus;
  className?: string;
}

const STATUS_CONFIG: Record<IntegrityStatus, { label: string; color: string; bg: string; border: string }> = {
  verified: {
    label: 'Verified',
    color: 'var(--rb-success, #22C55E)',
    bg: 'var(--rb-success-soft, rgba(34, 197, 94, 0.15))',
    border: 'rgba(34, 197, 94, 0.3)',
  },
  modified: {
    label: 'Modified',
    color: 'var(--rb-danger, #EF4444)',
    bg: 'var(--rb-danger-bg, rgba(239, 68, 68, 0.12))',
    border: 'var(--rb-danger-border, rgba(239, 68, 68, 0.3))',
  },
  unknown: {
    label: 'Unknown',
    color: 'var(--rb-text-3, #8B8B93)',
    bg: 'var(--rb-surface-2, #27272A)',
    border: 'var(--rb-border, #27272A)',
  },
};

export const IntegrityBadge: React.FC<IntegrityBadgeProps> = ({ status, className }) => {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${className ?? ''}`}
      style={{
        color: config.color,
        background: config.bg,
        border: `1px solid ${config.border}`,
      }}
      title={`Integrity: ${config.label}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: config.color }}
      />
      {config.label}
    </span>
  );
};
