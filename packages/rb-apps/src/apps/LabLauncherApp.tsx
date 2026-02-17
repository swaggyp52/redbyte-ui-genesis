import React from 'react';
import { LabLauncher } from '../components/LabLauncher';
import type { RedByteApp } from '../types';

// labId to status mapping — update each week as labs progress.
// 'completed' = done, 'active' = current lab, 'upcoming' = not yet.
const CURRENT_LAB_STATUSES: Record<string, 'completed' | 'active' | 'upcoming'> = {
  'lab-1': 'completed',
  'lab-2': 'completed',
  'lab-3': 'completed',
  'lab-4': 'active',
  'lab-5': 'upcoming',
  'lab-6': 'upcoming',
  'lab-7': 'upcoming',
  'lab-8': 'upcoming',
};

interface LabLauncherComponentProps {
  windowId: string;
  onOpenApp?: (appId: string, props?: Record<string, unknown>) => void;
}

const LabLauncherComponent: React.FC<LabLauncherComponentProps> = ({ onOpenApp }) => {
  const handleOpenLab = (labId: string) => {
    onOpenApp?.('lab-workspace', { labId });
  };

  return (
    <LabLauncher
      labStatuses={CURRENT_LAB_STATUSES}
      onOpenLab={handleOpenLab}
    />
  );
};

export const LabLauncherApp: RedByteApp = {
  manifest: {
    id: 'lab-launcher',
    name: 'Labs',
    iconId: 'grid',
    category: 'system',
    singleton: true,
    defaultSize: { width: 1200, height: 800 },
    hidden: true,
  },
  component: LabLauncherComponent,
};
