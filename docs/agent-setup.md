# Agent setup â€” 2026-09-21

This is on-demand tooling documentation, not mandatory startup context.

## Installed and reused

- Shared personal defaults: C:/Users/conno/.codex/AGENTS.md.
- Shared `product-frontend-quality`: small locally authored frontend workflow, not Impeccable.
- Shared `web-design-guidelines`: vercel-labs/agent-skills at
  063bee94c3f4df8453406c830b0a7df0f2860278; MIT per upstream README.
  Only the reviewed Markdown skill is installed; no installer or hooks ran.
- Existing desktop Vercel plugin 0.21.4 React guidance is reused for React code only.
  The standalone CLI diagnostic does not expose that desktop plugin; no duplicate React skill was installed.
- Existing project skills remain intact. One primary browser: native Codex browser interface.
- CLI 0.155.0-alpha.9.2; Claude 2.1.258 uses a thin @AGENTS.md compatibility import.

## Frontend workflow

React workbench; preserve simulation, export, pin mapping and IndexedDB.

Local command (from this project root): `corepack pnpm dev`.
Check the printed URL; choose a free port without stopping existing services.
Use a new browser context/origin, inspect rendered layout and runtime errors, and exercise one
representative non-destructive interaction. Static previews must report missing APIs; they do
not substitute for required fixture-backed integration, deployed, device or account proof.
Use existing project design contracts and supported viewport classes. Backend-only work does
not load design skills. The global frontend skill covers accessibility, states and honest controls.

## Defaults and presets

Astra selection and Standard (`service_tier = "default"`) were preserved. Saved reasoning was low
at baseline; the app changed it during setup, and those live selections were preserved.
The global config now caps spawned helpers at two, excluding the primary; no recursive delegation
is allowed by the written defaults. Use one main agent unless independent help is justified.
`codex --profile balanced` uses medium effort; `codex --profile deep-work` uses high effort.
Profiles inherit the model and security configuration. The current task is not retroactively changed.
Start a new Codex task after setup to load new instructions/skills. Desktop's explicit model/effort
selection can override file defaults; named profiles are verified CLI surfaces, not invented UI modes.

## Deliberately omitted

Impeccable inspected at f2c7051853848826aac2f4646581d62a732155ad (Apache-2.0).
Its current launcher downloads an engine binary, commands can alter product/design records and
hooks, and critique may automatically delegate. Existing design skills plus the local workflow
meet this setup's needs without that additional lifecycle. Existing .impeccable files are preserved.
No extra browser stack, global hooks, automatic output rewriting or Ponytail injection is installed.
RTK remains optional pending measured Windows exit-status/diagnostic/raw-output checks.
No subscription-credit savings are claimed from instruction bytes or terminal-output reductions.

## Provenance and rollback

Sources: https://github.com/vercel-labs/agent-skills ; https://github.com/pbakaus/impeccable ;
https://learn.chatgpt.com/docs/agent-configuration/agents-md ;
https://learn.chatgpt.com/docs/config-file/config-advanced ; https://code.claude.com/docs/en/memory .
All pre-edit bytes and a per-file change manifest are outside Git under
`C:/Users/conno/.codex/recovery/agent-setup-20260921/`.
Use that directory's rollback.py with the bundled Python: default is a dry-run, --apply restores
only files still matching this setup's after-hash. Changed-since files are refused for manual review.
The global config is an exception: remove only the owned agent-limit field, preserving later settings.
No reset, clean, checkout replacement, automatic commit, push or deployment is part of setup.

## Verification results

Source Vite preview on 45171: Course labs -> Starters changed the list and preview; screenshot reviewed. No console errors were returned by browser diagnostics. Node was 24.15.0, not the repository-pinned 20.19.0; this is tooling smoke evidence, not golden/build certification.

Codex debug prompt-input discovered the personal guide, project instructions and both new shared
skill descriptions. It did not eagerly load the frontend skill body. Both named CLI profiles
parsed successfully. Global TOML parses; normal CLI startup works. Strict-config stops on the
pre-existing `computer_use.windows.always_allowed_app_ids` field. That app/access configuration
was not removed or changed to force a green strict check. The two new skills pass quick_validate.py.
No model-generation benchmark or subscription-credit savings measurement was performed.

A read-only app-server config/read additionally confirmed
`agents.max_concurrent_threads_per_session = 2` in effective configuration.
