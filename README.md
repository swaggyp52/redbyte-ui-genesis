# RedByte OS Genesis

**An interactive digital logic circuit simulation and construction platform**

---

## AI Usage Notice

**Any AI agent (Claude, Codex, ChatGPT, etc.) working with this repository MUST:**

1. **Read [PROJECT_CHRONICLE.md](./PROJECT_CHRONICLE.md) FIRST**   This is the comprehensive living documentation for the entire project
2. **Reference [AI_STATE.md](./AI_STATE.md)** for detailed phase/contract specifications
3. **Update PROJECT_CHRONICLE.md after completing work**   Add your changes to the "Chronicle of Changes" and "AI Contributions Log"

---

## What is RedByte OS Genesis?

RedByte OS Genesis is an educational platform for learning digital logic and computer architecture through interactive circuit simulation. Built as a browser-based "operating system," it provides:

- Interactive 2D and 3D circuit editor
- Real-time signal simulation
- Time-travel debugging with recording/replay
- Automatic bug localization
- Learning mode with tutorials and examples
- Circuit health analysis and suggestions

**Live Preview:** [redbyteapps.dev](https://redbyteapps.dev)

---

## Quick Start

**Canonical Install Guide:** [`docs/INSTALL_QUICK.md`](docs/INSTALL_QUICK.md)

**For running v1 release execution:** start with [`docs/release/v1-release-checklist.md`](docs/release/v1-release-checklist.md).

- **Web Demo:** [https://redbyteapps.dev](https://redbyteapps.dev) (Simulation Only)
- **Student Portal:** [https://redbyte.os/students](https://redbyte.os/students)

### Development

```bash
pnpm install
pnpm dev
```

---

## Instructor Workflow

- Export a submission archive: Logic Playground -> Export -> Project Archive (.rbproj.zip).
- Review a submission: unzip the archive and open `rb-project.json` via Logic Playground -> Open Project.
- Hardware grading: use the Hardware Panel to synthesize and program a Basys 3 board (requires Vivado WebPACK or openFPGALoader).

## FPGA Programming

- Install AMD Vivado WebPACK and ensure Vivado is on your PATH.
- Open Hardware Panel to confirm toolchain detection, then run Synthesize and Program.
- Digital circuits only: analog nodes are simulation-only and are not synthesized.

---

## Documentation

- **[PROJECT_CHRONICLE.md](./PROJECT_CHRONICLE.md)**   Comprehensive living documentation (START HERE)
- **[AI_STATE.md](./AI_STATE.md)**   Legacy state ledger with detailed contracts
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**   System architecture
- **[docs/PROJECT_MODEL.md](./docs/PROJECT_MODEL.md)**   Data model specifications
- **[docs/LEARNING_GUIDE.md](./docs/LEARNING_GUIDE.md)**   Educational content

---

## Project Structure

This is a monorepo using pnpm workspaces:

```
redbyte-ui/
%%% apps/
%       %%% playground/             # Main web application
%       %%% studio/                     # Studio application
%       %%% docs/                         # Documentation site
%%% packages/
%       %%% rb-logic-core/       # Circuit simulation engine
%       %%% rb-logic-view/       # 2D circuit canvas
%       %%% rb-logic-3d/           # 3D visualization
%       %%% rb-apps/                   # Application components
%       %%% rb-shell/                 # OS shell wrapper
%       %%% ...
%%% tools/config/                 # Shared build configs
```

---

## Technology Stack

- **React 19**   UI framework
- **TypeScript 5**   Type safety
- **Vite 7**   Build tool
- **Zustand 5**   State management
- **Three.js**   3D rendering
- **Vitest**   Testing
- **Tailwind CSS**   Styling

---

## Development Workflow

### Common Commands

```bash
pnpm --filter @redbyte/playground dev                       # Start dev server
pnpm test                     # Run tests
pnpm test:watch         # Watch mode
pnpm coverage             # Generate coverage report
pnpm lint                     # Run linter
pnpm typecheck           # Type check
pnpm build                   # Build for production
```

### Making Changes

1. Read [PROJECT_CHRONICLE.md](./PROJECT_CHRONICLE.md)
2. Create a feature branch
3. Make your changes
4. Write tests
5. Run `pnpm test` and `pnpm build`
6. Commit with descriptive message
7. Create pull request
8. Update PROJECT_CHRONICLE.md

---

## Testing

433+ tests across 66 test files:
- Unit tests for core logic
- Component tests for React components
- Integration tests for features
- E2E tests with Playwright

**All tests must pass before merging.**

---

## License

**RedByte Proprietary License (RPL-1.0)**

Copyright © 2025 Connor Angiel. All rights reserved.

---

## Contact

**Owner:** Connor Angiel

**Repository:** https://github.com/swaggyp52/redbyte-ui-genesis

**Live Preview:** [redbyteapps.dev](https://redbyteapps.dev)

---

**For comprehensive documentation, see [PROJECT_CHRONICLE.md](./PROJECT_CHRONICLE.md)**
