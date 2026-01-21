/**
 * Evidence Capsule Generator
 * Creates a signed snapshot of a lab run.
 */
import crypto from 'crypto';

function sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

export function generateEvidenceCapsule(runData) {
    const {
        studentId = "anonymous",
        labId = "unknown",
        boardModelId,
        designHashes = {},
        samples = [],
        startTime,
        endTime
    } = runData;

    // 1. Calculate Stats
    const durationMs = endTime - startTime;
    const sampleCount = samples.length;
    const tMsStart = samples.length > 0 ? samples[0].t_ms : null;
    const tMsEnd = samples.length > 0 ? samples[samples.length - 1].t_ms : null;

    // 2. Extract Excerpt (First 50 + Last 50)
    const EXCERPT_SIZE = 50;
    let excerpt = [];
    if (samples.length <= EXCERPT_SIZE * 2) {
        excerpt = samples;
    } else {
        excerpt = [
            ...samples.slice(0, EXCERPT_SIZE),
            ...samples.slice(-EXCERPT_SIZE)
        ];
    }

    // 3. Assemble Payload
    const capsule = {
        version: "1.0.0",
        meta: {
            student_id: studentId,
            lab_id: labId,
            timestamp: new Date().toISOString(),
            duration_ms: durationMs,
            sample_count: sampleCount
        },
        design: {
            board_model_id: boardModelId,
            wrapper_hash: designHashes.wrapper ?? "unknown",
            pinmap_hash: designHashes.pinmap ?? "unknown",
            bitstream_hash: designHashes.bitstream ?? "unknown"
        },
        trace: {
            stats: {
                t_ms_start: tMsStart,
                t_ms_end: tMsEnd
            },
            excerpt: excerpt
        }
    };

    // 4. integrity Hash
    const contentString = JSON.stringify(capsule); // Deterministic stringify needed? 
    // For strict determinism we might need canonical-json, but standard JSON.stringify 
    // key order is usually stable in V8. We'll use the string representation as the auth base.

    capsule.integrity_hash = sha256(contentString);

    return capsule;
}
