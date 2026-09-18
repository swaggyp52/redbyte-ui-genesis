# SECURITY

## Trust boundaries
- **Phone (browser)**: holds a bounded copy of her data in IndexedDB plus the outbox. Never holds API keys. Camera frames stay in the page; only the decoded barcode is sent.
- **Pi application container**: the only place that talks to USDA/OFF; owns the SQLite file (mode 0600, directory 0700). Listens on 127.0.0.1 inside the sidecar's network namespace only.
- **Tailscale sidecar**: connectivity and TLS certificates. Separate identity from Marcus; userspace networking; no capabilities.
- **The Pi administrator** can technically read the database. The app's privacy text says so.

## Authentication and sessions
- Owner-issued invite: 32 random bytes (base64url), SHA-256 hashed at rest, 30-minute lifetime, one use, POST-only redeem, delivered in the URL fragment and stripped from the URL on load and on hash change. `peek` never consumes. Recovery invites bind to an existing account.
- Passkeys via SimpleWebAuthn: challenges stored server-side with a 5-minute expiry, bound to the session for registration, consumed exactly once; expected origin and RP ID checked; login uses discoverable credentials; counters updated.
- Sessions: random 32-byte token hashed at rest; cookie HttpOnly, SameSite=Lax, Secure in production, path `/`; 30 days idle (slides at most hourly) / 90 days absolute; logout revokes; "sign out other devices" revokes all but current; CLI can revoke a user's sessions. A revoked phone keeps its local copy until it reconnects and is refused — stated in the UI.
- No public registration, no PIN, no email dependency.

## Request hardening
- Ownership derived from the session on every route; client-supplied user ids are ignored (tested).
- CSRF: every non-GET `/api/` request must carry `x-daily-plate: 1` and, when an Origin header is present, it must be in `DP_ORIGINS`.
- Helmet CSP: `default-src 'self'`, scripts `'self'`, styles `'self' 'unsafe-inline'`, connect `'self'`, images `'self' data: blob:`, media `blob:`, `frame-ancestors 'none'`, `object-src 'none'`; `Referrer-Policy: no-referrer`; HSTS when secure cookies are on.
- Rate limits: 300/min global; invite peek 20/min, redeem 10/min, passkey routes 10–20/min, search 60/min, barcode 30/min, mutations 120/min, export 5/min.
- Body limit 512 KB; zod validation on every input and on stored documents; lengths bounded.
- Outbound allow-list, HTTPS only, no redirects, no general proxy, no URL fetching from user input.
- Errors: 5xx bodies are `{error:'internal'}`; cookies and authorization headers are redacted from logs.
- `/healthz` returns `{ok:true}` only.
- Test tooling is fenced: the provider stub (`DP_PROVIDER_STUB_DIR`) and the demo seed refuse to run when `NODE_ENV=production`; the read-only preflight fails if the stub variable is set.

## Verified in tests
S01 unauthenticated (401 on all data routes), S02 second synthetic user cannot read/change/replay, S03 invite preview/replay + passkey challenge replay, S04 CSRF header/origin, S05 CSP headers. Bundle grep for `DP_USDA_API_KEY`/`tskey` returns nothing (see TEST_EVIDENCE).

## Not yet verified (needs the Pi)
Container-to-host/LAN reachability from the app container (apply an egress rule to the two provider hosts plus DNS) and the tailnet policy delta. `pnpm audit --prod` on 2026-09-18 reported no known vulnerabilities; re-run before each release.
