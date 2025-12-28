// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { type ReactNode } from 'react';

export type CalloutVariant = 'default' | 'info' | 'success' | 'reflect';

export interface CalloutProps {
  variant?: CalloutVariant;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<CalloutVariant, string> = {
  default: 'bg-slate-800 border-slate-700',
  info: 'bg-slate-800 border-slate-700',
  success: 'bg-blue-950 border-blue-800',
  reflect: 'bg-slate-800 border-slate-700',
};

/**
 * Callout - Highlighted content box
 * Used for key explanations, tips, and reflections
 */
export const Callout: React.FC<CalloutProps> = ({ variant = 'default', children, className = '' }) => {
  const isReflect = variant === 'reflect';

  return (
    <div className={`p-4 rounded border ${variantStyles[variant]} ${className}`}>
      {isReflect ? (
        <div className="italic text-gray-400">{children}</div>
      ) : (
        <div className="text-gray-200">{children}</div>
      )}
    </div>
  );
};
