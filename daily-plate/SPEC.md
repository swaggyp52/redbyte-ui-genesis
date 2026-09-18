# Daily Plate — Research, product design, and finite implementation contract

> Copied into the project as the frozen contract (handoff dated September 18, 2026).
> This file is the finish line. `TASKS.md` tracks the seven gates against it;
> `TEST_EVIDENCE.md` records what was actually proven.

Working name: **Daily Plate** (frozen for v1; not a trademark-clearance claim).
Primary user: the requester's mother, an iPhone user who wants easy daily food logging.
Owner/operator: the requester, using the existing Marcus Raspberry Pi.
Release boundary: one polished, trustworthy, personal nutrition journal. Not a health platform, generalized AI agent, or commercial SaaS.

## 1. The decision

Build a personal food journal whose central interaction is "that is what I had", not "fill out this nutrition form." It remembers familiar foods, portions, and meal combinations, makes unfamiliar food straightforward to find, and shows the day's protein, carbohydrates, fat, fiber, and sugar without a complicated dashboard.

The sophistication belongs in reliable nutrition normalization, meal memory, portions, understandable previews, and loss-resistant synchronization. The daily interface stays three predictable places: **Today**, **Add Food**, **My Foods**.

Serve the application and its authoritative database from the existing Raspberry Pi, independently of Marcus and other services. For an ordinary link that works without the mother installing Tailscale, the recommended release architecture is an app-specific Tailscale Funnel endpoint protected by application authentication. Stage privately first; public exposure is a separately approved release action.

No paid runtime LLM, cloud nutrition-photo analysis, hosted diary database, or background AI agent.

Success: she opens the Home Screen icon, logs something familiar in roughly ten seconds or less, understands what remains against her own goals, corrects mistakes herself, and finds the same correct history tomorrow. These are acceptance targets to test, not measured results.

## 2. What the user actually asked for

| Requirement | Implementation consequence |
|---|---|
| Track essentially everything eaten or drunk | Foods, drinks, snacks, custom items, combined meals, recipes use the same diary |
| Track protein, carbs, fiber, sugar, related nutrients | Protein, total carbohydrates, fat, fiber, total sugars are first-class |
| Enter an item and obtain its nutrients | Search, barcode lookup, saved items, clear serving selection |
| Example shake: 30 g protein, 5 g fiber, 15 g carbs | Incomplete nutrition; fat and sugar remain unknown until provided |
| Example: two Samuel Adams Octoberfest drinks | Product, container size, quantity distinguishable; missing sugar must not become zero |
| Rest-day goals | Protein 140 g; carbohydrates 130 g; fat 45 g |
| Training-day goals | Protein 145 g; carbohydrates 165 g; fat 40 g |
| Cal AI is okay, input should be easier | Optimize repeated real-life tasks |
| Older, nontechnical user | Large legible controls, consistent layout, clear language, no hidden gestures |
| A link that becomes a Home Screen app | HTTPS PWA, onboarding, persistent sign-in, actual iPhone installation testing |
| Data and serving on the Pi | Pi database authoritative; no hosted backend |
| A finite project | Frozen contract, ordered gates, objective evidence, explicit stop |

Interpretation to confirm: "145 g protein; 165 g and 40 g fats" — 165 g is taken as carbohydrates. Display once during setup and ask her to confirm.

No fiber target, sugar target, calorie goal, target weight, diagnosis, allergies, training schedule, or exact usual brands were supplied. Do not invent them. Track fiber and sugar without default targets. Do not infer a calorie prescription.

Evidence boundary: no live Pi inspection occurred during planning (Swaggy offline). Treat remembered hostnames, ports, paths, memory, and Tailscale configuration as leads to inspect, not facts.

## 3. Research findings that change the design

3.1 Do not compete by adding another input mode; compete on one person's food memory and workflow.
3.2 A private Tailscale link is not a public app link; Funnel is beta with restrictions; use a separate application endpoint with application login.
3.3 The PWA experience is feasible but must be tested on the actual phone; defer push notifications.
3.4 An online database does not guarantee a complete label; every nutrient needs a source, basis, and missing-data state.
3.5 Accessibility determines layout: 48–56 px targets, ~18 px body text, 4.5:1 contrast, reflow at enlarged text.

## 4. The experience: rich underneath, calm on the surface

4.1 Visual direction: warm off-white background (#FAF7F0), dark ink (#24332F), deep teal primary action (#176A5B), restrained coral (#D67B5D) and gold (#D9AA4B) accents, original plate motif, system sans-serif ~18 px body, 28–34 px totals with tabular numerals, ≥48 px actions (52–56 primary), two radii, brief motion honoring reduced motion, icons with words. No glassmorphism, pastel text, pills everywhere, tiny legends, concentric rings, ornamental charts, theme switching.

4.2 Information architecture: Today (date, history control, Training/Rest, three macro rows with consumed and remaining, visible fiber/sugar, up to three pinned shortcuts with explicit portions, entries grouped by meal, correction sheet). Add Food (one large search field, recent foods, Scan Barcode, Custom Food; dictation via the phone keyboard). My Foods (saved foods, meals, recipes; secondary settings area). History via the date. Distinguish "nothing recorded" from "zero eaten".

4.3 First use: no fitness questionnaire. Connect the device, confirm the two presets, choose today's type, see Today. Pinning and weekly schedule skippable. Short install guidance.

## 5. The six high-value behaviors

5.1 Familiar food in one deliberate tap with visible Undo; accidental double-taps during commit must not duplicate; a deliberate later tap is a new serving; pinned meaning stays stable.
5.2 Gentle new-food flow: results show name, brand, preparation, serving basis, source; portion sheet previews the effect; selection alone never logs; provider failure keeps saved foods working and offers custom entry or save-for-later.
5.3 Constrained phrase parser ("2 eggs", "half my shake", "150 g chicken", "2 Sam Adams Octoberfest"); never claims nutrition from the sentence.
5.4 Real meal memory: editable groups; offer "Save this as a meal?" once after the same combination on three separate days; pinned order is user-defined; suggestions live in a separate area.
5.5 "See how this fits" before committing; optional user-invoked "Ideas from my foods" using only saved, allowed foods with complete macros; arithmetic, not advice; never alcohol automatically; provisional when the day is incomplete.
5.6 Easy correction without guilt: edit, move, remove, undo; neutral "8 g above your target"; no shame, streaks, cheat meals.

## 6. Source strategy and food accuracy

6.1 Provider roles: saved foods first; USDA FoodData Central for text search; Open Food Facts for barcode lookup only; user label entry always. Server is the only external caller; send only the term or barcode; cache on the Pi; keys never in the browser; conservative throttling; Retry-After; timeouts; identifying User-Agent.
6.2 Provenance is a data property: provider, record id, fetched date, basis, source serving text, normalization version, raw snapshot reference, field-level user corrections. Badges: "USDA", "Product database", "Your label". Never silently average conflicting sources. A user correction creates a new version and does not rewrite history.
6.3 Unknown is not zero: statuses reported, estimated, unknown, less-than. Known subtotal and upper bound carried separately. Honest copy: "Sugar: 12 g known — 1 item missing sugar"; "Protein: about 82 g"; "Fiber: 9 g plus less than 1 g". Remaining is provisional when incomplete.
6.4 Portion and unit contract: basis is a stated serving, 100 g, or 100 mL; named portions belong to one product version; mass vs fluid ounces distinguished; no grams↔millilitres without density; cooked/raw and drained/undrained preserved; barcodes as strings with leading zeros; no double scaling of per-serving fields; total carbohydrate convention, no silent net carbs, no double-counting sugar; OFF carbohydrate semantics must be established or the record needs label confirmation; source calories kept independent.
6.5 Fixtures: the shake (30/15/5 with fat and sugar unknown → 45/22.5/7.5 at 1.5 servings, still unknown). Octoberfest: verify the real product and container first; synthetic test data must be visibly synthetic.
6.6 Recipes vs saved meals: a meal groups editable foods; a recipe divides ingredient totals by a declared yield; editing creates a new version; earlier portions stay attached to the old version.
6.7 Licensing: keep USDA (CC0) and OFF (ODbL) attribution; caches logically separate; no redistribution; no images in v1; never upload her corrections.

## 7. Technical architecture: deliberately small

Frontend React + TypeScript + Vite; project-owned CSS tokens; Fastify + TypeScript single process; Node 24 LTS pinned; SQLite via better-sqlite3 with the bundled engine verified (≥ 3.51.3); Zod shared schemas; Dexie/IndexedDB; small explicit Workbox-based service worker; ZXing browser scanning with manual fallback; SimpleWebAuthn passkeys with invite bootstrap and server sessions; Vitest, real SQLite integration tests, Playwright, axe, physical iPhone checks; ARM64-compatible image, Compose app plus isolated Tailscale sidecar. No Redis, Postgres, vector DB, queues, Kubernetes, LLM.

Core records: user, goal template version, daily goal snapshot, food, immutable food version, portion, recipe version, saved meal, diary entry with snapshot and revision, mutation receipt, change feed, session/passkey, provider cache. Exact decimals; no zero defaults; history preserved.

API: invite redeem, passkey register/login options+verify, logout, bootstrap, changes?cursor, mutations, foods/search, foods/barcode/:barcode, days/:localDate, export, healthz. One mutation envelope with schema version, mutation UUID, entity UUID, type, base revision, payload; ownership from the session; receipts with revision, sequence, committed time; 409 conflicts with current version; per-mutation results.

## 8. Offline behavior and truthful saving

Pi-owned records plus a bounded private phone cache/outbox (30 days, all saved personal items, every pending mutation). Lifecycle: validate → one IndexedDB transaction storing projection and mutation → only then show the entry as "On this phone — waiting to save" → send when authenticated and online → one SQLite transaction validating ownership/revision, idempotency key and digest, entry, change feed, receipt → client reconciles and shows saved. Same id + same payload returns the same receipt; same id + different payload is an error; a real second serving is a new id. Monotonic cursor with tombstones; base revisions for conflicts with a simple "changed elsewhere" choice; receipts retained for the account lifetime. Retry on open, resume, online, and a visible action; bounded backoff; camera stops on close/background; expired sessions keep pending work; no shared HTTP caching of API responses; logout explains pending work; updates never force reload. Store UTC time plus chosen local date and IANA time zone; "Yesterday" action; schedule supplies defaults, explicit override wins; a missing day is not a zero day.

## 9. Access, privacy, and hosting

Dedicated app container and separate Tailscale sidecar with its own identity; app listens on loopback in the sidecar's namespace; no host ports, Docker socket, broad mounts, privileged containers, or reuse of Marcus secrets; no global serve/funnel resets on the host; capture and diff existing configuration; least-privilege tailnet policy delta; measure container reachability. Owner-issued one-use high-entropy invite (~30 min, hashed, POST-only redeem, fragment delivery, removed from the URL). Passkeys with bound challenges, origin/RP checks, replay rejection. Server sessions: Secure, HttpOnly, SameSite, 30 days idle / 90 days absolute, revocation. No public registration or guessable PIN. Recovery by owner-issued invite. Select the final origin before enrolling real passkeys. Diary stays on the Pi and phone cache; providers get terms/barcodes only; no analytics, fonts, OCR; the Pi's administrator can technically access data — say so. Security checks: ownership on every record, two synthetic users, CSRF/CSP, lengths, rate limits, redaction, host allowlist, escaping, secrets outside git, /healthz reveals nothing. Public exposure needs an explicit release gate.

## 10. Persistence, backup, and operations

WAL with synchronous=FULL, foreign keys, busy handling; verify `select sqlite_version()` from the bundled engine (≥ 3.51.3). Online backup API snapshots; 7 daily + 4 weekly + pre-migration; restore into a scratch directory and verify; HARDWARE_FAILURE_BACKUP=UNPROTECTED until an approved independent destination exists. Safe releases: correct-architecture image, pinned versions, last-known-good retained, preflight checks, additive migrations, smoke test, rollback preserves new diary data. Budgets: ≤ 350 MB app+sidecar (512 MB cap), idle CPU < 1%, ≤ 250 KB gzip initial JS before lazy scanner, warm launch ≤ 2 s, cached search ~100 ms, local API p95 ≤ 500 ms, favorite logged ≤ 10 s, new food ≤ 30 s, provider timeout ~5 s.

## 11. Adaptive logic without an AI dependency

Retrieval order: pinned exact, aliases, recent exact, local candidates, external. Context suggestions from recency/frequency/meal context, max three, dismissable. Pinned quantity fixed; last deliberate portion proposed visibly. Macro-fit ideas over 0.5/1/1.5 multiples, reject missing nutrients, equal macro weighting, overshoot penalized, numbers shown, provisional when incomplete. Never infer restrictions, change targets, or switch day types automatically.

## 12. Finite execution plan

Gate 0 establish environment and freeze decisions; Gate 1 smallest real end-to-end path; Gate 2 trustworthy acquisition and portions; Gate 3 distinctive daily experience; Gate 4 installation, access, offline recovery; Gate 5 harden and stage privately; Gate 6 approve public access, validate with the mother, close. PASS / FAIL / BLOCKED for every gate with exact reason, evidence, and next executable action.

## 13. Release acceptance matrix

N01 presets; N02 shake at 1.5; N03 two containers; N04 zero vs missing vs less-than; N05 per-serving vs per-100; N06 mass vs volume, cooked vs raw; N07 carbs/sugar semantics; N08 label update keeps past entries; N09 recipe versions; N10 precision; N11 incomplete totals. U01 pinned favorite; U02 double-tap vs second serving; U03 search ambiguity; U04 camera denied; U05 edit/remove/move/undo; U06 training override; U07 larger text/VoiceOver; U08 keyboard/safe areas; U09 unknown item. O01 offline add then reopen; O02 lost response then retry; O03 server unavailable; O04 offline conflicts; O05 day boundary; O06 logout/expiry; O07 update with pending queue; O08 storage quota. P01 provider failures; P02 attribution/normalization fixtures. S01 unauthenticated; S02 second user; S03 invite preview/replay/challenges; S04 CSRF/injection/proxy; S05 logs/bundles. D01 architecture; D02 restart; D03 backup/restore; D04 release/rollback; D05 existing projects; D06 public cellular access; D07 physical iPhone; D08 resource budget.

Mother acceptance script: open and find protein; log the shake and change its portion; find an unfamiliar food; log two sized drinks and see whether sugar is known; switch Rest/Training; correct a mistake and find yesterday; log a saved item during an outage and understand the pending state. One consolidated usability-polish pass after observation.

## 14. Explicit non-goals

Photo-to-macros, OCR, voice assistant, LLM chat, coaching; weight, body measurements, prescriptions, exercise calories, allergy guarantees; groceries, pantry, delivery, scraping, social; Apple Health, wearables, calendar, widgets, push; multi-family SaaS, payments, public registration, admin UI, Marcus redesign; Cal AI import; public database redistribution or thousands of seed foods.

## 15. Cost, maintenance, and the stop condition

No paid nutrition subscription or runtime AI. Depends on home internet/power/hardware, Tailscale, and external food APIs. Ongoing: security updates, restore checks, backup protection, adapter maintenance. Owner involvement: credentials, public-exposure boundary, the mother's one-time check. Stop v1 when the journeys work, arithmetic is tested, access is protected, offline entries reconcile, the PWA installs and reopens, the Pi deployment is isolated and recoverable, and the mother can perform core tasks without a lesson.

## 16. Required final delivery

Real URL, release commit/tag, build identity; installation card and recovery path; gate checklist with BLOCKED separated from PASS; runbook and backup-protection status; before/after evidence for neighbouring Pi projects; screenshots of the mobile build and the mother's acceptance results. Never claim an unperformed check.

## 17. Research register (S01–S25)

Cal AI, Cronometer, MacroFactor sites; Tailscale Funnel, Serve, Docker params; Apple Home Screen guide; WebKit push and storage policy; USDA FDC API guide; Open Food Facts API intro, nutrition data, barcode normalization, licence; FDA label guidance; W3C older users, WCAG 2.2 target size (enhanced) and contrast (minimum); Node release table; SQLite WAL and backup API; ZXing browser; SimpleWebAuthn server; MDN Background Sync; OWASP session management. All checked September 18, 2026; recheck at implementation.

Final principle: make the user's routine shorter, while making the system's claims more precise.
