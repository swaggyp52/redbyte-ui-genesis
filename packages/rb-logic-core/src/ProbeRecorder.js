/**
 * ProbeRecorder
 *
 * Pure, deterministic ring buffer for capturing tick-indexed samples.
 * Intended for engine-level sampling and test gates (no React dependencies).
 *
 * Invariants (contract):
 * - Tick indices are expected to be 0-based, monotonically increasing integers provided by the caller.
 * - Capacity is fixed at construction time (>= 1).
 * - When capacity is exceeded, the recorder overwrites the oldest samples (ring buffer).
 * - `getSamples()` always returns samples in chronological order (oldest -> newest).
 * - `getLength()` is always `<= capacity`.
 * - Dropped sample count is derived: `max(0, totalRecorded - capacity)`.
 */
export class ProbeRecorder {
    capacity;
    buffer;
    startIndex;
    count;
    total;
    constructor(capacity = 256) {
        this.capacity = Math.max(1, capacity | 0);
        this.buffer = new Array(this.capacity);
        this.startIndex = 0;
        this.count = 0;
        this.total = 0;
    }
    getCapacity() {
        return this.capacity;
    }
    getTotalSamples() {
        return this.total;
    }
    getDroppedSamples() {
        return Math.max(0, this.total - this.capacity);
    }
    getLength() {
        return this.count;
    }
    clear() {
        this.buffer = new Array(this.capacity);
        this.startIndex = 0;
        this.count = 0;
        this.total = 0;
    }
    record(tick, value) {
        const sample = { tick, value };
        this.total++;
        if (this.count < this.capacity) {
            this.buffer[(this.startIndex + this.count) % this.capacity] = sample;
            this.count++;
            return;
        }
        // Overwrite the oldest slot and advance start.
        this.buffer[this.startIndex] = sample;
        this.startIndex = (this.startIndex + 1) % this.capacity;
    }
    /**
     * Samples in chronological order (oldest -> newest).
     */
    getSamples() {
        const out = [];
        for (let i = 0; i < this.count; i++) {
            const idx = (this.startIndex + i) % this.capacity;
            const s = this.buffer[idx];
            if (s)
                out.push(s);
        }
        return out;
    }
}
