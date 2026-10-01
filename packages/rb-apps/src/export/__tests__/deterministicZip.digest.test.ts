import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../deterministicZip';

const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

describe('deterministic ZIP SHA-256 byte boundary', () => {
  it('hashes only the requested subarray without changing the input', async () => {
    const bytes = new Uint8Array([255, 97, 98, 99, 254]);
    await expect(sha256Hex(bytes.subarray(1, 4))).resolves.toBe(ABC_SHA256);
    expect([...bytes]).toEqual([255, 97, 98, 99, 254]);
  });

  it('accepts shared-buffer input by copying the exact view bytes', async () => {
    const bytes = new Uint8Array(new SharedArrayBuffer(5));
    bytes.set([255, 97, 98, 99, 254]);
    await expect(sha256Hex(bytes.subarray(1, 4))).resolves.toBe(ABC_SHA256);
    expect([...bytes]).toEqual([255, 97, 98, 99, 254]);
  });
});
