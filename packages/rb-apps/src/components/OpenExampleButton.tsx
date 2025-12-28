// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { OpenExampleIntent } from '@redbyte/rb-shell';
import type { ExampleId } from '../examples';

interface OpenExampleButtonProps {
  exampleId: ExampleId;
  label?: string;
  onDispatchIntent?: (intent: OpenExampleIntent) => void;
  preferNewWindow?: boolean;
}

export const OpenExampleButton: React.FC<OpenExampleButtonProps> = ({
  exampleId,
  label = 'Open Example',
  onDispatchIntent,
  preferNewWindow = false,
}) => {
  const handleClick = () => {
    if (!onDispatchIntent) {
      console.warn('OpenExampleButton: onDispatchIntent not provided');
      return;
    }

    onDispatchIntent({
      type: 'open-example',
      payload: {
        sourceAppId: 'help',
        targetAppId: 'logic',
        exampleId,
      },
      routingHint: {
        preferNewWindow,
      },
    });
  };

  return (
    <button
      onClick={handleClick}
      style={{
        padding: '0.75rem 1.5rem',
        background: '#00d9ff',
        border: 'none',
        borderRadius: '6px',
        color: '#0f1419',
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '0.875rem',
        transition: 'all 0.2s',
        marginTop: '1rem',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#00b8d9';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#00d9ff';
      }}
    >
      {label}
    </button>
  );
};
