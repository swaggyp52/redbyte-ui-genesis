// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export interface LauncherProps {
  apps?: Array<{id: string; name: string}>;
}

export const Launcher: React.FC<LauncherProps> = ({ apps = [] }) => {
  return (
    <div style={{ padding: '1rem', color: '#fff' }}>
      <h2>App Launcher</h2>
      {apps.length === 0 && <p>No apps registered</p>}
      {apps.map(app => (
        <div key={app.id} style={{ margin: '0.5rem 0' }}>
          {app.name}
        </div>
      ))}
    </div>
  );
};
