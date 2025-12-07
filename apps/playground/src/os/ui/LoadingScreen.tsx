import React from 'react';

export default function LoadingScreen() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'black',
        zIndex: 9999,
        pointerEvents: 'none', // ensures it never blocks clicks
      }}
    >
      <div style={{ color: 'white', fontSize: '24px', opacity: 0.75 }}>
        Loading…
      </div>
    </div>
  );
}
