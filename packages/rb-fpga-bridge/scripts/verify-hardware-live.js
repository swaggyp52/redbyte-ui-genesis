
import { SerialPort } from 'serialport';
import RbBinV1Parser from '../src/parsers/rb-bin-v1.js';
import { RedByteIngestion } from '../src/ingestion.js';
import * as fs from 'fs';
import * as path from 'path';

const LOG_FILE = 'hardware-verification.log';
const CAPSULE_FILE = 'verification-capsule.json';

// Logger that writes to console and file
function log(msg) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${msg}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
}

async function run() {
    log("=== Starting Live Hardware Verification (Gates A & C) ===");

    // 1. Scan Ports
    log("Scanning Serial Ports...");
    const ports = await SerialPort.list();
    if (ports.length === 0) {
        log("FAIL: No serial ports found.");
        process.exit(1);
    }

    ports.forEach(p => log(`Found Port: ${p.path} (${p.manufacturer || 'Unknown'})`));

    // Auto-select likely candidate
    // Filter out Bluetooth
    const candidates = ports.filter(p => !p.pnpId || !p.pnpId.includes('BTHENUM'));

    if (candidates.length === 0) {
        log("FAIL: No non-Bluetooth ports found.");
        process.exit(1);
    }

    const targetPort = candidates.find(p =>
        (p.manufacturer && (p.manufacturer.includes('FTDI') || p.manufacturer.includes('Prolific'))) ||
        p.path.includes('USB')
    ) || candidates[0];

    log(`Selected Port: ${targetPort.path} (${targetPort.manufacturer || 'Generic'})`);

    // 2. Open Port
    const port = new SerialPort({
        path: targetPort.path,
        baudRate: 115200,
        autoOpen: false
    });

    const parser = new RbBinV1Parser();
    const ingestion = new RedByteIngestion({
        board: "Spartan-3E",
        jtag_idcode: "pending-verification",
        captured_at: new Date().toISOString(),
        transport: { type: "uart", port: targetPort.path, baud: 115200 }
    }, {
        clock_domain_hz: 50000000,
        start_tick: 0,
        end_tick: 0
    });

    let frames = 0;
    let seqErrors = 0;
    let lastSeq = -1;

    parser.on('data', (evt) => {
        frames++;

        // Check SEQ continuity
        if (lastSeq !== -1) {
            const expected = (lastSeq + 1) & 0xFF; // 8-bit seq
            if (evt.seq !== expected) {
                log(`WARN: SEQ Gap detected! Prev=${lastSeq}, Curr=${evt.seq}`);
                seqErrors++;
            }
        }
        lastSeq = evt.seq;

        // Log Heartbeat (every 100th frame approx, or change detection)
        if (frames % 10 === 1) {
            const { sw, btn, led } = evt.payload;
            log(`RX Frame #${frames} | TICK: ${evt.tick} | SEQ: ${evt.seq} | SW:${sw.toString(2)} BTN:${btn.toString(2)}`);
        }

        // Record
        ingestion.recordEvent(evt);

        // Stop condition (e.g. 50 frames for brevity, or 10s)
        if (frames >= 50) {
            finish(true);
        }
    });

    parser.on('error', (err) => {
        log(`CRC ERROR: ${err.message}`);
    });

    try {
        await new Promise((resolve, reject) => {
            port.open((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        log("Port Opened Successfully.");

        // Pipe
        port.pipe(parser);

        // Timeout
        setTimeout(() => {
            log("Timeout: 15s elapsed.");
            finish(frames > 0);
        }, 15000);

    } catch (e) {
        log(`CRITICAL: Failed to open port. ${e.message}`);
        if (e.message.includes('Access denied')) {
            log("HINT: Port might be busy. Stop 'npm run dev' bridge?");
        }
        process.exit(1);
    }

    function finish(success) {
        log("=== Verification Summary ===");
        log(`Total Frames: ${frames}`);
        log(`CRC Errors: ${parser.stats.crcErrors}`);
        log(`SEQ Errors: ${seqErrors}`);
        log(`Resyncs: ${parser.stats.resyncs}`);

        if (frames > 0) {
            const capsule = ingestion.saveSync(CAPSULE_FILE);
            log(`Success! Capsule saved to ${CAPSULE_FILE}`);
            log(`End of Log.`);
            process.exit(0);
        } else {
            log("FAIL: No frames received.");
            process.exit(1);
        }
    }
}

run().catch(e => console.error(e));
