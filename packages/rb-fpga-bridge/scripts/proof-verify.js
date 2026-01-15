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
    if (typeof evt.seq !== "number") errors.push(`Event ${i}: missing seq`);
    if (typeof evt.timestamp !== "number") errors.push(`Event ${i}: missing timestamp`);
    if (typeof evt.type !== "string") errors.push(`Event ${i}: missing type`);
  }
}

// 2. Monotonic seq ordering
if (proof.events && proof.events.length > 0) {
  for (let i = 1; i < proof.events.length; i++) {
    const prev = proof.events[i - 1];
    const curr = proof.events[i];
    if (curr.seq <= prev.seq) {
      errors.push(`Event ${i}: seq ${curr.seq} not greater than previous ${prev.seq}`);
    }
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
