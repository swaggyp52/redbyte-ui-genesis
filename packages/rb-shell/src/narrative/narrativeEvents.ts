// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Narrative event IDs - stable API for milestone triggers
 */
export type NarrativeEventId =
  | 'milestone.srLatchBuilt'
  | 'milestone.dffUnderstood'
  | 'milestone.counterRuns'
  | 'milestone.fsmExplored'
  | 'milestone.cpuExplored'
  | 'milestone.trackCComplete';

/**
 * Event payload with optional context
 */
export interface NarrativeEventPayload {
  eventId: NarrativeEventId;
  sourceAppId: string;
  timestamp: string; // ISO date
  metadata?: {
    exampleId?: string;
    chipId?: string;
    trackId?: string;
    lessonId?: string;
  };
}

/**
 * Event metadata for display and behavior
 */
export interface NarrativeEventMetadata {
  id: NarrativeEventId;
  title: string;
  message: string;
  expandedMessage?: string;
  allowRepeat?: boolean; // For dev mode
  prerequisites?: NarrativeEventId[]; // Events that must fire first
}

/**
 * Marcus narrative event catalog
 */
export const NARRATIVE_EVENTS: Record<NarrativeEventId, NarrativeEventMetadata> = {
  'milestone.srLatchBuilt': {
    id: 'milestone.srLatchBuilt',
    title: 'Memory Unlocked',
    message: 'You just built memory. Feedback turns "now" into "state."',
    expandedMessage:
      'The SR Latch you built is the foundation of all computer memory. ' +
      'By connecting outputs back to inputs, you created a circuit that remembers – ' +
      'a fundamental shift from purely combinational logic.',
  },
  'milestone.dffUnderstood': {
    id: 'milestone.dffUnderstood',
    title: 'Synchronized Computing',
    message: 'Edge-triggered storage. Billions of flip-flops, perfectly synchronized.',
    expandedMessage:
      'D Flip-Flops capture data at precise clock edges, allowing billions of components ' +
      'to work in lockstep. This synchronization is what makes modern CPUs possible.',
  },
  'milestone.counterRuns': {
    id: 'milestone.counterRuns',
    title: 'Time and Sequence',
    message: 'A counter evolves state with each tick. Computation happens in steps.',
    expandedMessage:
      'Counters demonstrate how circuits can change over time. Each clock tick advances the state, ' +
      'creating sequences – the foundation of programs and algorithms.',
  },
  'milestone.fsmExplored': {
    id: 'milestone.fsmExplored',
    title: 'Behavior Emerges',
    message: 'State machines make decisions, follow rules, change over time.',
    expandedMessage:
      'Finite State Machines bridge static logic and dynamic behavior. ' +
      'They follow rules, react to inputs, and embody the concept of "doing things" – ' +
      'the essence of intelligent systems.',
  },
  'milestone.cpuExplored': {
    id: 'milestone.cpuExplored',
    title: 'A Machine That Runs Steps',
    message: 'You\'ve connected state + combinational logic into a machine that runs steps.',
    expandedMessage:
      'A CPU is a state machine that fetches, decodes, and executes instructions. ' +
      'Every program you\'ve ever run – games, apps, operating systems – is ultimately ' +
      'this simple loop running billions of times per second.',
  },
  'milestone.trackCComplete': {
    id: 'milestone.trackCComplete',
    title: 'The Spine of Computers',
    message: 'You now understand the spine of computers: state, time, control.',
    expandedMessage:
      'From simple gates (Track A) through arithmetic (Track B) to sequential logic (Track C), ' +
      'you\'ve traced the complete path from electricity to computation. ' +
      'You understand how computers work at the deepest level.',
  },
};
