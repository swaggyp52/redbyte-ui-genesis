// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string }>;
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, error, className, ...props }, ref) => {
    const baseStyles = [
      'w-full',
      'rounded-[var(--rb-radius-md)]',
      'border',
      'bg-[var(--rb-color-neutral-50)]',
      'px-[var(--rb-spacing-3)]',
      'py-[var(--rb-spacing-2)]',
      'text-[var(--rb-font-size-base)]',
      'transition-colors',
      'duration-[var(--rb-duration-fast)]',
      'focus:outline-none',
      'focus:ring-2',
      'focus:ring-[var(--rb-color-accent-500)]',
      'disabled:opacity-50',
      'disabled:cursor-not-allowed',
    ];

    const errorStyles = error
      ? ['border-[var(--rb-color-error-500)]', 'focus:ring-[var(--rb-color-error-500)]']
      : ['border-[var(--rb-color-neutral-300)]'];

    const combinedClassName = [...baseStyles, ...errorStyles, className].join(' ');

    return (
      <select ref={ref} className={combinedClassName} {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
);

Select.displayName = 'Select';
