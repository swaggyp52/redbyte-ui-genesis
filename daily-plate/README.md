# Daily Plate

Log what you had. See where you stand. Get on with your day.

A private, family-hosted food journal for one person: three screens (Today, Add Food, My Foods), her own Rest/Training targets, honest nutrition (unknown is never zero), one-tap familiar foods, USDA search and barcode lookup, and an offline-tolerant Home Screen web app whose records live on a Raspberry Pi.

- Contract: `SPEC.md` · Gates: `TASKS.md` · Proof: `TEST_EVIDENCE.md`
- Decisions: `DECISIONS.md` · Sources: `DATA_SOURCES.md` · Ops: `OPERATIONS.md` · Security: `SECURITY.md`

## Layout
```
apps/web        React + Vite PWA (Dexie outbox, service worker, passkeys, scanner)
apps/server     Fastify + better-sqlite3 (mutations, receipts, change feed, providers, backups, CLI)
packages/domain exact decimals, nutrient statuses, goals, portions, phrase parser, recipes, suggestions
packages/contracts zod schemas shared by both sides
fixtures        provider-shaped and synthetic test data (never seeded)
ops             Dockerfile support, Compose + Tailscale sidecar, backup/preflight/smoke scripts
```

## Develop (Node 24.21.0, pnpm 10.24.0)
```bash
pnpm install
pnpm verify                                  # typecheck, unit + integration tests, builds
pnpm --filter @daily-plate/web run test:e2e  # Playwright journeys against the built app
pnpm dev                                     # server on 127.0.0.1:8787 (data in apps/server/data)
pnpm dev:web                                 # Vite on :5173, proxies /api
pnpm plate invite --name "Mom"               # first invitation link
```
