// Copyright Ac 2025 Connor Angiel â€“ RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import {
  mergeWireProbeColorsForNetHighlight,
  NET_HIGHLIGHT_COLOR,
} from '../components/Rb3DSceneCircuit';

describe('3D net highlight reflection', () => {
  it('adds highlight color when wire is highlighted', () => {
    expect(mergeWireProbeColorsForNetHighlight(undefined, true)).toEqual([NET_HIGHLIGHT_COLOR]);
    expect(mergeWireProbeColorsForNetHighlight([], true)).toEqual([NET_HIGHLIGHT_COLOR]);
    expect(mergeWireProbeColorsForNetHighlight(['#00ff00'], true)).toEqual(['#00ff00', NET_HIGHLIGHT_COLOR]);
  });

  it('does not duplicate highlight color', () => {
    expect(mergeWireProbeColorsForNetHighlight([NET_HIGHLIGHT_COLOR], true)).toEqual([NET_HIGHLIGHT_COLOR]);
    expect(mergeWireProbeColorsForNetHighlight(['#00ff00', NET_HIGHLIGHT_COLOR], true)).toEqual([
      '#00ff00',
      NET_HIGHLIGHT_COLOR,
    ]);
  });

  it('does not modify colors when not highlighted', () => {
    expect(mergeWireProbeColorsForNetHighlight(undefined, false)).toBeUndefined();
    expect(mergeWireProbeColorsForNetHighlight([], false)).toEqual([]);
    expect(mergeWireProbeColorsForNetHighlight(['#00ff00'], false)).toEqual(['#00ff00']);
  });
});

