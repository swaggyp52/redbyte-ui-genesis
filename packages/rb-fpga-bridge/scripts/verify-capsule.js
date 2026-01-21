import fs from 'fs';
import crypto from 'crypto';

function sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

async function verify() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log("Usage: node verify-capsule.js <evidence.json> <trace.ndjson>");
        process.exit(1);
    }

    const evidencePath = args[0];
    const tracePath = args[1];

    if (!fs.existsSync(evidencePath)) process.exit(1);
    if (!fs.existsSync(tracePath)) process.exit(1);

    const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    const traceContent = fs.readFileSync(tracePath);

    // 1. Verify Trace Hash
    const actualTraceHash = sha256(traceContent);
    if (actualTraceHash !== evidence.trace_hash) {
        console.error(`[FAIL] Trace Hash Mismatch`);
        console.error(`  Expected: ${evidence.trace_hash}`);
        console.error(`  Actual:   ${actualTraceHash}`);
        process.exit(1);
    }

    // 2. Verify Integrity Seal
    const canonicalManifest = JSON.stringify(evidence.lab_manifest);
    const integrityPayload = `${evidence.session_id}:${evidence.trace_hash}:${canonicalManifest}`;
    const actualIntegrityHash = sha256(integrityPayload);

    if (actualIntegrityHash !== evidence.integrity_hash) {
        console.error(`[FAIL] Integrity Seal Broken`);
        process.exit(1);
    }

    console.log("[PASS] Evidence Valid");
}

verify().catch(err => {
    console.error(err);
    process.exit(1);
});
