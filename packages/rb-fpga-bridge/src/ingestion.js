// RedByte Ingestion Recorder
// Captures a deterministic session into a Spartan3ECapsule

import * as fs from 'fs';
import * as path from 'path';

export class RedByteIngestion {
    constructor(meta, sessionParams) {
        this.meta = meta;
        this.session = sessionParams;
        this.timeline = [];
        this.startTime = Date.now();
    }

    recordEvent(event) {
        // Event should match HardwareEvent interface
        // { type, tick, seq, payload }
        this.timeline.push(event);
    }

    finalize() {
        // Typically called at stopRun
        const capsule = {
            meta: this.meta,
            session: {
                ...this.session,
                end_tick: this.timeline.length > 0 ? this.timeline[this.timeline.length - 1].tick : this.session.start_tick
            },
            timeline: this.timeline
        };
        return capsule;
    }

    saveSync(filepath) {
        const capsule = this.finalize();
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filepath, JSON.stringify(capsule, null, 2));
        return capsule;
    }
}
