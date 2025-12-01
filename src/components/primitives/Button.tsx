import React from 'react';

interface ButtonProps {
  label: string;
  variant?: 'primary' | 'ghost';
  size?: 'sm' | 'md';
  onClick?: () => void;
}

export default function Button({
  label,
  variant = 'primary',
  size = 'md',
  onClick,
}: ButtonProps) {
  const className =
    'rb-btn ' +
    (variant === 'primary' ? 'rb-btn-primary ' : 'rb-btn-ghost ') +
    (size === 'sm' ? 'rb-btn-sm' : '');

  return (
    <button className={className} onClick={onClick}>
      {label}
    </button>
  );
}

