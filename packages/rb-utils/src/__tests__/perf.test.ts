// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mark, measure, startPerfSummaryLogger, stopPerfSummaryLogger } from '../debug/perf';

describe('perf summary logging', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', 'http://localhost/');
  });

  afterEach(() => {
    stopPerfSummaryLogger();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not log summaries without the perf flag', () => {
    vi.useFakeTimers();
    const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});

    mark('test-start');
    mark('test-end');
    measure('test-measure', 'test-start', 'test-end');

    startPerfSummaryLogger(500);
    vi.advanceTimersByTime(1000);

    expect(tableSpy).not.toHaveBeenCalled();
  });
});
