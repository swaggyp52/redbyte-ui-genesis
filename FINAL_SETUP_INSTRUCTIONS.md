# NEXT STEPS: Enable Branch Protection

## Current State
The enforcement system is **built and tested**, but not yet blocking merges.

The CI pipeline runs automatically:
- ✅ Lint tripwire (detects object/array selectors)
- ✅ Smoke tests (detects React #185)
- ✅ Unit tests (ensures no regressions)

**But** none of it blocks merges without GitHub branch protection configured.

---

## What You Need to Do (5 minutes)

### 1. Go to GitHub Repo Settings
```
https://github.com/<owner>/redbyte-ui
```

### 2. Navigate to Branch Protection
```
Settings → Branches → Add rule
```

### 3. Create Rule for `main` Branch

**Rule settings:**
```yaml
Branch name pattern: main

Require:
  ✅ Status checks to pass before merging
  ✅ Branches to be up to date before merging
  ✅ Require code reviews: 1 approval (optional)
  
Require status checks:
  ☐ Require branches to be up to date
  ☐ Require code reviews
  ✅ Require status checks to pass before merging
     └─ Select: "Test Suite (Zero Warnings)"
```

### 4. Save

---

## What Happens After

### Developer creates PR with unsafe selector:

```typescript
// packages/rb-apps/src/components/OscilloscopeView.tsx
const { probes, addProbe } = useProbeStore((s) => ({
  probes: s.probes,
  addProbe: s.addProbe,  // ← unsafe: new object every render
}));
```

### CI runs automatically:
```
Test Suite (Zero Warnings)
├─ Install dependencies ✅
├─ Install ripgrep ✅
├─ Install Playwright browsers ✅
├─ Selector tripwire 🛑 FAILED
│  └─ "Found potentially unstable Zustand object-literal selectors"
└─ [blocked: cannot proceed]
```

### PR shows:
```
Merge blocked: Status check "Test Suite (Zero Warnings)" failed
```

### Developer sees:
```
⚠️  Found potentially unstable Zustand object-literal selectors:

  packages/rb-apps/src/components/OscilloscopeView.tsx:15:5

Fix: replace grouped object selectors with per-field selectors.
See docs/zustand-selectors.md for the pattern and Rule 1.
```

### Developer fixes:
```typescript
// FIXED: per-field selectors
const probes = useProbeStore((s) => s.probes);
const addProbe = useProbeStore((s) => s.addProbe);
```

### CI re-runs:
```
Test Suite (Zero Warnings)
├─ Install dependencies ✅
├─ Install ripgrep ✅
├─ Install Playwright browsers ✅
├─ Selector tripwire ✅ PASSED (no matches found)
├─ Smoke tests ✅ PASSED (3/3)
├─ Run tests ✅ PASSED (705/705)
├─ Typecheck ✅ PASSED
└─ Lint ✅ PASSED
```

### PR can now merge:
```
✅ All status checks passed
✅ Approved by code reviewer
→ Merge button is active
```

---

## Enforcement Complete

Once branch protection is enabled, the system enforces:

| Violation | Blocked | Evidence |
|-----------|---------|----------|
| Object selectors | ✅ Yes | PATTERN1, PATTERN2 |
| Array selectors | ✅ Yes | PATTERN3, PATTERN4 |
| Spread operators | ✅ Yes | PATTERN5 |
| React #185 errors | ✅ Yes | Smoke test |
| Missing ripgrep | ✅ Yes | Exit code 2 |

---

## Documentation Available

For developers unfamiliar with the system:

- **Quick reference**: [docs/zustand-selectors.md](docs/zustand-selectors.md)
- **Full guide**: [ENFORCEMENT_COMPLETE.md](ENFORCEMENT_COMPLETE.md)
- **Test results**: [ENFORCEMENT_FINAL_VERIFICATION.md](ENFORCEMENT_FINAL_VERIFICATION.md)
- **Holes closed**: [HOLES_CLOSED.md](HOLES_CLOSED.md)

---

## That's It

Once you enable branch protection, **the enforcement system is live and working.**

No manual verification needed. No more "click the UI and hope." Just CI gates that block bad patterns.

---

## Questions?

If a PR gets blocked:
1. Check the error message (explains which file/line)
2. See [docs/zustand-selectors.md](docs/zustand-selectors.md) for the fix pattern
3. Replace with per-field selectors
4. Push again

Done.
