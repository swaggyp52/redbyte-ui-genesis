import React from 'react';
import ReactDOM from 'react-dom/client';
import { bootstrapIDE } from './ide-bootstrap';
import '../index.css';

const FULL_BOOT_ENTRY = 'full-bootstrap.ts';

// Full bootstrap: all startup code
export async function bootstrap() {
  const url = typeof window !== 'undefined' ? window.location.href : 'unknown';
  console.log(`[RB_BOOT] mode=IDE url=${url} entry=${FULL_BOOT_ENTRY}`);

  try {
    await bootstrapIDE();
  } catch (error) {
    renderIdeBootCrash(error);
  }
}

function renderIdeBootCrash(error: unknown) {
  const root = document.getElementById('root');
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  document.documentElement.dataset.redbyteMode = 'ide-crash';
  console.error(`[RB_BOOT] mode=IDE status=CRASH entry=${FULL_BOOT_ENTRY} message=${message}`);

  if (!root) {
    console.error('[RB_BOOT] mode=IDE status=CRASH reason=missing-root');
    return;
  }

  ReactDOM.createRoot(root).render(
    React.createElement(
      'div',
      {
        'data-testid': 'rb-ide-boot-crash',
        'data-redbyte-crash': 'ide',
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100vw',
          height: '100vh',
          background: '#0f0f0f',
          color: '#f8fafc',
          fontFamily: 'monospace',
          padding: '24px',
          boxSizing: 'border-box',
          textAlign: 'left',
        },
      },
      React.createElement('h1', { style: { margin: 0, fontSize: '20px', color: '#ef4444' } }, 'RedByte IDE failed to boot'),
      React.createElement('p', { style: { marginTop: '12px', marginBottom: '8px', maxWidth: '900px' } }, message),
      React.createElement(
        'pre',
        {
          style: {
            margin: 0,
            padding: '12px',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '50vh',
            overflow: 'auto',
            border: '1px solid #334155',
            borderRadius: '6px',
            background: '#020617',
            color: '#cbd5e1',
          },
        },
        stack ?? 'No stack trace available.'
      )
    )
  );
}
