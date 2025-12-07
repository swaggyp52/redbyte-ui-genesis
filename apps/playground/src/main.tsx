import React from 'react';
import ReactDOM from 'react-dom/client';

import { applyTheme } from '@rb/rb-theme';
import { Shell } from '@rb/rb-shell';
import { Launcher } from '@rb/rb-apps';

applyTheme(null, 'dark-neon');

const root = document.getElementById('root');

ReactDOM.createRoot(root!).render(
  <React.StrictMode>
    <Shell>
      <Launcher />
    </Shell>
  </React.StrictMode>
);
