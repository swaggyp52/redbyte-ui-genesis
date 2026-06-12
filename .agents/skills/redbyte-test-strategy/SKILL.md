---
name: redbyte-test-strategy
description: Use when choosing or updating RedByte tests, browser gates, golden artifact checks, build validation, or regression proof for a narrow slice.
---

# RedByte Test Strategy

## Test Selection

Use the smallest proof that matches the claim:

- pure logic: Vitest unit or contract test
- surface state: focused React/Vitest test
- viewport and workflow: Playwright gate
- build/deploy artifact: `build:unified`, manifest, and route checks
- docs-only change: `corepack pnpm rb:doc:validate`, `corepack pnpm rb:encoding:check`, and `git diff --check`
- release or broad behavior change: relevant focused gates plus `corepack pnpm verify:gates` when justified

## Golden Policy

- Never re-bless golden hashes because a test failed.
- Reproduce the drift, identify the source-level byte change, and document why the new output is intended.
- Label Node runtime mismatch. `.nvmrc` pins Node `20.19.0`; evidence under another Node version is useful but must be named.

## Browser Gates

- Add failing browser regression first for product behavior bugs.
- For visual bugs, assert the stable geometry or visibility contract, not pixel taste.
- Screenshots can accompany gates but do not replace assertions.

## Package Manager

Use `corepack pnpm ...` on this Windows clone. Do not run `npm install`.
