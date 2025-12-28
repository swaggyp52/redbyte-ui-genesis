// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

export { NARRATIVE_EVENTS, type NarrativeEventId, type NarrativeEventPayload, type NarrativeEventMetadata } from './narrativeEvents';
export { useNarrativeStore } from './narrativeStore';
export { trigger, dismiss, getActiveNarrative, onNarrativeChange, clearQueue } from './narrativeEngine';
export { NarrativeOverlay } from './NarrativeOverlay';
