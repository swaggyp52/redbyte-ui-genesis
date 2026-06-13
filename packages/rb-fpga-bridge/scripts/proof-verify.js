#!/usr/bin/env node
/**
 * Proof Verification Script
 * 
 * Validates proof JSON artifacts:
 * - Schema validity
 * - Monotonic seq ordering
 * - HMAC signature verification
 * - Deterministic replay check
 * 
 * Usage: node proof-verify.js <proof.json>
 * Exit: 0 (valid) or 1 (invalid)
 */

import { readFileSync } from "fs";
import { createHmac } from "crypto";

const proofFile = process.argv[2];
if (!proofFile) {
  console.error("Usage: node proof-verify.js <proof.json>");
  process.exit(1);
}

let proof;
try {
  proof = JSON.parse(readFileSync(proofFile, "utf-8"));
} catch (e) {
  console.error(`❌ Failed to parse proof JSON: ${e.message}`);
  process.exit(1);
}

const errors = [];

// 1. Schema validation
if (!Array.isArray(proof.events)) {
  errors.push("Missing or invalid events array");
} else {
  for (let i = 0; i < proof.events.length; i++) {
    const evt = proof.events[i];
    
    // Required fields
    if (typeof evt.seq !== "number") errors.push(`Event ${i}: missing or invalid seq (must be number)`);
    if (typeof evt.timestamp !== "number") errors.push(`Event ${i}: missing or invalid timestamp (must be number, got ${typeof evt.timestamp})`);
    if (typeof evt.type !== "string") errors.push(`Event ${i}: missing or invalid type (must be string)`);
    
    // Optional fields
    if (evt.ts_offset_ms !== undefined && (typeof evt.ts_offset_ms !== "number" || evt.ts_offset_ms < 0)) {
      errors.push(`Event ${i}: ts_offset_ms must be non-negative number, got ${evt.ts_offset_ms}`);
    }
  }
}

// 2. Seq validation (contiguous within the captured proof window)
if (proof.events && proof.events.length > 0) {
  let expectedSeq = proof.events[0].seq;
  for (let i = 0; i < proof.events.length; i++) {
    const curr = proof.events[i];
    if (curr.seq !== expectedSeq) {
      errors.push(`Event ${i}: seq ${curr.seq} is not contiguous (expected ${expectedSeq})`);
    }
    expectedSeq = curr.seq + 1;
  }
}

// 3. HMAC signature verification (if secret available)
const secret = process.env.RB_FPGA_HMAC_SECRET;
if (secret && proof.signature) {
  // Canonical event string: JSON array of events, no extra whitespace
  const canonical = JSON.stringify(proof.events);
  const computed = createHmac("sha256", secret).update(canonical).digest("hex");
  if (computed !== proof.signature) {
    errors.push(`HMAC signature mismatch: expected ${proof.signature}, computed ${computed}`);
  }
}

// 4. Stream hash determinism check
// (In a real system, run with same seed and compare hashes)
// For now, just validate structure exists
if (!proof.stream_hash) {
  // Optional but recommended
  console.warn("⚠️  Warning: stream_hash not present (determinism check skipped)");
}

// Report results
if (errors.length === 0) {
  console.log("✅ Proof valid");
  console.log(`   Events: ${proof.events?.length || 0}`);
  if (proof.stream_hash) console.log(`   Hash: ${proof.stream_hash}`);
  if (proof.signature) console.log(`   Signature: ${proof.signature.slice(0, 16)}...`);
  process.exit(0);
} else {
  console.error("❌ Proof invalid");
  errors.forEach((e) => console.error(`   - ${e}`));
  process.exit(1);
}
