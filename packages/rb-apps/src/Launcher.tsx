import React from 'react';
import { getApps } from './index';

export function Launcher() {
  const apps = getApps();

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {apps.map(app => (
        <button
          key={app.id}
          style={{
            padding: '10px 16px',
            background: '#222',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: 6,
            cursor: 'pointer'
          }}
          onClick={() => console.log('Launch app:', app.id)}
        >
          {app.name}
        </button>
      ))}
    </div>
  );
}
