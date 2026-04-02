# IP Cleanup Memo

**For:** Connor Angiel
**Prepared:** 2026-04-02
**Purpose:** Identify IP ownership questions, repo hygiene issues, and cleanup actions that should be completed before the company enters into any licensing agreements or makes the repository public.

> This is not legal advice. Items flagged here that have legal or financial implications should be reviewed with an attorney.

---

## The Core Question

Before RedByte LLC can cleanly own the product and license it to anyone, one question needs a clear answer for every significant asset:

**Who made it, who owns it, and is it safe to distribute?**

This memo walks through each category.

---

## 1. Codebase Authorship

**Claim:** The RedByte codebase was written entirely by Connor Angiel.

**Questions to answer honestly:**

- Was any part of this code written while you were employed by someone else? If so, your employment agreement may contain an IP assignment clause that gives your employer rights to work you did "on the clock" or even on personal time depending on the contract. If you were a student employee, TA, or research assistant, the same question applies. If you were just a student taking courses with no employment relationship to the school, this is likely not an issue.

- Did any other person write any part of the code? If a classmate, friend, or online contributor wrote any code that ended up in the repo — even small amounts — that person may have rights to that code. This includes code copied from Stack Overflow or similar sources (Stack Overflow code snippets are licensed under CC BY-SA or MIT depending on the date — generally safe for commercial use with attribution, but worth noting).

- Did any AI-generated code end up in the codebase? AI-generated code has unsettled copyright status. Currently, US courts and the Copyright Office have held that AI-generated content is not copyrightable. If parts of the codebase were written by Claude, GitHub Copilot, or similar tools, this is not necessarily a blocker, but it is something to be aware of and document.

**Action:** Confirm to yourself (and be ready to confirm to an attorney) that the answer to all three is: no employer IP issues, no outside contributors, and the AI-generated portions (if any) are incidental and undisputed.

---

## 2. Third-Party Files in the Repository

The following files were found in the repo root and appear to be external documents, not original RedByte work. These need to be addressed before any public release or commercial licensing.

| File | What it appears to be | Issue | Action needed |
|------|----------------------|-------|---------------|
| `Ece 141 – Digital Logic Lab 1 Assignment.docx` | A university course lab assignment | School-owned copyright. Not a RedByte work. | Confirm it is not included in any public build artifact or distribution. Remove from repo or move to a gitignored reference folder. |
| `fac_jung002_ECE141_Lab4.pdf` | A course lab document from ECE 141 | School-owned copyright. Not a RedByte work. | Same action as above. |
| `basys3_rm.pdf` | Digilent Basys3 Reference Manual | Digilent's document. Permissive internal reference, but not yours. | Confirm not included in any public distribution. Add to .gitignore if the repo is ever made public. |
| `vivado-getting-started-en-us-2025.1.pdf` | AMD/Xilinx Vivado documentation | AMD's document. Reference only. | Same as above. |
| `ECE348_GECE598_Refer_VHDL_quick_start.pdf` | Course VHDL quick-start reference | Likely university or textbook-owned. | Same as above. |
| `nvm-setup.exe` | Node Version Manager installer binary | Third-party binary. Not a RedByte work. | Should not be distributed. Add to .gitignore, remove from repo tracking. |

**Bottom line:** None of these are catastrophic. The issue is that a repo that might one day go public or be shared with institutions should not contain files you don't have rights to distribute. They need to either live in a gitignored directory (as internal reference) or be removed from the repo entirely.

---

## 3. Dependency License Audit — Results

**Status:** Completed (2026-04-02) — scanned all `package.json` files across all packages and apps.

**Finding: No copyleft licenses found.** All declared dependencies use MIT, Apache 2.0, or ISC — all permissive licenses that allow commercial use without imposing open-source requirements on RedByte.

**Production dependencies (ship in the product):**

| Package | Version | License | Notes |
|---------|---------|---------|-------|
| `react` / `react-dom` | 19.2.1 | MIT | UI framework |
| `zustand` | 5.0.9 | MIT | State management |
| `immer` | ^11.1.3 | MIT | Immutable state |
| `@noble/ed25519` | 2.1.0 | MIT | Export integrity / signing |
| `@noble/hashes` | 1.4.0 | MIT | Cryptographic hashes |
| `jszip` | ^3.10.1 | MIT | ZIP generation for export |
| `pako` | ^2.1.0 | MIT | Zlib compression |
| `unzipper` | 0.12.3 | MIT | ZIP extraction (import) |
| `tslib` | ^2.6.2 | Apache 2.0 | TypeScript runtime helpers |
| `serialport` | 12.0.0 | MIT | Hardware bridge (FPGA comms) |
| `@serialport/parser-readline` | 12.0.0 | MIT | Hardware bridge |
| `express` | 4.19.2 | MIT | Ops server (bridge/lab) |
| `cors` | 2.8.5 | MIT | Ops server |
| `multer` | ^1.4.5-lts.1 | MIT | File uploads (ops server) |
| `ws` | 8.18.0 | MIT | WebSocket (bridge) |
| `chalk` | ^5.3.0 | MIT | CLI output formatting |
| `commander` | ^11.1.0 | MIT | CLI tooling |
| `cross-env` | 7.0.3 | MIT | Build scripts |

**Dev-only dependencies (do not ship to users):**

| Package | License | Notes |
|---------|---------|-------|
| `vite` | MIT | Build tooling |
| `vitest` | MIT | Test runner |
| `@playwright/test` | Apache 2.0 | E2E testing |
| `tailwindcss` | MIT | CSS utility framework |
| `@testing-library/*` | MIT | Component testing |
| `rimraf` | ISC | File cleanup (build) |
| `archiver` | MIT | Archive tooling |

**Caveat:** This audit covers declared dependencies in all `package.json` files. A full transitive audit of the `node_modules` tree (hundreds of packages deep) requires running `pnpm licenses list` from Windows (per the repo's test-runner constraint). The declared deps are all clean. Run the full transitive audit before signing any institutional license agreement — the risk is low given the clean declared set, but it should be confirmed.

**Command to run full audit (from Windows):**
```bash
pnpm licenses list
```

---

## 4. Domain and Deployment Account Ownership

**Domain:** `redbyteapps.dev`
**Deployment:** Cloudflare Pages

**Current status:** Registered and managed by Connor Angiel personally.

**Issue:** When the LLC is formed, the domain and deployment infrastructure should be documented as company assets and, over time, moved to company-owned accounts. If RedByte LLC is eventually sold, acquired, or has outside investors, the company needs to demonstrably own the assets it operates.

**Actions:**
- Document the domain registrar and account it is registered under.
- After LLC formation, consider migrating the domain registration and Cloudflare account to accounts that are clearly associated with the LLC (company email, company billing).
- At minimum, include the domain explicitly in the IP assignment agreement as an asset being transferred to or owned by the LLC.

**Timing:** This does not need to happen on day one of LLC formation. It should happen within the first few months.

---

## 5. The GitHub Repository

**Repository:** `github.com/swaggyp52/redbyte-ui-genesis`

**Current status:** Private (as of the time of review).

**Issue:** The repository is under a personal GitHub account username, not a company account. The username `swaggyp52` is not RedByte.

**Actions:**
- After LLC formation, consider creating a `redbyte` or `redbyte-llc` GitHub organization and transferring the repository to it. This does not change the code or the history — it just makes clear that the repo belongs to the company, not a personal account.
- Alternatively, document clearly in the IP assignment that this repository is a company asset even while it sits in the personal account.

**Timing:** Not urgent, but should happen before any institutional partners, advisors, or investors look at the repo.

---

## 6. The LICENSE File

**Current contents:**
```
RedByte Proprietary License v1.0

No redistribution
No commercial use
No hosting
No derivative competitors

All rights reserved
```

**Current copyright holder:** Connor Angiel (listed in README and product manual as "Copyright © 2025–2026 Connor Angiel").

**Issue:** After LLC formation and IP assignment, the copyright holder should be updated to RedByte LLC.

**Actions:**
- After IP assignment is complete, update the LICENSE file to read: `Copyright © 2025–2026 RedByte LLC. All rights reserved.`
- Update the copyright notice in `docs/manuals/RedByte_Product_Manual.md` and any other docs that list the copyright holder.
- The license terms themselves (no redistribution, no commercial use, no hosting, no derivative competitors) are appropriate for a proprietary product being licensed to institutions. Keep them.

**Note:** The "no commercial use" clause in the current license is something to review with an attorney. If RedByte LLC is going to sell commercial licenses to institutions, the license governing the product itself will need to be updated to reflect that (e.g., by having a separate commercial license agreement for paying customers while the publicly visible license restricts unlicensed commercial use). An attorney should draft the institutional license agreement.

---

## 7. Repo File Inventory — What's Actually in the Root

The repo root contains files beyond code. Here is what was found and what to do with each:

**External files — not RedByte-owned, action required:**

| File | Category | In .gitignore? | Action |
|------|----------|---------------|--------|
| `Ece 141 – Digital Logic Lab 1 Assignment.docx` | University course material | No | Move to gitignored `_reference/` or delete |
| `fac_jung002_ECE141_Lab4.pdf` | University course lab doc | No | Same |
| `ECE348_GECE598_Refer_VHDL_quick_start.pdf` | Course reference | No | Same |
| `basys3_rm.pdf` | Digilent reference manual | No | Same |
| `vivado-getting-started-en-us-2025.1.pdf` | AMD documentation | No | Same |
| `nvm-setup.exe` | NVM installer binary | No | Delete or add to .gitignore |

**RedByte-authored documents (not code) — safe to keep, consider organizing:**

| File | Notes |
|------|-------|
| `RedByte Project Strategic Plan.docx/.pdf` | Business planning — keep, internal |
| `RedByte OS & Logic Playground – Product and Systems Specification.pdf` | OS-era product spec — archive |
| `RedByte OS_ Deterministic Interactive Computation Framework.docx` | OS-era design doc — archive |
| `RedByte_ Toward Transparent, Trustworthy Interactive Learning.docx` (and copy) | Research/product writing — keep, internal |
| `Lab-Ready Product Plan (1).docx` | Product planning — keep, internal |
| `Deterministic Interactive Computation in the Browser.pdf` | Research doc — keep, internal |
| `FullAdderHDL.txt` | Small HDL example — keep |

**Build/CI output files — should not be committed:**

| Files | Action |
|-------|--------|
| `demo-result.txt`, `gate_output.txt`, `screenshot-output.txt`, `test-output.txt`, `test-results.txt`, `ui-dev-guards.txt`, `verify-gates.txt`, `build.log`, `build_output.log`, `test-files-list.txt` | Add to .gitignore, do not commit |

---

## 8. Cleanup Action List — Timed

**Do before any institutional sharing or repo visibility change:**

- [ ] Move or delete the 6 external files listed above (ECE 141 docs, Basys3 PDF, Vivado PDF, VHDL quick-start, nvm-setup.exe)
- [ ] Add the build output `.txt` and `.log` files to `.gitignore`
- [ ] Confirm no external files appear in the `dist/` build artifact (check that third-party docs are not in any Cloudflare deployment)
- [ ] Confirm codebase authorship: no employer IP issues, no outside contributors (document your answer)

**Do at or just after LLC formation:**

- [ ] IP assignment agreement prepared and signed (attorney)
- [ ] Update LICENSE file copyright: `Connor Angiel` → `RedByte LLC`
- [ ] Update copyright notice in `docs/manuals/RedByte_Product_Manual.md` and README
- [ ] Document domain (`redbyteapps.dev`) as a company asset in the IP assignment

**Do within the first few months after formation:**

- [ ] Run full transitive dependency license audit (`pnpm licenses list` from Windows)
- [ ] Create `redbyte` GitHub organization and transfer repository
- [ ] Migrate Cloudflare account to company-associated account (company email/billing)
- [ ] Do basic USPTO trademark search for "RedByte"

**Do before signing any institutional license agreement:**

- [ ] Full transitive dependency audit completed and documented
- [ ] LICENSE file updated to LLC ownership
- [ ] Attorney-drafted institutional software license agreement in hand
- [ ] Terms of service and (if applicable) privacy policy published

---

## 9. Distribution Boundary — What Can Go Where

This table defines what is safe to include in each distribution context.

| Asset / File category | Public repo | Free product (redbyteapps.dev) | Paid institutional product | Internal only |
|----------------------|-------------|-------------------------------|---------------------------|---------------|
| Core codebase (`packages/rb-*`, `apps/`) | ❌ (keep private) | ✅ compiled into dist | ✅ same compiled dist | — |
| `dist/` build artifacts | ❌ not tracked | ✅ deployed to Cloudflare | ✅ same deployment | — |
| Product manuals (`docs/manuals/`) | ✅ if repo goes public | ✅ can be linked/published | ✅ | — |
| Lab fixtures (`packages/rb-apps/src/examples/`) | ❌ keep private | ✅ bundled in product | ✅ + expanded library | — |
| ECE 141 course docs | ❌ | ❌ | ❌ | ✅ reference only |
| Basys3 / Vivado reference PDFs | ❌ | ❌ | ❌ | ✅ reference only |
| `nvm-setup.exe` | ❌ | ❌ | ❌ | Delete |
| Build output `.txt`/`.log` files | ❌ | ❌ | ❌ | Local only |
| RedByte strategic plan / research docs | ❌ | ❌ | ❌ | ✅ internal |
| LICENSE file | ✅ if repo goes public | ✅ linked from product | ✅ | — |
| `CLAUDE.md` / AI agent instructions | ❌ | ❌ | ❌ | ✅ internal |
| Obsidian vault (`00 Inbox/` – `10 Reference/`) | ❌ | ❌ | ❌ | ✅ internal |

**The clean rule:** Only compiled, RedByte-authored, rights-cleared content ships in any product or public context. Everything else is internal reference.

---

## 10. What to Tell the Attorney

Bring this memo to the IP assignment conversation. Key points:

- The codebase was written solely by Connor Angiel. No co-authors, no employment IP issues (confirm this is accurate before the meeting).
- A dependency license scan of all declared dependencies found no copyleft licenses — all MIT, Apache 2.0, or ISC. A full transitive audit will be run before commercial licensing.
- Third-party reference files (university course docs, vendor PDFs, a third-party installer) are in the repo and will be removed before any public release. They are not shipped in the product.
- The domain (`redbyteapps.dev`), Cloudflare deployment, and GitHub repository are all under personal accounts and need to be formally assigned to or documented as company assets.
- The LICENSE file needs to be updated after IP assignment: copyright holder changes from Connor Angiel to RedByte LLC.
- The current license terms ("no commercial use") need a companion institutional license agreement drafted before any paying customers are onboarded.
