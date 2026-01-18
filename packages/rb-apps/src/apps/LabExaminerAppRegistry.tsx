// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { RedByteApp } from '../types';
import LabExaminerApp from './LabExaminerApp';

interface LabExaminerAppWrapperProps {
  onClose?: () => void;
}

const LabExaminerAppWrapper: React.FC<LabExaminerAppWrapperProps> = ({ onClose }) => {
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <LabExaminerApp />
    </div>
  );
};

export const LabExaminerAppRegistry: RedByteApp = {
  manifest: {
    id: 'lab-examiner',
    name: 'Lab Examiner',
    iconId: 'microscope',
    singleton: false,
    category: 'tools',
    defaultSize: { width: 1200, height: 700 },
    minSize: { width: 800, height: 500 },
  },
  component: LabExaminerAppWrapper,
};

export default LabExaminerAppRegistry;
