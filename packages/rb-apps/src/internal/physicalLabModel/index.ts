// Internal opt-in model library. No route, application registration, or scene export.
export { useLabStore, type LabStoreState } from './store';
export { evaluateAtTick } from './labEvaluator';
export { fingerprintLabTemplate } from './labTemplate';
export { decodeLabTemplate } from './decodeLabTemplate';
export type { LabGraph, LabTimeline } from './types';
