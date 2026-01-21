import assert from "assert";
import { StreamRingBuffer } from "../src/stream-buffer.js";

function generateSample(i) {
    return {
        t_ms: i * 10,
        io: {
            sw: 0x01,
            btn: 0x02,
            led: 0x03,
            seg: 0x04,
            an: 0x05,
        }
    };
}

async function runSoakTest() {
    console.log("Starting Soak Test...");

    // 1. Setup a constrained buffer
    const MAX_ITEMS = 1000;
    const buffer = new StreamRingBuffer(MAX_ITEMS);

    // 2. Pump 100,000 samples (100x capacity)
    const TOTAL_SAMPLES = 100000;
    const start = performance.now();

    for (let i = 0; i < TOTAL_SAMPLES; i++) {
        buffer.push(generateSample(i));
    }

    const duration = performance.now() - start;
    const stats = buffer.getStats();

    // 3. Verify Memory Bounding
    try {
        assert.strictEqual(stats.count, MAX_ITEMS, "Buffer count should equal max items");
        assert.strictEqual(stats.dropped, TOTAL_SAMPLES - MAX_ITEMS, "Dropped count mismatch");

        const oldest = buffer.peek();
        // Oldest should be the 99000th item inserted (index 99000, value 99000*10)
        assert.strictEqual(oldest.t_ms, (TOTAL_SAMPLES - MAX_ITEMS) * 10, "Buffer tail mismatch");

        // Memory check: 100KB < Usage < 1MB
        assert.ok(stats.estimatedMemoryBytes < 1024 * 1024, "Memory usage exceeded 1MB");

        console.log(`[PASS] Soak Test: ${TOTAL_SAMPLES} samples in ${duration.toFixed(2)}ms`);
        console.log(`       Dropped: ${stats.dropped}`);
        console.log(`       Memory:  ${(stats.estimatedMemoryBytes / 1024).toFixed(2)} KB`);
    } catch (err) {
        console.error("[FAIL] Soak Test Failed:", err.message);
        process.exit(1);
    }
}

runSoakTest().catch(err => {
    console.error(err);
    process.exit(1);
});
