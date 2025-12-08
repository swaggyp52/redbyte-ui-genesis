// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md' | 'lg';
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ size = 'md', error, className, ...props }, ref) => {
    const baseStyles = [
      'w-full',
      'rounded-[var(--rb-radius-md)]',
      'border',
      'bg-[var(--rb-color-neutral-50)]',
      'transition-colors',
      'duration-[var(--rb-duration-fast)]',
      'focus:outline-none',
      'focus:ring-2',
      'focus:ring-[var(--rb-color-accent-500)]',
      'disabled:opacity-50',
      'disabled:cursor-not-allowed',
    ];

    const sizeStyles = {
      sm: ['text-[var(--rb-font-size-sm)]', 'px-[var(--rb-spacing-2)]', 'py-[var(--rb-spacing-1)]'],
      md: ['text-[var(--rb-font-size-base)]', 'px-[var(--rb-spacing-3)]', 'py-[var(--rb-spacing-2)]'],
      lg: ['text-[var(--rb-font-size-lg)]', 'px-[var(--rb-spacing-4)]', 'py-[var(--rb-spacing-3)]'],
    };

    const errorStyles = error
      ? ['border-[var(--rb-color-error-500)]', 'focus:ring-[var(--rb-color-error-500)]']
      : ['border-[var(--rb-color-neutral-300)]'];

    const combinedClassName = [...baseStyles, ...sizeStyles[size], ...errorStyles, className].join(' ');

    return <input ref={ref} className={combinedClassName} {...props} />;
  }
);

Input.displayName = 'Input';
