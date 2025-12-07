/**
 * CryptoIdentity
 *
 * Client-side cryptographic identity for RedByte users.
 * - Generates an ECDSA P-256 keypair per user
 * - Stores keys in localStorage (NOT secure storage)
 * - Derives a short fingerprint from the public key
 *
 * This is NOT production-grade auth. It is a teaching / demo layer
 * and a backbone you can wire into a real backend later.
 */

export interface UserKeypairRecord {
  publicKey: string;   // base64 (SPKI)
  privateKey: string;  // base64 (PKCS8)
  fingerprint: string; // short hex, e.g. "A1B2C3D4E5F6A7B8"
}

const KEY_PREFIX = "redbyte_user_keys_v1_";

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa !== "undefined" ? btoa(binary) : "";
}

function base64ToUint8Array(b64: string): Uint8Array {
  if (!b64) return new Uint8Array();
  const binary = typeof atob !== "undefined" ? atob(b64) : "";
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return "";
  }
  // Use a sliced buffer so TypeScript is happy with BufferSource
  const copy = data.slice();
  const hashBuf = await crypto.subtle.digest("SHA-256", copy.buffer);
  const arr = Array.from(new Uint8Array(hashBuf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function loadUserKeys(userId: string): UserKeypairRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as UserKeypairRecord;
  } catch {
    return null;
  }
}

export function saveUserKeys(userId: string, record: UserKeypairRecord) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(record));
  } catch {
    // ignore
  }
}

/**
 * ensureUserKeys
 *
 * Returns an existing keypair for the user, or generates a new one
 * using WebCrypto. If crypto APIs are unavailable, returns null.
 */
export async function ensureUserKeys(
  userId: string
): Promise<UserKeypairRecord | null> {
  const existing = loadUserKeys(userId);
  if (existing) return existing;

  if (typeof window === "undefined" || typeof crypto === "undefined" || !crypto.subtle) {
    return null;
  }

  // ECDSA P-256 keypair
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"]
  );

  const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  const pubB64 = bufToBase64(spki);
  const privB64 = bufToBase64(pkcs8);

  const fingerprintFull = await sha256Hex(new Uint8Array(spki));
  const fingerprint = fingerprintFull.slice(0, 16);

  const record: UserKeypairRecord = {
    publicKey: pubB64,
    privateKey: privB64,
    fingerprint,
  };

  saveUserKeys(userId, record);
  return record;
}

