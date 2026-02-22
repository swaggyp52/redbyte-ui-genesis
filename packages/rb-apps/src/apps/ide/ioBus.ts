import { useMemo } from 'react';
import type { RuntimeSimState } from './sim/simTypes';

export type Bit = 0 | 1;

export interface IoBusState {
  sw:  Bit[]; // length 16
  btn: Bit[]; // length 5
  ld:  Bit[]; // length 16
}

export interface IoBusActions {
  setSwitch(i: number, v: Bit): void;
  toggleSwitch(i: number): void;
  setButton(i: number, v: Bit): void;
}

export interface IoBusMeta {
  swNodeIds:  (string | null)[];  // length 16
  ldNodeIds:  (string | null)[];  // length 16
  btnNodeIds: (string | null)[];  // length 5
}

const BTN_LABELS = ['BTNC', 'BTNU', 'BTND', 'BTNL', 'BTNR'] as const;
const SW_RE  = /^SW(\d+)$/i;
const LD_RE  = /^LD(\d+)$/i;
const BTN_RE = /^BTN([A-Z]+)$/i;

function readBit(sim: RuntimeSimState, nodeId: string | null): Bit {
  if (!nodeId) return 0;
  const v =
    sim.inputs[nodeId]  ??
    sim.signals[nodeId] ??
    sim.signals[`${nodeId}.out`] ??
    0;
  return v === 1 ? 1 : 0;
}

export function useIoBus(args: {
  ioRows: Array<{ nodeId: string; label: string; direction: 'in' | 'out' }>;
  runtimeSim: RuntimeSimState;
  setInput: (nodeId: string, v: Bit) => void;
}): { state: IoBusState; actions: IoBusActions; meta: IoBusMeta } {
  const { ioRows, runtimeSim, setInput } = args;

  const meta: IoBusMeta = useMemo(() => {
    const swNodeIds:  (string | null)[] = Array(16).fill(null);
    const ldNodeIds:  (string | null)[] = Array(16).fill(null);
    const btnNodeIds: (string | null)[] = Array(5).fill(null);

    for (const row of ioRows) {
      const label = row.label.trim().toUpperCase();
      const swM = SW_RE.exec(label);
      if (swM && row.direction === 'in') {
        const idx = parseInt(swM[1], 10);
        if (idx >= 0 && idx < 16) swNodeIds[idx] = row.nodeId;
        continue;
      }
      const ldM = LD_RE.exec(label);
      if (ldM && row.direction === 'out') {
        const idx = parseInt(ldM[1], 10);
        if (idx >= 0 && idx < 16) ldNodeIds[idx] = row.nodeId;
        continue;
      }
      const btnM = BTN_RE.exec(label);
      if (btnM) {
        const suffix = btnM[1];
        const btnIdx = BTN_LABELS.indexOf(`BTN${suffix}` as typeof BTN_LABELS[number]);
        if (btnIdx >= 0) btnNodeIds[btnIdx] = row.nodeId;
      }
    }
    return { swNodeIds, ldNodeIds, btnNodeIds };
  }, [ioRows]);

  const state: IoBusState = useMemo(() => ({
    sw:  meta.swNodeIds.map((id)  => readBit(runtimeSim, id)),
    ld:  meta.ldNodeIds.map((id)  => readBit(runtimeSim, id)),
    btn: meta.btnNodeIds.map((id) => readBit(runtimeSim, id)),
  }), [meta, runtimeSim]);

  const actions: IoBusActions = useMemo(() => ({
    setSwitch(i: number, v: Bit) {
      const nodeId = meta.swNodeIds[i];
      if (nodeId) setInput(nodeId, v);
    },
    toggleSwitch(i: number) {
      const nodeId = meta.swNodeIds[i];
      if (nodeId) {
        const current = readBit(runtimeSim, nodeId);
        setInput(nodeId, current === 1 ? 0 : 1);
      }
    },
    setButton(i: number, v: Bit) {
      const nodeId = meta.btnNodeIds[i];
      if (nodeId) setInput(nodeId, v);
    },
  }), [meta, runtimeSim, setInput]);

  return { state, actions, meta };
}
