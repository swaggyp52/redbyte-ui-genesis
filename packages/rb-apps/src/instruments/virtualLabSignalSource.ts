import { useMemo } from 'react';
import type { SignalRef, SignalSample, SignalSource } from '@redbyte/rb-instruments';
import type { LabGraph, LabTimeline } from '@redbyte/rb-logic-3d';
import { computeNetlist, buildNetHistory, sampleNetValue, PART_DEFINITIONS } from '@redbyte/rb-logic-3d';

interface UseVirtualLabSignalSourceOptions {
  graph: LabGraph;
  timeline: LabTimeline;
  pinStates: Record<string, number>;
  serial: string[];
  onLocatePins?: (pins: Array<{ nodeId: string; pinId: string }>) => void;
  onClearSerial?: () => void;
}

const makeNetSignalId = (netId: string) => `net:${netId}`;
const makePinSignalId = (pinKey: string) => `pin:${pinKey}`;

const sliceHistory = (
  entries: SignalSample[],
  tickFrom: number,
  tickTo: number,
  stride: number,
  fallbackValue: number
): SignalSample[] => {
  const clampedStride = Math.max(1, stride);
  const samples: SignalSample[] = [];
  let lastValue = fallbackValue;

  for (const entry of entries) {
    if (entry.tick <= tickFrom) {
      lastValue = entry.value;
      continue;
    }
    break;
  }

  samples.push({ tick: tickFrom, value: lastValue });
  let lastIncludedTick = tickFrom;

  for (const entry of entries) {
    if (entry.tick < tickFrom || entry.tick > tickTo) continue;
    if (entry.tick - lastIncludedTick < clampedStride) continue;
    samples.push(entry);
    lastIncludedTick = entry.tick;
    lastValue = entry.value;
  }

  if (samples.length === 1) {
    samples.push({ tick: tickTo, value: lastValue });
  }

  return samples;
};

const buildPinHistory = (
  timeline: LabTimeline,
  pinKey: string
): SignalSample[] => {
  const events = [...timeline.events].sort((a, b) => a.seq - b.seq);
  const history: SignalSample[] = [];
  for (const event of events) {
    if (event.type !== 'SIM_PIN_DIFF') continue;
    if (!event.pinDiffs || event.pinDiffs[pinKey] === undefined) continue;
    history.push({ tick: event.tick, value: event.pinDiffs[pinKey] });
  }
  return history;
};

export const useVirtualLabSignalSource = ({
  graph,
  timeline,
  pinStates,
  serial,
  onLocatePins,
  onClearSerial,
}: UseVirtualLabSignalSourceOptions): { signalSource: SignalSource; netlist: ReturnType<typeof computeNetlist> } => {
  const netlist = useMemo(() => computeNetlist(graph), [graph]);
  const netHistory = useMemo(() => buildNetHistory(timeline, netlist), [timeline, netlist]);

  const pinLabels = useMemo(() => {
    const labels = new Map<string, string>();
    graph.nodes.forEach((node) => {
      const def = PART_DEFINITIONS[node.type];
      if (!def) return;
      def.pins.forEach((pin) => {
        const key = `${node.id}:${pin.id}`;
        labels.set(key, `${node.type}:${pin.id}`);
      });
    });
    return labels;
  }, [graph.nodes]);

  const signalSource = useMemo<SignalSource>(() => {
    const resolveSignal = (signalId: string): SignalRef | null => {
      if (signalId.startsWith('net:')) {
        const netId = signalId.slice(4);
        const net = netlist.nets.find((entry) => entry.id === netId);
        if (!net) return null;
        return { id: makeNetSignalId(net.id), kind: 'net', label: net.id };
      }
      if (signalId.startsWith('pin:')) {
        const pinKey = signalId.slice(4);
        const label = pinLabels.get(pinKey) ?? pinKey;
        return { id: makePinSignalId(pinKey), kind: 'pin', label };
      }
      return null;
    };

    const listSignals = (): SignalRef[] =>
      netlist.nets.map((net) => ({
        id: makeNetSignalId(net.id),
        kind: 'net',
        label: net.id,
      }));

    const sample = (signal: SignalRef, tick: number): number => {
      if (signal.kind === 'net') {
        const netId = signal.id.startsWith('net:') ? signal.id.slice(4) : signal.id;
        return sampleNetValue(netId, netlist, pinStates);
      }
      if (signal.kind === 'pin') {
        const pinKey = signal.id.startsWith('pin:') ? signal.id.slice(4) : signal.id;
        return pinStates[pinKey] ?? 0;
      }
      return 0;
    };

    const getHistory = (signal: SignalRef, tickFrom: number, tickTo: number, stride: number): SignalSample[] => {
      if (signal.kind === 'net') {
        const netId = signal.id.startsWith('net:') ? signal.id.slice(4) : signal.id;
        const history = netHistory[netId] ?? [];
        const fallback = sampleNetValue(netId, netlist, pinStates);
        return sliceHistory(history, tickFrom, tickTo, stride, fallback);
      }
      if (signal.kind === 'pin') {
        const pinKey = signal.id.startsWith('pin:') ? signal.id.slice(4) : signal.id;
        const history = buildPinHistory(timeline, pinKey);
        const fallback = pinStates[pinKey] ?? 0;
        return sliceHistory(history, tickFrom, tickTo, stride, fallback);
      }
      return [];
    };

    const getMetadata = (signal: SignalRef): Record<string, unknown> | undefined => {
      if (signal.kind === 'net') {
        const netId = signal.id.startsWith('net:') ? signal.id.slice(4) : signal.id;
        const net = netlist.nets.find((entry) => entry.id === netId);
        if (!net) return undefined;
        return { members: net.pins.length, pins: net.pins };
      }
      if (signal.kind === 'pin') {
        const pinKey = signal.id.startsWith('pin:') ? signal.id.slice(4) : signal.id;
        return { pinKey };
      }
      return undefined;
    };

    const locate = (signal: SignalRef) => {
      if (!onLocatePins) return;
      if (signal.kind === 'net') {
        const netId = signal.id.startsWith('net:') ? signal.id.slice(4) : signal.id;
        const net = netlist.nets.find((entry) => entry.id === netId);
        if (net) onLocatePins(net.pins.map((pin) => ({ nodeId: pin.nodeId, pinId: pin.pinId })));
      }
      if (signal.kind === 'pin') {
        const pinKey = signal.id.startsWith('pin:') ? signal.id.slice(4) : signal.id;
        const [nodeId, pinId] = pinKey.split(':');
        if (nodeId && pinId) onLocatePins([{ nodeId, pinId }]);
      }
    };

    return {
      listSignals,
      resolveSignal,
      sample,
      getHistory,
      getMetadata,
      locate,
      getSerialLog: () => serial,
      clearSerialLog: onClearSerial,
    };
  }, [netlist, netHistory, pinStates, timeline, serial, onLocatePins, onClearSerial, pinLabels]);

  return { signalSource, netlist };
};
