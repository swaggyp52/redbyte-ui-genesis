import { etc, sign, verify } from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { concatBytes } from "@noble/hashes/utils";
import { hexToBytes } from "./hex.js";
import { buildCapsule, normalizeCapsulePath } from "./capsule.js";
import { TRUSTED_PUBLIC_KEYS_HEX } from "./trusted-keys.js";
etc.sha512Sync = (...messages) => sha512(concatBytes(...messages));
export async function signCapsule(capsuleJsonUtf8, privateKeyHex) {
    const privateKey = hexToBytes(privateKeyHex);
    return sign(capsuleJsonUtf8, privateKey);
}
export async function verifyCapsule(capsuleJsonUtf8, signature, publicKeyHex) {
    const publicKey = hexToBytes(publicKeyHex);
    return verify(signature, capsuleJsonUtf8, publicKey);
}
export { buildCapsule, normalizeCapsulePath, TRUSTED_PUBLIC_KEYS_HEX };
export { bytesToHex, hexToBytes } from "./hex.js";
