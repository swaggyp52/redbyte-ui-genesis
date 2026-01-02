// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useEffect } from 'react';
import { Modal } from '@redbyte/rb-primitives';
import { NARRATIVE_EVENTS } from './narrativeEvents';
import { onNarrativeChange, getActiveNarrative, dismiss, type NarrativeEventPayload } from './narrativeEngine';

/**
 * Marcus narrative overlay - displays milestone messages
 * Renders at Shell/root level, visible regardless of active window
 * Uses Modal with bottom-right variant for non-intrusive toast-like behavior
 */
export const NarrativeOverlay: React.FC = () => {
  const [narrative, setNarrative] = useState<NarrativeEventPayload | null>(getActiveNarrative());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = onNarrativeChange((newNarrative) => {
      setNarrative(newNarrative);
      setExpanded(false);
    });

    return unsubscribe;
  }, []);

  // Auto-hide after 15 seconds unless expanded
  useEffect(() => {
    if (!narrative || expanded) {
      return;
    }

    const timer = setTimeout(() => {
      dismiss();
    }, 15000);

    return () => clearTimeout(timer);
  }, [narrative, expanded]);

  const handleToggleExpand = () => {
    setExpanded(!expanded);
  };

  if (!narrative) {
    return null;
  }

  const event = NARRATIVE_EVENTS[narrative.eventId];
  if (!event) {
    return null;
  }

  return (
    <Modal
      isOpen={true}
      onClose={dismiss}
      variant="bottom-right"
      size="sm"
      closeOnBackdrop={false}
      closeOnEsc={true}
    >
      {/* Header with Marcus branding */}
      <div className="flex items-center mb-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center mr-3 text-xl"
          style={{
            background: 'linear-gradient(135deg, #00d9ff 0%, #0077ff 100%)',
          }}
        >
          💭
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Marcus</div>
          <div className="text-base font-bold text-gray-100">{event.title}</div>
        </div>
      </div>

      {/* Message */}
      <div className="text-gray-200 text-sm leading-relaxed mb-3">{event.message}</div>

      {/* Expanded message */}
      {expanded && event.expandedMessage && (
        <div className="text-gray-400 text-sm leading-relaxed mt-3 pt-3 border-t border-gray-600/30">
          {event.expandedMessage}
        </div>
      )}

      {/* Show more/less button */}
      {event.expandedMessage && (
        <button
          onClick={handleToggleExpand}
          className="text-cyan-400 text-sm mt-2 hover:text-cyan-300 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded px-1"
        >
          {expanded ? '↑ Show less' : '↓ Show me more'}
        </button>
      )}
    </Modal>
  );
};
