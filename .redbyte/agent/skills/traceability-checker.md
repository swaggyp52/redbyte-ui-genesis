# Traceability Checker

Purpose: force every product claim or fix to connect to docs, code, tests, gates, and evidence level.

Rules:

- No public product claim should exceed the evidence level that supports it.
- Draft Export and Trusted Export must remain distinct.
- Map Pins does not replace Verify proof.
- Generated agent/memory outputs are evidence candidates, not canonical docs.
- Obsidian memory never overrides current repo truth.

Check:

- Claim statement.
- Current truth or target contract source.
- Likely code owner files.
- Tests/gates proving the claim.
- Missing tests or manual evidence.
- Stale-memory risks.

Use:

- `pnpm rb:control:trace-claims`
- `pnpm rb:memory:trace -- "claim"`
- `pnpm rb:problem:trace`
