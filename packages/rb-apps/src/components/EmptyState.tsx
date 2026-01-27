// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { Icon, type IconName } from '@redbyte/rb-icons';

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className }) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center gap-3 px-6 py-8 ${className ?? ''}`}
      style={{ color: 'var(--rb-muted)' }}
    >
      <div
        className="h-12 w-12 rounded-2xl border flex items-center justify-center"
        style={{
          background: 'var(--rb-surface-2)',
          borderColor: 'var(--rb-border)',
          color: 'var(--rb-text)',
          boxShadow: 'var(--rb-shadow-1)',
        }}
      >
        <Icon name={icon} size={24} />
      </div>
      <div className="text-sm font-semibold" style={{ color: 'var(--rb-text)' }}>{title}</div>
      {description && (
        <div className="text-xs max-w-sm" style={{ color: 'var(--rb-faint)' }}>
          {description}
        </div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};
