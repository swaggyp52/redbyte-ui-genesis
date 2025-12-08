// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export interface ToggleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Toggle = React.forwardRef<HTMLInputElement, ToggleProps>(
  ({ label, className, ...props }, ref) => {
    return (
      <label className="inline-flex items-center gap-[var(--rb-spacing-2)] cursor-pointer">
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            className="sr-only peer"
            {...props}
          />
          <div className="w-11 h-6 bg-[var(--rb-color-neutral-300)] rounded-[var(--rb-radius-full)] peer peer-checked:bg-[var(--rb-color-accent-500)] transition-colors duration-[var(--rb-duration-fast)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--rb-color-accent-500)]"></div>
          <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-[var(--rb-radius-full)] transition-transform duration-[var(--rb-duration-fast)] peer-checked:translate-x-5"></div>
        </div>
        {label && <span className="text-[var(--rb-font-size-base)]">{label}</span>}
      </label>
    );
  }
);

Toggle.displayName = 'Toggle';
