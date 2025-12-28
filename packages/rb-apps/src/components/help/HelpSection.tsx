// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { type ReactNode } from 'react';

export type SectionKind = 'concept' | 'build' | 'simulate' | 'explain' | 'reflect';

export interface HelpSectionProps {
  kind: SectionKind;
  children: ReactNode;
  className?: string;
}

const sectionTitles: Record<SectionKind, string> = {
  concept: 'Concept',
  build: 'Build',
  simulate: 'Simulate',
  explain: 'Explain',
  reflect: 'Reflect',
};

/**
 * HelpSection - Standardized section for Concept/Build/Simulate/Explain/Reflect
 * Provides consistent heading style and spacing
 */
export const HelpSection: React.FC<HelpSectionProps> = ({ kind, children, className = '' }) => {
  return (
    <div className={`mt-6 first:mt-0 ${className}`}>
      <h3 className="text-cyan-400 mb-2">{sectionTitles[kind]}</h3>
      <div className="text-gray-200">{children}</div>
    </div>
  );
};
