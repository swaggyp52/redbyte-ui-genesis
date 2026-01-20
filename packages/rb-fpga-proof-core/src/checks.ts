import type { HardwareTraceEvent } from './types';

export type LabCheck =
  | {
      id: string;
      type: 'min_events';
      min: number;
    }
  | {
      id: string;
      type: 'min_hw_ticks';
      min: number;
    }
  | {
      id: string;
      type: 'digital_toggled';
      bit: number;
    };

export type LabTemplateWithChecks = {
  checks?: LabCheck[];
};

export type CheckResult = {
  id: string;
  type: LabCheck['type'];
  pass: boolean;
  message: string;
};

function getSortedEvents(events: HardwareTraceEvent[]): HardwareTraceEvent[] {
  return [...events].sort((a, b) => {
    if (a.hw_tick !== b.hw_tick) return a.hw_tick - b.hw_tick;
    return a.mono_seq - b.mono_seq;
  });
}

function computeHwTickSpan(events: HardwareTraceEvent[]): number {
  if (events.length === 0) return 0;
  let minTick = events[0].hw_tick;
  let maxTick = events[0].hw_tick;
  for (const event of events) {
    if (event.hw_tick < minTick) minTick = event.hw_tick;
    if (event.hw_tick > maxTick) maxTick = event.hw_tick;
  }
  return maxTick - minTick;
}

function countDigitalToggles(events: HardwareTraceEvent[], bit: number): number {
  if (events.length === 0) return 0;
  const mask = 1 << bit;
  let toggles = 0;
  let prevValue = (events[0].digital & mask) !== 0;
  for (let i = 1; i < events.length; i += 1) {
    const nextValue = (events[i].digital & mask) !== 0;
    if (nextValue !== prevValue) {
      toggles += 1;
      prevValue = nextValue;
    }
  }
  return toggles;
}

export function evaluateChecks(
  labTemplate: LabTemplateWithChecks | null | undefined,
  events: HardwareTraceEvent[],
): { results: CheckResult[]; pass: boolean } {
  const checks = labTemplate?.checks ?? [];
  if (checks.length === 0) {
    return { results: [], pass: true };
  }

  const orderedEvents = getSortedEvents(events || []);
  const eventCount = orderedEvents.length;
  const hwTickSpan = computeHwTickSpan(orderedEvents);

  const results = checks.map((check) => {
    if (check.type === 'min_events') {
      const pass = eventCount >= check.min;
      return {
        id: check.id,
        type: check.type,
        pass,
        message: `events >= ${check.min} (got ${eventCount})`,
      };
    }

    if (check.type === 'min_hw_ticks') {
      const pass = hwTickSpan >= check.min;
      return {
        id: check.id,
        type: check.type,
        pass,
        message: `hw_tick span >= ${check.min} (got ${hwTickSpan})`,
      };
    }

    if (check.type === 'digital_toggled') {
      const toggles = countDigitalToggles(orderedEvents, check.bit);
      const pass = toggles > 0;
      return {
        id: check.id,
        type: check.type,
        pass,
        message: `digital bit ${check.bit} toggles: ${toggles}`,
      };
    }

    return {
      id: check.id,
      type: check.type,
      pass: false,
      message: 'unknown check type',
    };
  });

  return { results, pass: results.every((result) => result.pass) };
}
