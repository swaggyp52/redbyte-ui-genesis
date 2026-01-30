// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export interface MenuItemProps {
  children?: React.ReactNode;
  label?: string; // Legacy support
  onClick?: () => void;
  disabled?: boolean;
}

export const MenuItem: React.FC<MenuItemProps> = ({ children, label, onClick, disabled }) => (
  <button
    role="menuitem"
    onClick={onClick}
    disabled={disabled}
    aria-disabled={disabled}
    className="w-full text-left px-[var(--rb-spacing-3)] py-[var(--rb-spacing-2)] text-[var(--rb-font-size-base)] hover:bg-[var(--rb-color-neutral-200)] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:bg-[var(--rb-color-accent-100)] transition-colors duration-[var(--rb-duration-fast)]"
  >
    {children || label}
  </button>
);

export const MenuSeparator: React.FC = () => (
  <div className="h-px bg-[var(--rb-color-neutral-200)] my-[var(--rb-spacing-1)]" role="separator" />
);

export interface MenuProps {
  items?: MenuItemProps[];
  children?: React.ReactNode;
  className?: string;
  label?: string;
  align?: 'left' | 'right'; // Support alignment prop seen in usage
}

// Default export combined with named exports
const MenuComponent: React.FC<MenuProps> & { Item: typeof MenuItem; Separator: typeof MenuSeparator } = ({
  items = [],
  children,
  className,
  label = 'Menu'
}) => {
  // Use children if present, otherwise fallback to items map
  const content = children || (Array.isArray(items) ? items.map((item, index) => (
    <MenuItem key={index} {...item} />
  )) : null);

  if (!content) {
    if (import.meta.env.DEV) {
      // Only warn if truly empty (no items AND no children)
      console.warn('[Menu] No items or children provided');
    }
    return null;
  }

  return (
    <div
      role="menu"
      aria-label={label}
      className={`bg-[var(--rb-color-neutral-50)] rounded-[var(--rb-radius-md)] shadow-[var(--rb-shadow-lg)] py-[var(--rb-spacing-1)] ${className || ''}`}
    >
      {content}
    </div>
  );
};

// Attach subcomponents
MenuComponent.Item = MenuItem;
MenuComponent.Separator = MenuSeparator;

export const Menu = MenuComponent;

