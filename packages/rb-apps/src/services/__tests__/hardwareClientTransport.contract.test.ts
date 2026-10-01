import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionState, IOSnapshot } from '../hardwareClient';

const client = vi.hoisted(() => {
  const unsubscribeIO = vi.fn();
  const unsubscribeStatus = vi.fn();
  return {
    getState: vi.fn(() => ({ status: 'connected' })),
    subscribeIO: vi.fn<(listener: (snapshot: IOSnapshot) => void) => () => void>(() => unsubscribeIO),
    subscribe: vi.fn<(listener: (state: ConnectionState) => void) => () => void>(() => unsubscribeStatus),
    setOutputs: vi.fn<(outputs: Record<string, number>) => Promise<boolean>>().mockResolvedValue(true),
    unsubscribeIO, unsubscribeStatus,
  };
});
vi.mock('../hardwareClient', () => ({ hardwareClient: client }));
import { HardwareClientTransport } from '../hardwareClientTransport';

describe('retained hardware-client transport contract', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shares subscriptions, emits numeric pin groups, and releases both subscriptions', async () => {
    const transport = new HardwareClientTransport();
    await transport.connect({ nodeId: 'board' });
    const listener = client.subscribeIO.mock.calls[0]?.[0];
    if (!listener) throw new Error('Expected I/O subscription');
    const snapshot: IOSnapshot = { timestamp: '2026-10-01T00:00:00.000Z', inputs: { SW: 3, BTN: 1 }, outputs: { LED: 2 } };
    const before = JSON.stringify(snapshot);
    listener(snapshot);
    expect(transport.poll()).toEqual({ 'board:SW': 3, 'board:BTN': 1, 'board:LED': 2 });
    expect(JSON.stringify(snapshot)).toBe(before);
    transport.pushInteraction('board', 'board:SW', 5);
    expect(client.setOutputs).toHaveBeenCalledWith({ SW: 5 });
    expect(transport.getStatus()).toEqual({ type: 'bridge', connected: true });
    await transport.disconnect();
    expect(client.unsubscribeIO).toHaveBeenCalledTimes(1);
    expect(client.unsubscribeStatus).toHaveBeenCalledTimes(1);
    await transport.disconnect();
    expect(client.unsubscribeIO).toHaveBeenCalledTimes(1);
    expect(client.unsubscribeStatus).toHaveBeenCalledTimes(1);
  });

  it('stops issuing interaction writes after the shared client reports offline', async () => {
    const transport = new HardwareClientTransport();
    await transport.connect({ nodeId: 'board' });
    const listener = client.subscribe.mock.calls[0]?.[0];
    if (!listener) throw new Error('Expected status subscription');
    listener({ status: 'offline', reason: 'disabled', message: 'Disabled for test' });
    transport.pushInteraction('board', 'SW', 1);
    expect(client.setOutputs).not.toHaveBeenCalled();
    expect(transport.getStatus()).toEqual({ type: 'bridge', connected: false });
    await transport.disconnect();
  });
});
