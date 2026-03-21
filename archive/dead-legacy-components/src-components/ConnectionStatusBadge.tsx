// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { HardwareConnectionState } from '../stores/hardwareStore';

interface ConnectionStatusBadgeProps {
  state: HardwareConnectionState;
  className?: string;
  showLabel?: boolean;
}

const stateConfig: Record<HardwareConnectionState, {
  color: string;
  bgColor: string;
  label: string;
  pulse?: boolean;
}> = {
  disconnected: {
    color: 'text-gray-400',
    bgColor: 'bg-gray-600',
    label: 'Disconnected',
  },
  discovering: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500',
    label: 'Discovering...',
    pulse: true,
  },
  connecting: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500',
    label: 'Connecting...',
    pulse: true,
  },
  ready: {
    color: 'text-green-400',
    bgColor: 'bg-green-500',
    label: 'Ready',
  },
  error: {
    color: 'text-red-400',
    bgColor: 'bg-red-500',
    label: 'Error',
  },
};

export const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({
  state,
  className = '',
  showLabel = true,
}) => {
  const config = stateConfig[state];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Status dot */}
      <span
        className={`
          inline-block w-2.5 h-2.5 rounded-full
          ${config.bgColor}
          ${config.pulse ? 'animate-pulse' : ''}
        `}
        aria-hidden="true"
      />
      {/* Label */}
      {showLabel && (
        <span className={`text-xs font-medium ${config.color}`}>
          {config.label}
        </span>
      )}
    </div>
  );
};

export default ConnectionStatusBadge;
