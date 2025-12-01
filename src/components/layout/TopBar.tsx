import React from 'react';
import Button from '../primitives/Button';

export default function TopBar({ theme, onToggleTheme }) {
  return (
    <header className="rb-topbar">
      <div className="rb-topbar-left">
        <span className="rb-topbar-label">Live Control Surface</span>
        <span className="rb-topbar-title">
          System kit, playground, and console for kids who build impossible things.
        </span>
      </div>
      <div className="rb-topbar-actions">
        <Button variant="ghost" size="sm" label="Snapshot (imaginary save)" />
        <Button
          variant="primary"
          size="sm"
          label={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
          onClick={onToggleTheme}
        />
      </div>
    </header>
  );
}
