export function computeHwTick(tsWallMs, t0WallMs, binSizeMs) {
  return Math.floor((tsWallMs - t0WallMs) / binSizeMs);
}

export function createTimeBinner({ binSizeMs = 20, nowFn = () => Date.now() } = {}) {
  let t0WallMs = null;

  return {
    binSizeMs,
    now: () => nowFn(),
    getT0: () => t0WallMs,
    reset: () => {
      t0WallMs = null;
    },
    compute: (tsWallMs) => {
      if (t0WallMs === null) {
        t0WallMs = tsWallMs;
      }
      return computeHwTick(tsWallMs, t0WallMs, binSizeMs);
    },
  };
}
