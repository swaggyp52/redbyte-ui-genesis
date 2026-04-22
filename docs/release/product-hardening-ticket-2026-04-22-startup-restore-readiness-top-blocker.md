# Product Hardening Ticket — Startup restore / readiness / first-screen truth (Phase 2)

## Ticket

- **Title:** False `RB_APPS_REGISTER_TIMEOUT` on every healthy IDE boot (readiness lie)
- **Date:** 2026-04-22
- **Owner:** Connor Angiel
- **Surface:** IDE bootstrap / shell readiness signals
- **Journey segment:** Cold start, persisted restore, classroom observability
- **Mode:** IDE (`apps/playground` → `ide-bootstrap.ts`)
- **Environment:** Browser (Chromium / Playwright); local `vite preview` of production build
- **Linked GitHub issue:** (none)

## Problem

- **Observed behavior:** After **RB_APPS_REGISTERED (IDE)** logs (registration completes in &lt;1 ms today because `registerAllApps` is a compatibility no-op), the console still emits **`[RB_BOOT] RB_APPS_REGISTER_TIMEOUT (IDE) { ms: 5000 }`** exactly **5 seconds** later on **every** load. Prior hardening notes treated this as a possible real stall; it is **not** tied to actual registration completion.
- **Expected behavior:** Timeout warning should fire **only** if `registerAllApps()` has **not** settled (resolve/reject) within the watchdog window.
- **Why this matters:** Students, TAs, and telemetry grep `RB_APPS_REGISTER_TIMEOUT` as a **startup/readiness** signal. A **100% false-positive** trains everyone to ignore real failures and erodes trust in all boot logs.
- **Severity:** **SEV-1** for startup truth / observability (not a crash, but a systematic lie)

## Reproduction

1. `pnpm --filter @redbyte/playground build`
2. `pnpm --filter @redbyte/playground exec vite preview --host 127.0.0.1 --port <port> --strictPort`
3. Open IDE base (e.g. `http://127.0.0.1:<port>/os/`)
4. Open DevTools console; wait **≥6 s**
5. **Before fix:** See both `RB_APPS_REGISTERED` and later `RB_APPS_REGISTER_TIMEOUT`
6. **After fix:** See `RB_APPS_REGISTERED`; **no** timeout if registration settled

## Browser repro matrix (Phase 2)

Playwright + `vite preview` production build, **6.5 s** post-load console capture (post-fix commit in this slice).

| Case | URL | Storage | First visible workspace | Shell title (`ide-project-name`) | Mode crumb | `RB_APPS_REGISTERED` | `RB_APPS_REGISTER_TIMEOUT` |
|------|-----|---------|-------------------------|----------------------------------|------------|----------------------|------------------------------|
| A — Fresh | `…/os/?mode=project` | Onboarding flag only | Project (`ide-mode-project`) | Untitled Project | Project | Yes | **No** |
| B — Persisted custom | `…/os/` | Session + snapshot (`Phase2 Custom Session`) | Project | Phase2 Custom Session | Project | Yes | **No** |
| C — Starter-leaning | `…/os/` | `activeExampleId: signal-tour`, example kind | Project | Starter Named | Project | Yes | **No** |
| D — Edited custom | `…/os/` | Custom title + vectors in rbproj | Project | Edited Custom Title | Project | Yes | **No** |

**Pre-fix behavior (code + prior artifacts):** `setTimeout` for the timeout log was never cleared, so **`RB_APPS_REGISTER_TIMEOUT` appeared ~5 s after every boot** even when `RB_APPS_REGISTERED` had already run — a **false readiness signal**.

**Observed during matrix (not fixed in this slice):** Session meta requested `currentMode: design` for C/D, but first paint was **Project** in all four runs — possible restore/mode authority follow-up (see risk register in ship report).

## Evidence

- **Root cause:** `setTimeout(..., 5000)` for the timeout log was **never cleared** when `registerAllApps().then(...)` ran.
- **Code:** `apps/playground/src/boot/ide-bootstrap.ts`

## Acceptance proof

- Console: **no** `RB_APPS_REGISTER_TIMEOUT` after successful registration when waiting ≥6 s
- If `registerAllApps` is later made async/heavy, timeout should still only fire when promise has not settled
- `pnpm --filter @redbyte/playground build` + `pnpm build:unified` pass

## Disposition

- **Status:** fixed (pending merge — this ticket)
- **Fix PR / commit:** Clear watchdog on `registerAllApps` resolve/reject

## Attribution

Connor Angiel
