// @vitest-environment node

import { describe, expect, it } from "vitest";
import { getPublicKey } from "@noble/ed25519";
import { hexToBytes, bytesToHex, signCapsule, verifyCapsule } from "../index.js";

describe("rb-fpga-signing", () => {
  it("signs and verifies capsule bytes", async () => {
    const privateKeyHex = "11".repeat(32);
    const publicKeyHex = bytesToHex(await getPublicKey(hexToBytes(privateKeyHex)));
    const capsuleBytes = new TextEncoder().encode('{"algo":"sha256","files":[]}');

    const signature = await signCapsule(capsuleBytes, privateKeyHex);
    const ok = await verifyCapsule(capsuleBytes, signature, publicKeyHex);

    expect(ok).toBe(true);
  });

  it("fails verification on tamper", async () => {
    const privateKeyHex = "22".repeat(32);
    const publicKeyHex = bytesToHex(await getPublicKey(hexToBytes(privateKeyHex)));
    const capsuleBytes = new TextEncoder().encode('{"algo":"sha256","files":[]}');
    const signature = await signCapsule(capsuleBytes, privateKeyHex);

    const tampered = new Uint8Array(capsuleBytes);
    tampered[0] ^= 0x01;

    const ok = await verifyCapsule(tampered, signature, publicKeyHex);
    expect(ok).toBe(false);
  });
});
