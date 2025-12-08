# ADR-0001: Monorepo Structure with pnpm Workspaces

**Status:** Accepted
**Date:** 2025-12-08
**Deciders:** Engineering Team
**Context:** Genesis v1 Architecture

---

## Context

RedByte OS Genesis requires:
1. **Modular packages** — Core logic engine separate from UI rendering
2. **Shared utilities** — Theme, tokens, primitives reused across apps
3. **Multiple entry points** — Playground app, documentation site, future apps
4. **Independent versioning** — Packages may evolve at different rates

We need a repository structure that supports:
- **Code sharing** without creating tightly-coupled dependencies
- **Fast builds** with efficient caching
- **Type safety** across package boundaries
- **Independent publishing** to npm

---

## Decision

We adopt a **monorepo architecture** using **pnpm workspaces** with the following structure:

```
/redbyte-ui
  /packages
    /rb-logic-core     — Pure logic engine (no UI)
    /rb-logic-view     — 2D canvas renderer
    /rb-logic-3d       — 3D visualization
    /rb-logic-adapter  — Adapter utilities
    /rb-shell          — OS shell, windowing system
    /rb-apps           — Built-in applications
    /rb-windowing      — Window management state
    /rb-utils          — Shared utilities
    /rb-theme          — Theming system
    /rb-tokens         — Design tokens
    /rb-primitives     — Base UI components
    /rb-icons          — Icon library
  /apps
    /playground        — Main entry point (Vite app)
  /tools
    /config            — Shared build configs
  /docs                — Documentation
  pnpm-workspace.yaml
  package.json
```

### Key Principles

1. **Strict Package Boundaries**
   - Packages in `/packages` MUST NOT import from `/apps`
   - No circular dependencies
   - Cross-package imports use package names (e.g., `@redbyte/rb-utils`), NOT relative paths

2. **Dependency Flow**
   ```
   rb-apps → rb-shell → rb-windowing → rb-primitives → rb-tokens
   rb-apps → rb-logic-view → rb-logic-core
   rb-apps → rb-logic-3d → rb-logic-core
   ```

3. **React Externalization**
   - React MUST be a `peerDependency` in all packages
   - React MUST be in `devDependencies` for development
   - Build tools MUST externalize React (no bundling)

4. **Shared Configuration**
   - TypeScript: `tsconfig.base.json` extended by all packages
   - Vite: `/tools/config/vite.lib.config.ts` for library builds
   - ESLint: Root `.eslintrc.json` extended by packages

---

## Alternatives Considered

### Alternative 1: Polyrepo (Separate Repositories)

**Pros:**
- Complete independence
- Simpler CI (per-repo)
- No cross-package versioning issues

**Cons:**
- Harder to coordinate changes across packages
- Duplicate build configuration
- Difficult to test integrations locally
- Slower developer iteration (need to publish, install, test)

**Rejected:** Too slow for rapid development.

### Alternative 2: Lerna Monorepo

**Pros:**
- Mature tooling
- Wide adoption

**Cons:**
- Slower than pnpm (no symlink-based installs)
- More complex configuration
- Overlaps with pnpm workspace features

**Rejected:** pnpm is faster and simpler.

### Alternative 3: Nx Monorepo

**Pros:**
- Advanced caching
- Task orchestration
- Dependency graph visualization

**Cons:**
- Heavyweight for our use case
- Learning curve for contributors
- Opinionated project structure

**Rejected:** Over-engineered for Genesis v1.

---

## Consequences

### Positive

- **Fast installs**: pnpm uses symlinks, reducing disk space and install time
- **Type safety**: TypeScript resolves types across packages seamlessly
- **Atomic changes**: Multi-package changes in a single commit/PR
- **Consistent tooling**: All packages share ESLint, Prettier, TypeScript configs
- **Easy local testing**: Changes to `rb-logic-core` immediately available to `rb-apps`

### Negative

- **Build orchestration**: Must ensure correct build order (handled by pnpm topological sort)
- **Versioning complexity**: Need Changesets to coordinate releases
- **CI parallelization**: Must configure CI to build packages in parallel where possible

### Neutral

- **Learning curve**: Contributors must understand workspace structure
- **Tooling setup**: Initial setup cost (pnpm, workspaces, changesets)

---

## Implementation

### 1. Workspace Configuration

**pnpm-workspace.yaml:**
```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

**Root package.json:**
```json
{
  "scripts": {
    "build": "pnpm -r run build",
    "lint": "pnpm -r run lint",
    "typecheck": "pnpm -r run typecheck",
    "test": "pnpm -r run test"
  }
}
```

### 2. Package Naming

All packages use the `@redbyte/` scope:
- `@redbyte/rb-logic-core`
- `@redbyte/rb-shell`
- etc.

### 3. Dependency Management

**Adding a dependency to a package:**
```bash
pnpm --filter @redbyte/rb-apps add zustand
```

**Adding a workspace dependency:**
```bash
pnpm --filter @redbyte/rb-apps add @redbyte/rb-utils
```

**Installing all dependencies:**
```bash
pnpm install
```

### 4. Build Order

pnpm automatically builds packages in topological order based on dependencies:

```bash
pnpm -r run build
# Builds in order:
# 1. rb-tokens, rb-icons (no deps)
# 2. rb-primitives (depends on rb-tokens)
# 3. rb-windowing (depends on rb-primitives)
# 4. rb-shell (depends on rb-windowing)
# 5. rb-apps (depends on rb-shell)
```

---

## Validation

### Success Metrics

1. **Build time < 2 minutes** for clean build (all packages)
2. **Install time < 30 seconds** for clean install
3. **Hot reload < 500ms** for app dev server after package change
4. **Type errors caught** before runtime (cross-package TypeScript)

### Testing

- [x] All packages build successfully with `pnpm build`
- [x] TypeScript resolves types across packages
- [x] React is NOT bundled in any package
- [x] CI builds all packages in parallel
- [x] Changesets can version packages independently

---

## References

- [pnpm Workspaces Documentation](https://pnpm.io/workspaces)
- [Changesets Documentation](https://github.com/changesets/changesets)
- [Vite Library Mode](https://vitejs.dev/guide/build.html#library-mode)

---

## Revisions

- **2025-12-08**: Initial ADR for Genesis v1
