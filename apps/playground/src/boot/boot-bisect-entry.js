import React from 'react';
import ReactDOM from 'react-dom/client';
// TRULY MINIMAL: Only React, no CSS, no rb-* packages, no instrumentation
const root = document.getElementById('root');
if (root) {
    console.info('RB_BOOT_TRUE_STEP0', location.href);
    ReactDOM.createRoot(root).render(React.createElement('div', {
        id: 'boot-bisect',
        'data-step': 'true-0',
        style: { padding: 16, color: '#9ae6b4' }
    }, 'BOOT_BISECT TRUE STEP 0'));
}
