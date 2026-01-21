import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function bless() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log("Usage: node bless-capsule.js <trace.ndjson> <lab-manifest.json> <out-evidence.json>");
    process.exit(1);
  }

  const tracePath = args[0];
  const manifestPath = args[1];
  const outPath = args[2];

  if (!fs.existsSync(tracePath)) {
    console.error(`Trace not found: ${tracePath}`);
    process.exit(1);
  }
  if (!fs.existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    process.exit(1);
  }

  console.log(`Blessing session...`);
  console.log(`  Trace: ${tracePath}`);
  console.log(`  Manifest: ${manifestPath}`);

  const traceContent = fs.readFileSync(tracePath); // Read as buffer
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);

  // 1. Hash Trace
  const traceHash = sha256(traceContent);
  console.log(`  Trace Hash: ${traceHash.substring(0, 12)}...`);

  // 2. Generate Session ID (random or from trace content?)
  // For specific determinism, use hash of start time + trace hash. 
  // But let's keep it random for now to act as a unique run ID unless provided.
  const sessionId = `sess-${crypto.randomBytes(6).toString('hex')}`;

  // 3. Compute Integrity Seal
  // seal = sha256(session_id + trace_hash + canonical_manifest_string)
  // We use the raw manifest string from file to ensure exact byte match if possible, 
  // but better to canonicalize if we can. 
  // For now, let's use the stripped JSON string.
  const canonicalManifest = JSON.stringify(manifest);
  const integrityPayload = `${sessionId}:${traceHash}:${canonicalManifest}`;
  const integrityHash = sha256(integrityPayload);

  const evidence = {
    capsule_version: 1,
    created_at: new Date().toISOString(),
    session_id: sessionId,
    lab_manifest: manifest,
    trace_hash: traceHash,
    integrity_hash: integrityHash,
    metadata: {
      host: process.env.COMPUTERNAME || 'unknown',
      user: process.env.USERNAME || 'unknown'
    }
  };

  fs.writeFileSync(outPath, JSON.stringify(evidence, null, 2));
  console.log(`Evidence Capsule Sealed: ${outPath}`);
  console.log(`Integrity Hash: ${integrityHash}`);
}

bless().catch(err => {
  console.error(err);
  process.exit(1);
});
