import React from 'react';

export interface PanelProps<T extends React.ElementType = 'div'> {
  as?: T;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

type PolymorphicPanelProps<T extends React.ElementType> = PanelProps<T> &
  Omit<React.ComponentPropsWithoutRef<T>, keyof PanelProps<T>>;

export function Panel<T extends React.ElementType = 'div'>({
  as,
  variant = 'default',
  padding = 'md',
  children,
  ...props
}: PolymorphicPanelProps<T>) {
  const Component = as || 'div';

  const baseStyles = [
    'rounded-[var(--rb-radius-lg)]',
    'bg-[var(--rb-color-neutral-50)]',
  ];

  const variantStyles = {
    default: [],
    elevated: ['shadow-[var(--rb-shadow-lg)]'],
    outlined: ['border', 'border-[var(--rb-color-neutral-300)]'],
  };

  const paddingStyles = {
    none: [],
    sm: ['p-[var(--rb-spacing-2)]'],
    md: ['p-[var(--rb-spacing-4)]'],
    lg: ['p-[var(--rb-spacing-6)]'],
  };

  const className = [...baseStyles, ...variantStyles[variant], ...paddingStyles[padding]].join(' ');

  return (
    <Component className={className} {...props}>
      {children}
    </Component>
  );
}
