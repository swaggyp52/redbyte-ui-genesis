import React from 'react';

/** Native disclosure with predictable keyboard exit from its contained controls. */
export function WorkbenchDisclosure({ summary, children, onKeyDown, ...props }:
  Omit<React.DetailsHTMLAttributes<HTMLDetailsElement>, 'children'> & {
    summary: React.ReactNode;
    children: React.ReactNode;
  }) {
  return <details {...props} onKeyDown={event => {
    onKeyDown?.(event);
    if (event.key !== 'Escape' || event.defaultPrevented || !event.currentTarget.open) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.open = false;
    event.currentTarget.querySelector<HTMLElement>(':scope > summary')?.focus();
  }}>
    <summary>{summary}</summary>
    {children}
  </details>;
}
