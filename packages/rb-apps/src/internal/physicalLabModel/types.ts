// Actual graph/timeline data owner shared with the retained numeric instrument.
export type {
  Vector3, Quaternion, Color, LabPin, LabPartDefinition, LabNode, LabWire,
  LabNet, LabGraph, PinState, LabEventSource, BaseLabEvent, LabEvent,
  LabSnapshot, LabTimeline,
} from '../../instruments/virtualLabModel/types';

export interface LabSession {
  sessionId: string;
  templateId: string;
  templateHash: string;
  startedAtTick: number;
  status: 'idle' | 'active';
}
