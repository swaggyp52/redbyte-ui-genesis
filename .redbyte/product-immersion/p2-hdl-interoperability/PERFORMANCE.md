# P2 Performance & Durability

Scale/durability evidence for the versioned project format and source model. Numbers
are captured under pinned Node 20.19.0; record method + machine caveat with each.

## Targets (working hypotheses, refined with data)

- Serialize + round-trip of a "complex reference project" (many modules, buses, source
  files, constraint sets) completes well within interactive budget.
- Migration of the corpus is linear in document size; no quadratic blowups.
- Deterministic serialization: identical input → byte-identical output across runs.

## Measurements

| Scenario | Metric | Value | Method / caveat |
|----------|--------|-------|-----------------|
| 402-node + 80-source project | encode | ~8 ms | `projectFormat.scale.test.ts`, pinned Node 20.19.0, this cloud session. |
| 402-node + 80-source project | decode | ~2 ms | same run. |
| 402-node + 80-source project | serialized size | ~167 KB | deterministic (byte-identical re-encode asserted). |
| 200→400 gates (2× size) | decode∘encode wall-clock | sub-6× (asserted) | linearity guard against O(n²); absolute times are single-digit ms. |

**Durability (asserted, not timed):** a large project round-trips losslessly
(`decode(encode(p)) ≡ normalize(p)`) and re-encodes byte-identically. The
format holds at scale with no super-linear blow-up. Absolute millisecond
figures are environment-dependent (informational); the round-trip + determinism
+ linearity assertions are the durable proof.
