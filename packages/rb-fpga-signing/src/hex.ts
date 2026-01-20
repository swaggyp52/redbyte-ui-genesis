export function hexToBytes(hex: string): Uint8Array {
  const trimmed = hex.trim().toLowerCase().replace(/^0x/, "");
  if (trimmed.length === 0 || trimmed.length % 2 !== 0) {
    throw new Error("Invalid hex string length.");
  }
  const out = new Uint8Array(trimmed.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    const byte = trimmed.slice(i * 2, i * 2 + 2);
    const value = Number.parseInt(byte, 16);
    if (Number.isNaN(value)) {
      throw new Error("Invalid hex string.");
    }
    out[i] = value;
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
