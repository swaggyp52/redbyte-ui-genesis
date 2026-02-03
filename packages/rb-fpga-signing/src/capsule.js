import { bytesToHex } from "./hex.js";
export function normalizeCapsulePath(inputPath) {
    let normalized = inputPath.replace(/\\/g, "/");
    while (normalized.startsWith("/")) {
        normalized = normalized.slice(1);
    }
    if (normalized.startsWith("./")) {
        normalized = normalized.slice(2);
    }
    return normalized;
}
async function sha256Hex(bytes) {
    if (!globalThis.crypto?.subtle) {
        throw new Error("WebCrypto unavailable for SHA-256.");
    }
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return bytesToHex(new Uint8Array(digest));
}
export async function buildCapsule(inputs) {
    const normalized = inputs.map((input) => ({
        path: normalizeCapsulePath(input.path),
        bytes: input.bytes,
    }));
    const files = [];
    for (const entry of normalized) {
        const hash = await sha256Hex(entry.bytes);
        files.push({ path: entry.path, hash });
    }
    files.sort((a, b) => a.path.localeCompare(b.path));
    const capsule = {
        algo: "sha256",
        files,
    };
    const json = JSON.stringify(capsule);
    const capsuleJsonUtf8 = new TextEncoder().encode(json);
    return { capsule, capsuleJsonUtf8 };
}
