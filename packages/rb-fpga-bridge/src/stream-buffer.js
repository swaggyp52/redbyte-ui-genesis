/**
 * Ring Buffer for SSE Streaming Stability
 * Decouples UART ingestion from HTTP emission to prevent backpressure drops.
 */

export class StreamRingBuffer {
    constructor(size = 10000) {
        this.size = size;
        this.buffer = new Array(size);
        this.head = 0; // Write index
        this.tail = 0; // Read index
        this.count = 0;
        this.dropped = 0;
    }

    push(item) {
        if (this.count === this.size) {
            // Buffer full: Overwrite oldest (Move tail)
            this.tail = (this.tail + 1) % this.size;
            this.count--; // We are removing one effectively
            this.dropped++;
        }

        this.buffer[this.head] = item;
        this.head = (this.head + 1) % this.size;
        this.count++;
    }

    pop() {
        if (this.count === 0) return null;

        const item = this.buffer[this.tail];
        this.tail = (this.tail + 1) % this.size;
        this.count--;
        return item;
    }

    peek() {
        if (this.count === 0) return null;
        return this.buffer[this.tail];
    }

    isEmpty() {
        return this.count === 0;
    }

    isFull() {
        return this.count === this.size;
    }

    getStats() {
        return {
            size: this.size,
            count: this.count,
            dropped: this.dropped,
            head: this.head,
            tail: this.tail,
            estimatedMemoryBytes: this.getEstimatedMemoryUsageBytes()
        };
    }

    getEstimatedMemoryUsageBytes() {
        // Rough estimate: array pointer (8) + object overhead (~64) + JSON string size
        if (this.count === 0) return 0;

        // Sample a few items to get average size
        const samples = Math.min(this.count, 5);
        let totalSize = 0;
        for (let i = 0; i < samples; i++) {
            const idx = (this.tail + i) % this.size;
            const item = this.buffer[idx];
            // 8 bytes pointer + approx stringified length * 2 (utf16)
            totalSize += 8 + (JSON.stringify(item).length * 2);
        }
        const avgSize = totalSize / samples;
        return Math.floor(avgSize * this.count);
    }

    clear() {
        this.head = 0;
        this.tail = 0;
        this.count = 0;
        this.dropped = 0;
    }
}
