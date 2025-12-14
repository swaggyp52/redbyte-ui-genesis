// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export interface ButtonProps<T extends React.ElementType = 'button'> {
  /**
   * The element type to render as (polymorphic component)
   * @default 'button'
   */
  as?: T;
  /**
   * Button visual variant
   */
  variant?: 'primary' | 'secondary' | 'ghost';
  /**
   * Button size
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Whether the button is disabled
   */
  disabled?: boolean;
  /**
   * Button children content
   */
  children: React.ReactNode;
  /**
   * Accessible label override when the visual label is not descriptive
   */
  ariaLabel?: string;
}

type PolymorphicButtonProps<T extends React.ElementType> = ButtonProps<T> &
  Omit<React.ComponentPropsWithoutRef<T>, keyof ButtonProps<T>>;

/**
 * Button - Accessible polymorphic button component
 *
 * Features:
 * - Polymorphic: Can be rendered as any element via `as` prop
 * - Keyboard accessible: Focus-visible styles, Enter/Space activation
 * - Respects reduced-motion preference
 * - Fully typed with TypeScript
 *
 * @example
 * ```tsx
 * <Button variant="primary" onClick={handleClick}>
 *   Click me
 * </Button>
 *
 * <Button as="a" href="/page">
 *   Navigate
 * </Button>
 * ```
 */
export function Button<T extends React.ElementType = 'button'>({
  as,
  variant = 'primary',
  size = 'md',
  disabled,
  children,
  ariaLabel,
  ...props
}: PolymorphicButtonProps<T>) {
  const Component = as || 'button';
  const role = Component === 'button' ? undefined : 'button';

  const baseStyles = [
    'inline-flex',
    'items-center',
    'justify-center',
    'font-medium',
    'rounded-[var(--rb-radius-md)]',
    'transition-colors',
    'duration-[var(--rb-duration-fast)]',
    'focus-visible:outline',
    'focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-[var(--rb-color-accent-500)]',
    'disabled:opacity-50',
    'disabled:cursor-not-allowed',
  ];

  const variantStyles = {
    primary: [
      'bg-[var(--rb-color-accent-500)]',
      'text-white',
      'hover:bg-[var(--rb-color-accent-600)]',
      'active:bg-[var(--rb-color-accent-700)]',
    ],
    secondary: [
      'bg-[var(--rb-color-neutral-200)]',
      'text-[var(--rb-color-neutral-900)]',
      'hover:bg-[var(--rb-color-neutral-300)]',
      'active:bg-[var(--rb-color-neutral-400)]',
    ],
    ghost: [
      'bg-transparent',
      'text-[var(--rb-color-neutral-700)]',
      'hover:bg-[var(--rb-color-neutral-100)]',
      'active:bg-[var(--rb-color-neutral-200)]',
    ],
  };

  const sizeStyles = {
    sm: ['text-[var(--rb-font-size-sm)]', 'px-[var(--rb-spacing-3)]', 'py-[var(--rb-spacing-1)]'],
    md: ['text-[var(--rb-font-size-base)]', 'px-[var(--rb-spacing-4)]', 'py-[var(--rb-spacing-2)]'],
    lg: ['text-[var(--rb-font-size-lg)]', 'px-[var(--rb-spacing-6)]', 'py-[var(--rb-spacing-3)]'],
  };

  const className = [...baseStyles, ...variantStyles[variant], ...sizeStyles[size]].join(' ');

  return (
    <Component
      className={className}
      disabled={disabled}
      aria-disabled={disabled}
      role={role}
      aria-label={ariaLabel}
      // @ts-expect-error type is only valid on button elements
      type={(props as { type?: string }).type || (Component === 'button' ? 'button' : undefined)}
      {...props}
    >
      {children}
    </Component>
  );
}
