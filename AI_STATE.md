\# RedByte OS Genesis — AI State Ledger



This file is the single authoritative source of truth for:

\- Project phase

\- Architectural invariants

\- Allowed operations

\- Current objectives

\- Completed milestones



ALL AI agents (ChatGPT, Claude, Codex, others) MUST:

1\. Read this file before proposing or executing work

2\. Treat it as higher priority than prior chat context

3\. Update this file after completing any task or phase



---



\## Project Identity



Name: RedByte OS Genesis  

Owner: Connor Angiel  

Type: Browser-based OS-style simulation \& construction platform  

Stack: TypeScript, React, Vite, pnpm, Cloudflare Pages  

Canonical Branch: `main`



---



\## Development Philosophy



\- Terminal-first development only

\- GitHub UI actions are forbidden unless explicitly stated

\- One change-set per commit

\- No speculative refactors

\- No global changes without explicit authorization



---



\## Architectural Invariants (DO NOT BREAK)



These rules are permanent unless changed here:



\- OS metaphor is canonical (boot → desktop → apps)

\- Monorepo structure is authoritative

\- Packages are not merged or flattened

\- Legal attribution must reference Connor Angiel

\- `main` is always production

\- Cloudflare Pages auto-deploys from `main`

\- No AI agent may introduce automation bots without approval



---



\## Current Phase



Phase ID: PHASE\_G  

Phase Name: Genesis Stabilization \& Attribution Cleanup  

Status: ACTIVE



---



\## Completed Phases



\- PHASE\_A — Repository Initialization

\- PHASE\_B — pnpm Monorepo Structure

\- PHASE\_C — Core Logic Engine

\- PHASE\_D — UI Shell \& Desktop

\- PHASE\_E — App Framework

\- PHASE\_F — Legal \& Licensing Foundation



---



\## Active Objectives



\- \[x] Correct legal name spelling to Connor Angiel across repo

\- \[x] Centralize legal attribution

\- \[x] Add CI guard against incorrect attribution

\- \[x] Document AI usage rules inside repo



---



\## Forbidden Actions



AI agents must NOT:

\- Reformat files unnecessarily

\- Introduce new branches without instruction

\- Open stacked PRs

\- Modify licensing terms implicitly

\- Rename packages or folders

\- Touch deployment config without approval



---



\## Allowed Actions Without Extra Approval



\- Mechanical refactors

\- Scripted replacements

\- Documentation improvements

\- Test fixes

\- Lint fixes



---



\## Handoff Protocol



After completing work, an AI agent MUST:

1\. Update phase status or objectives

2\. Append a short factual Change Log entry

3\. Avoid narrative or commentary



---



\## Change Log



\### 2025-12-13

\- Corrected legal attribution spelling to Connor Angiel across entire codebase

\- Commit: 5b353687

\### 2025-12-14

\- Added docs/ai-usage-rules.md to document existing AI usage governance within the repo

\- Marked objective “Document AI usage rules inside repo” as complete; phase unchanged

\- Added docs/legal-attribution.md as canonical attribution guidance; marked objective “Centralize legal attribution” as complete; phase unchanged

\- Added CI legal/trademark guard job to scan tracked files and verify Connor Angiel attribution reference in AI_STATE.md; marked objective “Add CI guard against incorrect attribution” as complete; phase unchanged

\- Hardened CI legal_guard patterns/output to avoid banned literals and prevent self-triggering; phase unchanged

\### 2025-12-15
\- Removed banned boilerplate/legal phrases and trademark symbols across tracked files to satisfy CI legal_guard; objectives unchanged; phase unchanged
\- Added launcher dock tooltip hint to reinforce desktop metaphor; no behavior change; objectives unchanged; phase unchanged

\- Added AGENTS.md as a pointer for AI agents to AI_STATE.md and existing governance docs; objectives unchanged; phase unchanged

\- Added Launcher app registered in app registry with Dock entry using existing Launcher component; objectives unchanged; phase unchanged

\- Launcher now lists registered apps (excluding itself) and opens selected apps via existing window flow; objectives unchanged; phase unchanged

\- Added keyboard shortcut (Ctrl+K / Cmd+K) to open the Launcher and updated Dock tooltip; objectives unchanged; phase unchanged
\- Re-ran lint for the launcher shortcut, set Launcher as singleton to reuse focus behavior, and confirmed Dock tooltip matches the shortcut; objectives unchanged; phase unchanged

\- Added Launcher smoke test covering registry-derived list (excluding launcher) and click-to-launch behavior; objectives unchanged; phase unchanged

\- Added keyboard navigation (Up/Down/Enter) to the Launcher list and updated launcher test; objectives unchanged; phase unchanged
