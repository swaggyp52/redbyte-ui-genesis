import React from 'react';

const routes = [
  { id: 'overview', label: 'Overview' },
  { id: 'playground', label: 'Playground' },
  { id: 'systemkit', label: 'System Kit' },
];

export default function Sidebar({ route, onRouteChange }) {
  return (
    <aside className="rb-sidebar">
      <div className="rb-sidebar-logo">
        <div className="rb-sidebar-logo-badge" />
        <div className="rb-sidebar-logo-text">
          <span className="rb-sidebar-title">RedByte UI</span>
          <span className="rb-sidebar-subtitle">Genesis Console</span>
        </div>
      </div>

      <div>
        <div className="rb-sidebar-section-label">Sandbox</div>
        <nav className="rb-sidebar-nav">
          {routes.map((r) => (
            <button
              key={r.id}
              className={
                'rb-sidebar-nav-btn' +
                (route === r.id ? ' rb-sidebar-nav-btn-active' : '')
              }
              onClick={() => onRouteChange(r.id)}
            >
              <span>
                <span className="rb-sidebar-nav-btn-dot" />
                {r.label}
              </span>
              {route === r.id && <span style={{ fontSize: 11 }}>LIVE</span>}
            </button>
          ))}
        </nav>
      </div>

      <div className="rb-sidebar-footer">
        v2.0 • Genesis Build
        <br />
        © 2025 RedByte Interactive.
      </div>
    </aside>
  );
}

