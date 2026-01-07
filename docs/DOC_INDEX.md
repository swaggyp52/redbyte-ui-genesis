# Documentation Index

**Last Updated:** 2026-01-06

This file is your navigation hub for all documentation in the RedByte OS Genesis project.

---

## 📚 Documentation Philosophy

This project follows these documentation principles:

1. **No overlapping information** — Each document has a unique purpose
2. **Cross-reference freely** — Documents link to each other instead of duplicating
3. **Living documents** — Update docs when you update code
4. **AI-friendly** — Both humans and AI agents can navigate this structure

---

## 🗺️ Documentation Map

### Root Level Documents (Start Here)

#### [PROJECT_CHRONICLE.md](../PROJECT_CHRONICLE.md) ⭐ **MOST IMPORTANT**
**Purpose:** Comprehensive living record of everything in the project
**Read this if:** You're new to the project, you're an AI agent, or you need to understand the big picture
**Contains:**
- Project vision and purpose
- Complete technical architecture
- Architectural invariants (rules that must never break)
- Development history and recent changes
- Known issues and gotchas
- Development workflows
- AI contributions log

**Read this first. Always.**

---

#### [AI_STATE.md](../AI_STATE.md)
**Purpose:** Legacy AI state ledger with detailed phase/contract specifications
**Read this if:** You need detailed contract specs for specific features (Files, Settings, Intents, Commands, etc.)
**Contains:**
- Project identity
- Development philosophy
- Architectural invariants (detailed)
- Phase contracts (PHASE_J through PHASE_X)
- Completed milestones
- Forbidden operations

**Note:** This file is 45,924 tokens (very large). Use it as a reference for specific contracts. The general architecture is now in PROJECT_CHRONICLE.md.

---

#### [README.md](../README.md)
**Purpose:** Quick introduction for humans discovering the project
**Read this if:** You're a human seeing this project for the first time
**Contains:**
- Project overview
- Quick start instructions
- Technology stack summary
- Links to deeper documentation

---

### docs/ Folder (Technical Deep Dives)

#### [ARCHITECTURE.md](./ARCHITECTURE.md)
**Purpose:** Deep dive into system architecture
**Read this if:** You need to understand kernel, shell, app layer, or simulation architecture
**Contains:**
- Kernel layer (event bus, process tracking)
- Desktop shell (window manager, shell surface)
- Application layer (registry, app windows)
- Contexts (settings, project)
- Simulation modules (2D redstone, 3D world, logic export)
- Data flow highlights

**Cross-references:**
- PROJECT_CHRONICLE.md (overview)
- PROJECT_MODEL.md (data structures)

---

#### [PROJECT_MODEL.md](./PROJECT_MODEL.md)
**Purpose:** Unified data model specifications
**Read this if:** You're working with project state, serialization, or data structures
**Contains:**
- Top-level project shape
- Metadata and timing
- Logic model (templates, nets, IO pins, clocks)
- CPU model (modules, buses)
- Signal model (waveform watches)
- IO pins and clocks
- History snapshots
- Persistence (serialization)

**Cross-references:**
- ARCHITECTURE.md (system architecture)
- rb-logic-core package README (simulation engine)

---

#### [APP_MAP.md](./APP_MAP.md)
**Purpose:** Map of all applications and their purposes
**Read this if:** You need to know what apps exist and what they do
**Contains:**
- List of all apps
- Purpose of each app
- Key features
- Window behavior (singleton vs multi-instance)

**Cross-references:**
- PROJECT_CHRONICLE.md (app architecture overview)
- AI_STATE.md (app contracts)

---

#### [LEARNING_GUIDE.md](./LEARNING_GUIDE.md)
**Purpose:** Educational content and tutorials
**Read this if:** You're creating learning materials or tutorials
**Contains:**
- Tutorial structure
- Example circuits
- Learning paths
- Pattern recognition guides

**Cross-references:**
- rb-apps examples/ folder

---

#### [ONBOARDING_PLAN.md](./ONBOARDING_PLAN.md)
**Purpose:** New contributor onboarding
**Read this if:** You're a new human contributor
**Contains:**
- Getting started guide
- Development setup
- First contribution checklist

**Cross-references:**
- PROJECT_CHRONICLE.md (comprehensive overview)
- README.md (quick start)

---

#### [DESKTOP_PACKAGING.md](./DESKTOP_PACKAGING.md)
**Purpose:** Desktop app packaging instructions
**Read this if:** You're building desktop versions (Electron/Tauri)
**Contains:**
- Packaging steps
- Build configurations
- Distribution strategies

---

#### [REDSTONE_VIEWER.md](./REDSTONE_VIEWER.md) & [SIGNAL_VIEWER.md](./SIGNAL_VIEWER.md)
**Purpose:** Specific viewer documentation
**Read this if:** You're working on redstone or signal visualization features
**Contains:**
- Viewer architecture
- Rendering pipeline
- Interaction models

---

### Package-Level READMEs

Each package has its own README in `packages/<package-name>/README.md`:

#### [packages/rb-logic-core/README.md](../packages/rb-logic-core/README.md)
**Purpose:** Logic simulation engine API documentation
**Contains:**
- CircuitEngine API
- TickEngine API
- NodeRegistry API
- Node behavior specifications
- Serialization API

---

#### [packages/rb-apps/README.md](../packages/rb-apps/README.md)
**Purpose:** Application layer overview
**Contains:**
- App structure
- Store architecture
- Component organization

---

#### [packages/rb-logic-view/README.md](../packages/rb-logic-view/README.md)
**Purpose:** 2D canvas API
**Contains:**
- LogicCanvas component API
- Interaction model
- Rendering pipeline

---

#### [packages/rb-logic-3d/README.md](../packages/rb-logic-3d/README.md)
**Purpose:** 3D visualization API
**Contains:**
- Logic3DScene component API
- Three.js integration
- Mesh generation

---

#### [packages/rb-shell/README.md](../packages/rb-shell/README.md)
**Purpose:** Shell API documentation
**Contains:**
- Shell provider API
- Window management API
- Intent system API
- Command system API

---

(Other package READMEs follow similar patterns)

---

## 🔍 Finding What You Need

### By Role

**I'm a new AI agent working on this project:**
1. Read [PROJECT_CHRONICLE.md](../PROJECT_CHRONICLE.md) completely
2. Reference [AI_STATE.md](../AI_STATE.md) for specific contracts
3. Update PROJECT_CHRONICLE.md after your work

**I'm a new human contributor:**
1. Read [README.md](../README.md) for quick start
2. Read [PROJECT_CHRONICLE.md](../PROJECT_CHRONICLE.md) for comprehensive overview
3. Read [ONBOARDING_PLAN.md](./ONBOARDING_PLAN.md) for first contribution

**I'm working on a specific feature:**
1. Check [PROJECT_CHRONICLE.md](../PROJECT_CHRONICLE.md) for architectural invariants
2. Reference [AI_STATE.md](../AI_STATE.md) for feature contracts
3. Read relevant package README for API docs

**I'm debugging an issue:**
1. Check [PROJECT_CHRONICLE.md](../PROJECT_CHRONICLE.md) "Known Issues & Gotchas" section
2. Reference [ARCHITECTURE.md](./ARCHITECTURE.md) for system understanding
3. Look at relevant test files in `packages/*/src/__tests__/`

---

## 📝 Updating Documentation

### When to Update

Update documentation when you:
- Add a new feature
- Change existing behavior
- Fix a bug with architectural implications
- Add new architectural patterns
- Complete a significant milestone

### What to Update

1. **Always update:** [PROJECT_CHRONICLE.md](../PROJECT_CHRONICLE.md)
   - Add entry to "Chronicle of Changes"
   - Sign your work in "AI Contributions Log"

2. **If you changed contracts:** [AI_STATE.md](../AI_STATE.md)
   - Update relevant contract section
   - Mark completion in phase checklist

3. **If you changed architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md)
   - Update relevant system diagrams/explanations

4. **If you changed data models:** [PROJECT_MODEL.md](./PROJECT_MODEL.md)
   - Update interface definitions
   - Update serialization docs

5. **If you added/changed a package API:** Relevant package README
   - Update API documentation
   - Add usage examples

---

## 🚫 Documentation Anti-Patterns

**DON'T:**
- ❌ Duplicate information across multiple files
- ❌ Create new docs without updating this index
- ❌ Write docs without cross-references
- ❌ Leave docs outdated after code changes
- ❌ Use acronyms or jargon without explanation

**DO:**
- ✅ Cross-reference instead of duplicating
- ✅ Update this index when adding new docs
- ✅ Link to related documentation
- ✅ Update docs in the same commit as code
- ✅ Write for both humans and AI agents

---

## 🎯 Documentation Roadmap

### Future Documentation Needs

- [ ] API reference generator (TypeDoc or similar)
- [ ] Interactive architecture diagrams
- [ ] Video tutorials for complex features
- [ ] Migration guides for breaking changes
- [ ] Performance optimization guide
- [ ] Accessibility guide (WCAG compliance)

---

**Questions about documentation? Check [PROJECT_CHRONICLE.md](../PROJECT_CHRONICLE.md) or ask Connor Angiel.**

---

*Last updated: 2026-01-06*
*Maintained by: AI Agents + Connor Angiel*
