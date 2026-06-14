// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HardwareClient } from '../services/hardwareClient';

describe('Hardware client surface boundary', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('does not let persisted hardware mode override an explicit off client', async () => {
    localStorage.setItem('rb-hardware-mode', 'on');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = new HardwareClient({ mode: 'off' });
    await Promise.resolve();

    const state = client.getState();
    expect(state.status).toBe('offline');
    if (state.status === 'offline') {
      expect(state.reason).toBe('disabled');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
