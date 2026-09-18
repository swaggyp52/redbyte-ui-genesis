# TEST_EVIDENCE

Environment for every row: Anthropic cloud sandbox, Linux x86_64, Node v24.21.0, pnpm 10.24.0, Chromium 1194 via Playwright 1.56.0. Date 2026-09-18. Commit: see the PR head (each row reproduced at the final commit unless noted). Nothing below was run on a Raspberry Pi or a physical iPhone.

## Commands and results

| # | Command (from `daily-plate/`) | Result |
|---|---|---|
| E1 | `pnpm verify` (build packages → typecheck all → build server → `pnpm test` → build web) | domain 42/42, contracts 5/5, server 41/41, web 7/7; typecheck clean; web build 161 KB gzip main chunk, 117 KB gzip lazy scanner chunk; 29 s |
| E2 | `pnpm --filter @daily-plate/web run test:e2e` (real server serving the built app, iPhone-14 viewport Chromium) | 10/10 journeys passed; screenshots in `docs/screens/01..14` |
| E3 | Real process: `node dist/cli.js version`, `invite`, `node dist/main.js`, curl redeem → bootstrap, `cli.js backup` | sqlite 3.53.4 ≥ 3.51.3; invite redeemed over HTTP; presets 140/130/45 and 145/165/40 returned; backup verify `ok: true` |
| E4 | `pnpm --filter @daily-plate/server --prod deploy --legacy <dir>` then run it with `DP_WEB_DIST` | 106 packages, 66 MB; healthz 200, `/` 200, `sw.js` 200 with `cache-control: no-cache`, manifest 200, `/foods` SPA fallback 200, anonymous `/api/v1/bootstrap` 401, CSP header present |
| E5 | `pnpm audit --prod` | No known vulnerabilities found |
| E6 | `grep -rlE "tskey-\|DP_USDA_API_KEY\|api_key=" apps/web/dist/assets/` | no matches |
| E7 | `docker info` | daemon unavailable → image build **BLOCKED** here |
| E8 | `curl https://api.nal.usda.gov/... ` and `https://world.openfoodfacts.org/...` | egress denied (CONNECT 403) → live provider checks **BLOCKED** here |

## Acceptance matrix

| ID | Scenario | Status | Where |
|---|---|---|---|
| N01 | Rest / training preset; 165 g confirmed at setup | PASS | `goals.test.ts`, `core.test.ts` N01, e2e step 1 (setup shows the interpretation, values editable) |
| N02 | Shake at 1.5 servings → 45/22.5/7.5, fat and sugar unknown | PASS | `nutrients.test.ts`, `core.test.ts` N02 (server-materialized snapshot, survives restart), e2e step 2 (preview text and Today rows) |
| N03 | Two confirmed containers; unknown sugar retained | PASS (synthetic) | `quantities.test.ts`, `providers.test.ts` N03 — real product **not verified** |
| N04 | Zero vs missing vs less-than | PASS | `nutrients.test.ts`, `display.test.ts`, contracts reject less-than 0 |
| N05 | Per-serving vs per-100 basis | PASS | `quantities.test.ts`, `providers.test.ts` (USDA per-100 g/ml, OFF per-serving) |
| N06 | Mass vs volume; cooked vs raw | PASS | `quantities.test.ts` density-required errors; preparation preserved from USDA descriptions |
| N07 | Total carbs / sugar semantics | PASS | `providers.test.ts` (bare OFF carbs → estimate + label confirmation; fiber never added; sugar never added into carbs) |
| N08 | Label update leaves the past entry unchanged | PASS | `core.test.ts` N08 |
| N09 | Recipe yield change creates a new version | PASS | `recipes.test.ts`, `core.test.ts` recipe test |
| N10 | Precision and rounding | PASS | `decimal.test.ts` (no accumulated error over 100 additions; rounding at display only) |
| N11 | Daily totals missing a nutrient are provisional | PASS | `nutrients.test.ts`, `goals.test.ts`, e2e "1 item missing fat" + provisional note |
| U01 | Pinned favorite: one deliberate add, explicit portion, acknowledgement, Undo | PASS | e2e step 5 |
| U02 | Accidental double-tap vs real second serving | PASS | e2e step 5 (dblclick adds once; later tap adds again) |
| U03 | Search ambiguity → choice, not a hidden guess | PASS | e2e step 6 (phrase → amount prefilled, sheet before add); `search.ts` ranking test |
| U04 | Camera denied / no match | PARTIAL | manual digits path implemented and wired; not-found/unavailable banners tested at the API level; camera denial UI not exercised in e2e |
| U05 | Edit / remove / move / Undo without duplicates | PASS | `core.test.ts` U05, e2e step 3 |
| U06 | Training override affects the selected day only; default change keeps history | PASS | `core.test.ts` U06, e2e step 4 |
| U07 | Larger text / narrow width / VoiceOver | PARTIAL | axe WCAG 2.2 AA scans on setup, Today, portion sheet, food detail, My Foods, Settings, Add Food: no serious/critical violations; no horizontal overflow at 390 px; VoiceOver and Dynamic Type **BLOCKED** (physical device) |
| U08 | Keyboard and safe areas | PARTIAL | safe-area insets and scrolling sheets implemented; iOS keyboard behaviour **BLOCKED** |
| U09 | Unknown item captured as a draft and resolved later | PASS | `core.test.ts` U09, e2e step 6 |
| O01 | Offline add, close, reopen | PASS | `sync.test.ts` O01 (real server via inject), e2e step 7 (context offline → page closed → reopened → reconciled, 4 entries not 5) |
| O02 | Lost server response then retry → one entry, same receipt | PASS | `core.test.ts` O02, `sync.test.ts` O02 |
| O03 | Server unavailable → no false acknowledgement | PASS | `sync.test.ts` (state offline, entry pending), e2e "On this phone — waiting to save" |
| O04 | Offline edits/deletes and conflicts | PASS | `sync.test.ts` conflict tests (attention item; keep mine / keep the Pi's) |
| O05 | Day boundary / timezone / DST | PASS | `dates.test.ts`; entries store local date + IANA zone |
| O06 | Logout / expired / revoked session | PASS | `auth.test.ts`, `sync.test.ts` (pending kept, other account refused), e2e step 10 (pending work survives lock and syncs after unlock) |
| O07 | App update with pending queue | PARTIAL | outbox in IndexedDB survives reload (e2e reload step); update banner never forces reload; stale-PWA-vs-new-server **BLOCKED** (needs two builds on a device) |
| O08 | Storage quota failure | PARTIAL | persistence requested and reported honestly in Settings; a write failure surfaces as an error toast; quota exhaustion not simulated |
| P01 | Provider timeout / 429 / schema mismatch | PASS | `providers.test.ts` (timeout, 429 Retry-After, malformed hits, ECONNRESET → unavailable, local foods still work) |
| P02 | Source attribution / normalization fixtures | PARTIAL | adapters tested against documented-shape fixtures; **live capture BLOCKED** |
| S01 | Unauthenticated requests | PASS | `auth.test.ts` |
| S02 | Synthetic second user | PASS | `core.test.ts` S02 |
| S03 | Invite preview / replay / passkey challenges | PASS | `auth.test.ts`, e2e step 1 (peek after redeem invalid) |
| S04 | CSRF / text injection / arbitrary URL | PASS | `core.test.ts` CSRF, `providers.test.ts` allow-list; React escapes rendered names |
| S05 | Logs / bundle / images | PASS | E5, E6; log redaction configured |
| D01 | Wrong-architecture build prevention | BLOCKED | Dockerfile builds native modules per platform; not built here |
| D02 | App restart | PASS | `core.test.ts` N02 restart half; `backup.test.ts` |
| D03 | Backup and isolated restore | PASS | `backup.test.ts` (snapshot during WAL, integrity, counts, scratch restore excludes later writes), E3 |
| D04 | Release / rollback | BLOCKED | runbook only |
| D05 | Existing projects unchanged | BLOCKED | preflight/diff scripts only |
| D06 | Public cellular access after approval | BLOCKED | approval not requested; serve.funnel.json prepared |
| D07 | Physical iPhone installation | BLOCKED | virtual-authenticator passkey ceremony passed in Chromium (e2e step 10) |
| D08 | Resource budget | PARTIAL | bundle within budget; Pi memory/CPU **BLOCKED** |

## Honest gaps
- No Pi, no Docker daemon, no provider egress, no physical iPhone, no WebKit in this environment. Everything marked BLOCKED needs the desktop or the Pi.
- The Samuel Adams Octoberfest product was not verified; the app offers the manual label path.
- Screenshots are from Chromium emulating an iPhone 14 viewport, not from Safari.
