// Copyright Â© 2025 Connor Angiel â€” RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

export function computeInstrumentHz(opts: {
  performanceMode: boolean;
  focused: boolean;
  minimized: boolean;
}): number {
  if (opts.minimized) return 0;
  if (opts.performanceMode) return 10;
  if (!opts.focused) return 15;
  return 60;
}

