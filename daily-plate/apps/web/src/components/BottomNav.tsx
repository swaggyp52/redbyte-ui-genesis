import type { ReactElement } from 'react';
import { pathFor, type Route } from '../lib/router.js';
import { useApp } from '../lib/store.js';

const items: Array<{ route: Route; label: string; icon: ReactElement; primary?: boolean }> = [
  {
    route: 'today',
    label: 'Today',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
      </svg>
    ),
  },
  {
    route: 'add',
    label: 'Add Food',
    primary: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  {
    route: 'foods',
    label: 'My Foods',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h10" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const { route, navigate } = useApp();
  return (
    <nav className="bottom-nav" aria-label="Main">
      {items.map((item) => (
        <a
          key={item.route}
          href={pathFor(item.route)}
          className={item.primary ? 'primary' : undefined}
          aria-current={route === item.route ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            navigate(item.route);
          }}
        >
          {item.icon}
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}
