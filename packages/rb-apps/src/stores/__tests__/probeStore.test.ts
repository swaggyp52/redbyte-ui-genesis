// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { beforeEach, describe, expect, it } from 'vitest';
import { useProbeStore } from '../probeStore';
import { useViewStateStore } from '../viewStateStore';

describe('Probe Store', () => {
  beforeEach(() => {
    useProbeStore.getState().clearProbes();
    useViewStateStore.getState().clearSelection();
  });

  it('adds probes and sets active', () => {
    const id = useProbeStore.getState().addProbe({
      nodeId: 'node-1',
      portName: 'out',
      label: 'Node 1 Out',
    });

    const state = useProbeStore.getState();
    expect(state.probes).toHaveLength(1);
    expect(state.probes[0].id).toBe(id);
    expect(state.activeProbeId).toBe(id);
  });

  it('removes probes', () => {
    const id = useProbeStore.getState().addProbe({
      nodeId: 'node-2',
      portName: 'out',
      label: 'Node 2 Out',
    });

    useProbeStore.getState().removeProbe(id);
    expect(useProbeStore.getState().probes).toHaveLength(0);
  });

  it('renames probes', () => {
    const id = useProbeStore.getState().addProbe({
      nodeId: 'node-3',
      portName: 'in',
      label: 'Initial',
    });

    useProbeStore.getState().renameProbe(id, 'Renamed');
    expect(useProbeStore.getState().probes[0].label).toBe('Renamed');
  });

  it('toggles probe enabled', () => {
    const id = useProbeStore.getState().addProbe({
      nodeId: 'node-4',
      portName: 'out',
      label: 'Node 4 Out',
    });

    useProbeStore.getState().toggleProbe(id);
    expect(useProbeStore.getState().probes[0].enabled).toBe(false);
  });

  it('selects a probe for highlighting', async () => {
    const id = useProbeStore.getState().addProbe({
      nodeId: 'node-5',
      portName: 'out',
      label: 'Node 5 Out',
    });

    useProbeStore.getState().setActiveProbe(id);
    expect(useProbeStore.getState().activeProbeId).toBe(id);

    // Wait for queueMicrotask to complete the cross-store sync
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(useViewStateStore.getState().selectedNodeIds.has('node-5')).toBe(true);
  });
});
