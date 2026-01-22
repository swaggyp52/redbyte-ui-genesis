import { canonicalizeEvidence, hashEvidence } from '../utils/evidenceExport';

describe('Evidence Export - Determinism', () => {
  it('canonicalizes objects with shuffled keys to the same JSON', () => {
    const a = { foo: 1, bar: 2, baz: [3, 2, 1] };
    const b = { baz: [3, 2, 1], foo: 1, bar: 2 };
    const canonA = canonicalizeEvidence(a as any);
    const canonB = canonicalizeEvidence(b as any);
    expect(canonA).toBe(canonB);
  });

  it('produces the same hash for the same canonical JSON', () => {
    const obj = { foo: 'bar', arr: [1, 2, 3] };
    const canon = canonicalizeEvidence(obj as any);
    const { hash: hash1 } = hashEvidence(canon);
    const { hash: hash2 } = hashEvidence(canon);
    expect(hash1).toBe(hash2);
  });
});
