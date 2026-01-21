import { decodeStreamFrames, STREAM_TYPE_SAMPLE, parseStreamSample } from "./proto/stream.js";

export function createStreamParser({ onSample, onError } = {}) {
  let buffer = Buffer.alloc(0);
  const stats = {
    bytes: 0,
    frames: 0,
    samples: 0,
    decode_errors: 0,
    last_frame_ms: null,
  };

  const write = (chunk) => {
    if (!chunk || chunk.length === 0) return;
    stats.bytes += chunk.length;
    buffer = Buffer.concat([buffer, chunk]);
    const decoded = decodeStreamFrames(buffer);
    buffer = decoded.remainder;
    for (const frame of decoded.frames) {
      stats.frames += 1;
      if (frame.type !== STREAM_TYPE_SAMPLE) {
        continue;
      }
      const parsed = parseStreamSample(frame.payload);
      if (!parsed.ok) {
        stats.decode_errors += 1;
        if (onError) {
          onError(parsed.error);
        }
        continue;
      }
      stats.samples += 1;
      stats.last_frame_ms = Date.now();
      if (onSample) {
        onSample(parsed.sample);
      }
    }
  };

  const reset = () => {
    buffer = Buffer.alloc(0);
  };

  const getStats = () => ({ ...stats });

  return { write, reset, getStats };
}
