import { bytesToHex } from "./hex.js";

/** Codepoint comparator — locale-independent, deterministic. */
function cmpCodepoint(a: string, b: string): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export interface CapsuleFileInput {
  path: string;
  bytes: Uint8Array;
}

export interface CapsuleFileHash {
  path: string;
  hash: string;
}

export interface CapsuleObject {
  algo: "sha256";
  files: CapsuleFileHash[];
}

export interface CapsuleBuildResult {
  capsule: CapsuleObject;
  capsuleJsonUtf8: Uint8Array;
}

export function normalizeCapsulePath(inputPath: string): string {
  let normalized = inputPath.replace(/\\/g, "/");
  while (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }
  if (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }
  return normalized;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto unavailable for SHA-256.");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

export async function buildCapsule(inputs: CapsuleFileInput[]): Promise<CapsuleBuildResult> {
  const normalized = inputs.map((input) => ({
    path: normalizeCapsulePath(input.path),
    bytes: input.bytes,
  }));

  const files: CapsuleFileHash[] = [];
  for (const entry of normalized) {
    const hash = await sha256Hex(entry.bytes);
    files.push({ path: entry.path, hash });
  }

  files.sort((a, b) => cmpCodepoint(a.path, b.path));

  const capsule: CapsuleObject = {
    algo: "sha256",
    files,
  };

  const json = JSON.stringify(capsule);
  const capsuleJsonUtf8 = new TextEncoder().encode(json);

  return { capsule, capsuleJsonUtf8 };
}
