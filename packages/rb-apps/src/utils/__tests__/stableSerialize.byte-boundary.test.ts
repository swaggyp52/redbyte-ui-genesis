// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { hashBytes } from '../stableSerialize';

describe('WebCrypto ArrayBuffer realm boundary', () => {
  it('hashes the exact bytes of a browser-realm buffer through native WebCrypto', async () => {
    const buffer = new window.ArrayBuffer(3);
    new Uint8Array(buffer).set([97,98,99]);
    await expect(hashBytes(buffer)).resolves.toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect([...new Uint8Array(buffer)]).toEqual([97,98,99]);
  });
});
