# RedByte Documentation OS - Proposed Structure

This document defines the complete documentation architecture for RedByte.

## Directory Structure

```
/docs/
├── README.md                          # Documentation home & navigation
│
├── /00-canon/                         # Canonical truth documents
│   ├── 00-project-identity.md         # What RedByte is/isn't, who it's for
│   ├── 01-core-principles.md          # Truth-first, never lie to teach, boundaries
│   ├── 02-determinism-contract.md     # Exact semantics, guarantees, verification
│   ├── 03-system-architecture.md      # All packages, responsibilities, data flow
│   ├── 04-experience-design.md        # Learn Mode, Build posture, UI philosophy
│   ├── 05-roadmap.md                  # Near-term vs long-term, explicitly labeled
│   └── 06-owners-manual.md            # "I can rebuild this" proof document
│
├── /01-dev/                           # Developer mastery docs
│   ├── dev-setup.md                   # Exact commands: install/build/test/dev/preview
│   ├── repo-tour.md                   # Monorepo walkthrough & package purposes
│   ├── coding-standards.md            # Patterns: Zustand, invariants, tests
│   ├── debugging-playbook.md          # How to diagnose issues, state locations
│   ├── tests-and-quality.md           # What tests exist, how to add per PR
│   └── release-process.md             # Stop-point criteria, smoke tests, tagging
│
├── /02-systems/                       # Subsystem deep dives (proof of mastery)
│   ├── circuit-model.md               # Data structures, invariants, files
│   ├── simulation-engine.md           # Tick loop, determinism, engine architecture
│   ├── zustand-store-and-mutation-pipeline.md  # Store design, mutation flow
│   ├── undo-redo.md                   # History system, snapshot management
│   ├── wiring-and-validation.md       # Connection rules, port validation
│   ├── multi-view-sync.md             # Circuit/Schematic/3D/Scope synchronization
│   ├── learn-mode.md                  # Tutorial system, step validation, completion
│   ├── circuit-health.md              # Validation, error detection, feedback
│   ├── chip-system.md                 # Pattern recognition, library, hierarchy
│   ├── determinism-tools.md           # Recording, replay, verification
│   └── export-future.md               # Placeholder: Verilog/BOM/PDF exports
│
├── /03-product/                       # Product & UX documentation
│   ├── user-workflows.md              # Build, debug, learn flows
│   ├── onboarding-and-ux.md           # First-run experience, tooltips
│   └── public-demo-mode.md            # Demo constraints, public site behavior
│
├── /04-company/                       # Business & organizational docs
│   ├── company-why.md                 # Life's work framing, mission
│   ├── llc-and-ops.md                 # LLC, banking, accounting, IP stance
│   ├── fundraising-qa.md              # Investor questions, grounded answers
│   └── positioning.md                 # Education + professional tool strategy
│
├── /05-archive/                       # Historical documents (preserved)
│   ├── README.md                      # What's archived and why
│   ├── /session-logs/
│   │   ├── SESSION_SUMMARY.md
│   │   └── STAGE0_COMPLETE.md
│   ├── /pdf-versions/
│   │   ├── product-spec-v1.pdf
│   │   ├── product-spec-v2.pdf
│   │   └── ...
│   └── /obsolete/
│       └── (old docs that are no longer relevant)
│
└── /99-placeholders/                  # Future docs (clearly marked)
    ├── README.md                      # Trigger conditions for each placeholder
    ├── verilog-export.md              # PLANNED: Not implemented
    ├── collaboration-system.md        # PLANNED: Multi-user future
    ├── cloud-sync.md                  # PLANNED: Optional cloud features
    └── integrity-layer.md             # PLANNED: Cryptographic verification
```

## Documentation by Audience

### End Users
- `/docs/README.md` → Quick start
- `/docs/03-product/user-workflows.md` → How to use
- `/docs/03-product/onboarding-and-ux.md` → First steps

### New Contributors
- `/docs/01-dev/dev-setup.md` → Get running
- `/docs/01-dev/repo-tour.md` → Understand structure
- `/docs/01-dev/coding-standards.md` → How we write code

### Technical Auditors
- `/docs/00-canon/03-system-architecture.md` → High-level design
- `/docs/02-systems/*.md` → Deep subsystem knowledge
- `/docs/00-canon/06-owners-manual.md` → "Can rebuild from scratch"

### Investors / Stakeholders
- `/docs/00-canon/00-project-identity.md` → What problem we solve
- `/docs/04-company/company-why.md` → Mission & vision
- `/docs/04-company/fundraising-qa.md` → Due diligence answers

### Future Self (1 year from now)
- `/docs/00-canon/06-owners-manual.md` → Complete system understanding
- `/docs/05-archive/` → Why decisions were made
- `/docs/02-systems/*.md` → How each piece works

## Documentation Principles

1. **Grounded in Reality**: Never document features that don't exist
2. **Auditability**: Link every claim to actual code files
3. **Durable Tone**: No hype, no marketing, just facts
4. **Explicit Uncertainty**: Mark TODOs, PLANNEDs, and unknowns clearly
5. **Traceability**: Maps from concepts → files → functions
6. **Historical Context**: Archive old docs, don't delete them

## File Naming Conventions

- **Canonical docs**: Numbered `00-`, `01-`, etc. for reading order
- **System docs**: Kebab-case, one file per subsystem
- **Placeholders**: Same naming as canonical, marked "PLANNED" in title
- **Archives**: Original filename + date or version suffix

## Status Labels

Every document should have a status marker:

- **CANONICAL**: Source of truth, actively maintained
- **CURRENT**: Accurate as of last edit, may need updates
- **PLANNED**: Not yet implemented, design document
- **ARCHIVED**: Historical record, no longer current
- **STUB**: Placeholder needing expansion

## Next Steps

1. Create all directories
2. Move existing docs to new structure
3. Write canonical docs (/00-canon/)
4. Write developer docs (/01-dev/)
5. Write system deep-dives (/02-systems/)
6. Create traceability maps
7. Archive duplicates
8. Generate `_INDEX.json` for programmatic access
