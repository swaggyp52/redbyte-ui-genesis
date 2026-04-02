# IP and Asset Inventory

**Company:** RedByte LLC (proposed)
**Prepared:** 2026-04-02
**Purpose:** Document the intellectual property and assets that are expected to be owned by or assigned to RedByte LLC upon formation.

> ⚠️ IP assignment from the founder personally to the LLC is a legal step that requires attorney involvement. This inventory is preparation for that step, not a substitute for it.

---

## 1. Software / Codebase

**Asset:** The RedByte monorepo (`redbyte-ui`)

**Repository:** [github.com/swaggyp52/redbyte-ui-genesis](https://github.com/swaggyp52/redbyte-ui-genesis) (private as of preparation date — verify current status)

**All packages in the monorepo (from scan):**

| Package | Description | Status |
|---------|-------------|--------|
| `packages/rb-apps` | IDE application — IdeApp + six surfaces | Core, shipped |
| `packages/rb-logic-core` | Circuit simulation engine (deterministic, tick-based) | Core, shipped |
| `packages/rb-logic-view` | 2D circuit canvas renderer | Core, shipped |
| `packages/rb-fpga-toolchain` | VHDL and XDC constraint generation | Core, shipped |
| `packages/rb-fpga-bridge` | Hardware bridge for live board comms | In development |
| `packages/rb-fpga-bridge-contract` | Bridge protocol contract types | In development |
| `packages/rb-fpga-proof-core` | Vivado proof/validation tooling | Shipped |
| `packages/rb-fpga-signing` | Export integrity / SHA-256 signing | Shipped |
| `packages/rb-lab-engine` | Lab submission and grading engine | Shipped |
| `packages/rb-lab-content` | Lab fixtures and content library | Shipped |
| `packages/rb-logic-adapter` | Logic engine adapter layer | Shipped |
| `packages/rb-instruments` | Oscilloscope / probe instrumentation | Shipped |
| `packages/rb-primitives` | Shared UI primitives | Shipped |
| `packages/rb-tokens` | Design tokens (colors, typography) | Shipped |
| `packages/rb-theme` | Theme system | Shipped |
| `packages/rb-icons` | Icon library | Shipped |
| `packages/rb-utils` | Shared utilities | Shipped |
| `packages/rb-viewport` | Viewport management | Shipped |
| `packages/rb-protocol` | Wire protocol definitions | Shipped |
| `packages/rb-board-profiles` | FPGA board profiles (Basys3, etc.) | Shipped |
| `packages/board-models` | Board hardware models | Shipped |
| `packages/rb-bridge-agent` | Bridge agent service | In development |
| `packages/rb-windowing` | Window management (legacy, to be deleted in M7) | Legacy |
| `packages/ops` | Operations/lab server package | Internal tooling |
| `packages/ops-server` | Ops server (lab submission review) | Internal tooling |
| `packages/rb-e2e` | E2E test utilities | Dev tooling |
| `packages/eslint-plugin-jsx-a11y` | Accessibility lint rules | Dev tooling |
| `apps/playground` | Dev entry point for IDE | Shipped |
| `apps/manual-site` | Marketing/product landing site | Shipped |
| `scripts/` | Build pipeline, unified build, CI gates | Internal tooling |

**Current copyright:** Copyright © 2025–2026 Connor Angiel. All rights reserved.

**Current license:** RedByte Proprietary License v1.0 (RPL-1.0) — no redistribution, no commercial use, no hosting, no derivative competitors.

**Action required:** Upon LLC formation, the copyright and license authority should be formally assigned to RedByte LLC via an IP assignment agreement prepared by an attorney.

---

## 2. Domain

**Asset:** `redbyteapps.dev`

**Current status:** Live and deployed on Cloudflare Pages.

**Registrar:** (Connor to confirm — check account for domain registrar name)

**Action required:** Domain should be transferred to or owned in the name of RedByte LLC, or at minimum documented as a company asset in the operating agreement. Ask your attorney whether transfer to LLC ownership or a licensing arrangement from the founder to the LLC is more appropriate at this stage.

---

## 3. Deployed Product

**Asset:** Live web application at [redbyteapps.dev](https://redbyteapps.dev)

**Deployment:** Cloudflare Pages (static deployment with `_redirects` and `_headers`)

**Build system:** Unified build pipeline producing `dist/` artifact from `pnpm build:unified`

**Note:** The deployment itself is not a separate asset from the codebase, but the Cloudflare account, DNS records, and deployment configuration should be clearly associated with the LLC account (not just personal accounts) once formed.

---

## 4. Documentation and Manuals

**Assets:**
- `docs/manuals/RedByte_Product_Manual.md` — canonical product reference (v1.0, March 2026)
- `docs/manuals/RedByte_Product_Manual_print.html` — print-formatted version
- `docs/manuals/RedByte_Product_Manual.pdf` — generated PDF
- `REDBYTE_USER_MANUAL.md` — user-facing interactive manual
- `CLASSROOM_QUICKSTART_INSTRUCTOR.md` — instructor quickstart guide
- `CLASSROOM_QUICKSTART_STUDENT.md` — student quickstart guide
- `docs/ARCHITECTURE.md` — five-layer architecture documentation
- `docs/VIVADO_INTEGRATION.md` — Vivado export workflow documentation
- Multiple other technical and product specification documents in the repo

**Note:** These are authored works that form part of the company's IP. They should be covered by the IP assignment.

---

## 5. Brand Assets

**Confirmed:**
- Product name: "RedByte"
- Domain: `redbyteapps.dev`
- Design tokens (colors, typography) in `packages/rb-tokens`
- UI design system documented in `rb-ui-constitution.md`

**Unknown / to confirm:**
- Is there a logo? If so, who designed it and where does the file live?
- Are there any brand mark files (.svg, .png, etc.) in the repo or elsewhere?
- Has "RedByte" been searched for trademark conflicts?

**Action required:** Do a basic USPTO trademark search for "RedByte" before formation or shortly after. This is not urgent but is worth doing before investing heavily in brand recognition. An attorney can help.

---

## 6. Lab Content and Examples

**Assets:**
- Lab 4 ALU starter fixture (`packages/rb-apps/src/examples/19_lab4-alu-starter-basys3.json`)
- Other circuit examples and demos in the `examples/` directory
- `LAB_SPECS.md` — lab specification documents
- `Labs.zip` — lab archive

These are original authored works and part of the product's educational content library. They should be covered by the IP assignment.

---

## 7. Open-Source Dependencies — License Audit (Completed)

**Audit date:** 2026-04-02. All declared dependencies across all packages scanned.

**Result: No copyleft licenses found.** Every declared dependency uses MIT, Apache 2.0, or ISC — all permissive. No GPL, LGPL, or AGPL in the declared dependency set.

| Package | License | Ships in product? |
|---------|---------|-------------------|
| `react` / `react-dom` 19.x | MIT | Yes |
| `zustand` 5.x | MIT | Yes |
| `immer` | MIT | Yes |
| `@noble/ed25519`, `@noble/hashes` | MIT | Yes (export signing) |
| `jszip`, `pako`, `unzipper` | MIT | Yes (ZIP/export) |
| `tslib` | Apache 2.0 | Yes |
| `serialport`, `@serialport/parser-readline` | MIT | Yes (hardware bridge) |
| `express`, `cors`, `multer`, `ws` | MIT | Yes (ops server/bridge) |
| `chalk`, `commander`, `cross-env` | MIT | Yes (build tooling) |
| `vite`, `vitest`, `tailwindcss` | MIT | No (dev only) |
| `@playwright/test`, `playwright` | Apache 2.0 | No (dev only) |
| `@testing-library/*`, `jsdom` | MIT | No (dev only) |
| `rimraf`, `archiver` | ISC / MIT | No (dev only) |

**Remaining action:** Run the full transitive audit (`pnpm licenses list` on Windows) before signing any institutional license. The declared set is clean; transitive deps are low-risk but should be confirmed.

---

## 8. Assets Owned by Third Parties (Known)

**Digilent Basys3 documentation and reference materials:** The repo contains `basys3_rm.pdf` (Basys3 reference manual). This is Digilent's document. RedByte does not own it; it is reference material. Confirm it is not being redistributed publicly in any way that violates Digilent's terms.

**Vivado documentation:** `vivado-getting-started-en-us-2025.1.pdf` in the repo is an AMD/Xilinx document. Same note — reference material, not a RedByte asset.

**Course materials:** The repo contains `Ece 141 – Digital Logic Lab 1 Assignment.docx` and `fac_jung002_ECE141_Lab4.pdf`. These appear to be external course materials used as reference during development. Confirm these are not being redistributed and that their presence in the repo is appropriate (they may be fine internally but should not be in any public release).

---

## 9. Asset Map — Current Control Status

| Asset | Current owner/control | Target (post-LLC) | Action needed | Priority |
|-------|----------------------|-------------------|---------------|----------|
| Codebase (`redbyte-ui` monorepo) | Connor Angiel personally | RedByte LLC | IP assignment agreement | High — at formation |
| Domain `redbyteapps.dev` | Connor Angiel personally (confirm registrar) | RedByte LLC | Include in IP assignment; migrate billing | High — at/near formation |
| Cloudflare Pages deployment | Connor Angiel personal account | RedByte LLC account | Migrate to company account | Medium — within 3 months |
| GitHub repository (`swaggyp52/redbyte-ui-genesis`) | Personal account | `redbyte` GitHub org | Create org, transfer repo | Medium — before partners see it |
| Product manuals and docs | Connor Angiel personally | RedByte LLC | Covered by IP assignment | High — at formation |
| Lab fixtures and examples | Connor Angiel personally | RedByte LLC | Covered by IP assignment | High — at formation |
| Brand name "RedByte" | Unregistered — common law use | RedByte LLC (trademark) | USPTO search + consider registration | Medium — within first year |
| Design tokens / UI system | Connor Angiel personally | RedByte LLC | Covered by IP assignment | High — at formation |
| LICENSE file | Names Connor Angiel | Should name RedByte LLC | Update after IP assignment | High — after assignment |
| RedByte business/planning docs (.docx/.pdf in repo root) | Connor Angiel personally | RedByte LLC | Covered by IP assignment | Low |
| External course files in repo | Universities / third parties | Remove from repo | Delete or gitignore immediately | **Urgent — do now** |
| Build output .txt/.log files in repo root | N/A (generated) | Not company assets | Add to .gitignore | Medium |
| `nvm-setup.exe` in repo | Third-party (nvm project) | Remove | Delete or gitignore | Medium |
| Dependency license audit (transitive) | Not yet run | Confirmed clean | Run `pnpm licenses list` on Windows | Medium — before institutional licensing |
