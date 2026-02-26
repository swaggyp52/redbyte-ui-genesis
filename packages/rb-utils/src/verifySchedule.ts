// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Shared verify schedule contract used by runner/testbench/checkpoint paths.
 */
export type VerifySchedule = 'combinational' | 'clocked_macro';

/**
 * 3-tick macro sequence for sequential checks:
 * CLK=0 -> tick, CLK=1 -> tick, CLK=0 -> tick.
 */
export const CLOCKED_MACRO_SEQUENCE: readonly [0, 1, 0] = [0, 1, 0];
