import React from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Shell({ route, onRouteChange, theme, onToggleTheme, children }) {
  return (
    <div className="rb-shell">
      <Sidebar route={route} onRouteChange={onRouteChange} />
      <div className="rb-main">
        <TopBar theme={theme} onToggleTheme={onToggleTheme} />
        <div className="rb-main-inner">
          {children}
        </div>
      </div>
    </div>
  );
}
