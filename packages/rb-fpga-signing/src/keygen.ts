#!/usr/bin/env node

import { etc, getPublicKey, utils } from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { bytesToHex } from "./hex.js";

etc.sha512Sync = (...messages) => sha512(...messages);

async function main() {
  const privateKey = utils.randomPrivateKey();
  const publicKey = await getPublicKey(privateKey);

  const payload = {
    publicKeyHex: bytesToHex(publicKey),
    privateKeyHex: bytesToHex(privateKey),
  };

  process.stdout.write(JSON.stringify(payload) + "\n");
}

main().catch((err) => {
  console.error("[rb-keygen] Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
