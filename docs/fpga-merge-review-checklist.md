# FPGA Merge Review Checklist

**For use by planning/orchestration agents before accepting sub-agent work.**

---

## Pre-Merge Gate: Architecture Integrity

- [ ] **Layer boundaries respected?** — Toolchain does not touch hardware. Bridge does not build HDL. Board models remain immutable.
- [ ] **No mixing of concerns?** — Build-time code in toolchain only. Runtime code in bridge only. No cross-contamination.

---

## Pre-Merge Gate: Determinism

- [ ] **No wall-clock dependencies?** — Timestamps only from hardware or deterministic sources. No `Date.now()` or equivalent.
- [ ] **Ordered output?** — JSON is sorted. Hashes are stable. Artifacts are byte-identical given same inputs.
- [ ] **Platform-independent?** — Works identically on Windows, Linux, CI. No OS-specific behavior unless explicitly required.

---

## Pre-Merge Gate: Honesty & Error Handling

- [ ] **Failures are explicit?** — Returns "running_no_data", not fabricated samples. Error codes are actionable.
- [ ] **No silent failures?** — Missing hardware is reported. Protocol errors are logged. Pinmap mismatches fail early.
- [ ] **Hardware failures surfaced?** — No masking of JTAG errors, UART failures, or device disconnections.

---

## Pre-Merge Gate: Contracts & Protocols

- [ ] **Existing endpoints preserved?** — `/devices`, `/program`, `/run`, `/stream`, `/stop` still work as documented.
- [ ] **Protocol additions are additive?** — New fields added, old fields not repurposed. Version gating where needed.
- [ ] **Interface enforcement?** — Student HDL interface checked. Pinmap hashes validated. Wrapper contracts enforced.

---

## Pre-Merge Gate: Testing & Validation

- [ ] **Tests added?** — New functionality has corresponding tests. Existing tests still pass.
- [ ] **CI-safe?** — All tests pass without hardware present (when applicable).
- [ ] **Smoke tests updated?** — If protocol or format changed, smoke fixtures updated accordingly.

---

## Pre-Merge Gate: Documentation

- [ ] **Reasoning explained?** — Agent provided clear justification for changes.
- [ ] **Files cited?** — Relevant code locations referenced.
- [ ] **Acceptance criteria met?** — Explicit criteria provided and verified.

---

## Post-Merge: Change Log

- [ ] **AI_STATE.md updated?** — Factual Change Log entry added for meaningful changes.
- [ ] **Constitution alignment verified?** — Changes align with [07-fpga-laboratory-constitution.md](../00-canon/07-fpga-laboratory-constitution.md).

---

## Red Flags (Block Merge)

If any of these are present, **block the merge** and request fixes:

- ❌ Mixing toolchain and bridge code
- ❌ Adding nondeterministic behavior
- ❌ Masking or fabricating hardware data
- ❌ Breaking existing bridge endpoints
- ❌ Changing protocol semantics without versioning
- ❌ Removing tests or validation
- ❌ No explanation for architectural changes

---

## Green Flags (Approve Merge)

These indicate safe, high-quality work:

- ✅ Narrow, focused scope
- ✅ Tests added/updated
- ✅ Documentation updated
- ✅ Backwards compatibility preserved
- ✅ Explicit error handling
- ✅ Deterministic behavior verified

---

## When Uncertain

**If you cannot verify a requirement:**

1. Request clarification from the sub-agent
2. Ask for additional test coverage
3. Request a manual review by maintainer
4. **Do not merge** until requirements are met

---

**Remember:** RedByte is allowed to be strict. It is **not allowed to be wrong**.