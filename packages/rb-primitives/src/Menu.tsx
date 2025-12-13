// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export interface MenuItemProps {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

export interface MenuProps {
  items: MenuItemProps[];
  className?: string;
  label?: string;
}

export const Menu: React.FC<MenuProps> = ({ items, className, label = 'Menu' }) => {
  return (
    <div
      role="menu"
      aria-label={label}
      className={`bg-[var(--rb-color-neutral-50)] rounded-[var(--rb-radius-md)] shadow-[var(--rb-shadow-lg)] py-[var(--rb-spacing-1)] ${className || ''}`}
    >
      {items.map((item, index) => (
        <button
          key={index}
          role="menuitem"
          onClick={item.onClick}
          disabled={item.disabled}
          aria-disabled={item.disabled}
          className="w-full text-left px-[var(--rb-spacing-3)] py-[var(--rb-spacing-2)] text-[var(--rb-font-size-base)] hover:bg-[var(--rb-color-neutral-200)] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:bg-[var(--rb-color-accent-100)] transition-colors duration-[var(--rb-duration-fast)]"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};
