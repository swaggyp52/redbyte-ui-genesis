import React from 'react';

export interface TextProps<T extends React.ElementType = 'span'> {
  as?: T;
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: 'default' | 'muted' | 'accent';
  children: React.ReactNode;
}

type PolymorphicTextProps<T extends React.ElementType> = TextProps<T> &
  Omit<React.ComponentPropsWithoutRef<T>, keyof TextProps<T>>;

export function Text<T extends React.ElementType = 'span'>({
  as,
  size = 'base',
  weight = 'normal',
  color = 'default',
  children,
  ...props
}: PolymorphicTextProps<T>) {
  const Component = as || 'span';

  const sizeStyles = {
    xs: 'text-[var(--rb-font-size-xs)]',
    sm: 'text-[var(--rb-font-size-sm)]',
    base: 'text-[var(--rb-font-size-base)]',
    lg: 'text-[var(--rb-font-size-lg)]',
    xl: 'text-[var(--rb-font-size-xl)]',
    '2xl': 'text-[var(--rb-font-size-2xl)]',
    '3xl': 'text-[var(--rb-font-size-3xl)]',
  };

  const weightStyles = {
    normal: 'font-[var(--rb-font-weight-normal)]',
    medium: 'font-[var(--rb-font-weight-medium)]',
    semibold: 'font-[var(--rb-font-weight-semibold)]',
    bold: 'font-[var(--rb-font-weight-bold)]',
  };

  const colorStyles = {
    default: 'text-[var(--rb-color-neutral-900)]',
    muted: 'text-[var(--rb-color-neutral-600)]',
    accent: 'text-[var(--rb-color-accent-500)]',
  };

  const className = [sizeStyles[size], weightStyles[weight], colorStyles[color]].join(' ');

  return (
    <Component className={className} {...props}>
      {children}
    </Component>
  );
}
