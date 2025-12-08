import React from 'react';

export interface ShellProps {
  children?: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  return (
    <div className="shell-container" style={{ width: '100vw', height: '100vh', background: '#0a0a0a' }}>
      {children || <div style={{ color: '#fff', padding: '2rem' }}>RedByte Shell</div>}
    </div>
  );
};
