# Definition of Done (DoD)

**Version:** 1.0.0
**Last Updated:** 2025-12-08

> This document defines the quality gates that MUST be met before any code is considered "done" and ready for merge to `main`.

---

## 1. Code Quality

### 1.1 TypeScript Compliance

- [ ] **All code passes TypeScript strict mode**
  - `"strict": true` in `tsconfig.json`
  - No `@ts-ignore` or `@ts-nocheck` comments
  - No `any` types (except in `any` generic constraints)

- [ ] **All packages build successfully**
  ```bash
  pnpm build
  # All packages MUST build without errors
  ```

### 1.2 Linting

- [ ] **ESLint passes with zero errors**
  ```bash
  pnpm lint
  # Exit code MUST be 0
  ```

- [ ] **No console warnings in production builds**
  - `console.log()`, `console.warn()` removed or behind debug flags
  - Exceptions: `console.error()` for critical errors

### 1.3 Code Style

- [ ] **Prettier formatting applied**
  - No manual spacing/indentation adjustments
  - All files formatted via `pnpm format` or IDE auto-format

- [ ] **No commented-out code blocks**
  - Exception: Brief explanatory comments for complex logic
  - No unused imports or variables

### 1.4 Dependencies

- [ ] **React is externalized (NEVER bundled)**
  ```bash
  # Verify in dist/ files:
  grep -r 'import { useState }' packages/*/dist/*.js
  # MUST show imports, not bundled code
  ```

- [ ] **Package boundaries respected**
  - No circular dependencies
  - No imports from `/apps` in `/packages`
  - No cross-package relative imports (use package names)

---

## 2. Testing

### 2.1 Unit Tests

- [ ] **Core logic packages have ≥90% coverage**
  - `rb-logic-core`: 90%+
  - `rb-windowing`: 80%+
  - `rb-utils`: 80%+

  ```bash
  pnpm test --coverage
  # Check coverage reports
  ```

- [ ] **All tests pass**
  ```bash
  pnpm test
  # Exit code MUST be 0
  ```

- [ ] **No flaky tests**
  - Tests MUST pass consistently (5 consecutive runs)

### 2.2 Integration Tests

- [ ] **Critical user flows tested**
  - First-run welcome window
  - Tutorial step navigation
  - Circuit save/load from localStorage
  - Circuit share URL encoding/decoding

### 2.3 E2E Tests (Playwright)

- [ ] **Screenshot capture works**
  ```bash
  pnpm run capture:screenshots
  # All screenshots generated without errors
  ```

- [ ] **Visual regression baseline**
  - Screenshots stored in `tests/screenshots/`
  - No unexpected visual changes

---

## 3. Documentation

### 3.1 Code Documentation

- [ ] **Public APIs have JSDoc comments**
  - All exported functions have `@param`, `@returns`
  - Complex algorithms have inline explanations

- [ ] **README.md up to date**
  - Installation steps current
  - Example usage reflects latest API

### 3.2 Spec Compliance

- [ ] **Changes comply with `genesis.md` spec**
  - No breaking changes to immutable APIs
  - Schema versions match (e.g., `SerializedCircuitV1`)

### 3.3 Changelogs

- [ ] **Changeset created (if applicable)**
  ```bash
  pnpm changeset
  # For features, fixes, or breaking changes
  ```

- [ ] **RELEASE.md checklist followed** (for releases)

---

## 4. Functionality

### 4.1 Feature Completeness

- [ ] **Feature works as specified**
  - User story acceptance criteria met
  - Edge cases handled (empty inputs, max limits, etc.)

- [ ] **No regressions**
  - Existing features still work
  - No new bugs introduced

### 4.2 Error Handling

- [ ] **Errors fail gracefully**
  - User-facing error messages (not stack traces)
  - Toast notifications for user actions
  - Console errors for developers

- [ ] **Invalid inputs handled**
  - Malformed URLs
  - Corrupt localStorage data
  - Missing files

### 4.3 Performance

- [ ] **No performance degradation**
  - 60 Hz simulation maintained for <100 node circuits
  - Bundle size within limits (see `genesis.md` §14.3)

---

## 5. User Experience

### 5.1 UI/UX Polish

- [ ] **Consistent design**
  - Colors match design tokens (`rb-tokens`)
  - Typography follows brand guidelines (`docs/brand.md`)
  - Spacing uses 4px/8px grid

- [ ] **Responsive behavior**
  - Windows resize gracefully
  - No horizontal scrollbars (except in scrollable containers)

- [ ] **Loading states**
  - Spinners or skeleton screens for async operations
  - No flash of empty content

### 5.2 Accessibility

- [ ] **Keyboard navigation works**
  - Tab order is logical
  - Focus indicators visible
  - Escape key closes modals/overlays

- [ ] **Screen reader friendly**
  - Images have `alt` attributes
  - Buttons have descriptive labels
  - Toast notifications use `role="status"`

- [ ] **Color contrast meets WCAG AA**
  - Text contrast ratio ≥4.5:1
  - Error states use color + icon

---

## 6. Security

### 6.1 Input Sanitization

- [ ] **User input is sanitized**
  - File names
  - Circuit names
  - URL parameters

- [ ] **No XSS vulnerabilities**
  - No `dangerouslySetInnerHTML` (without sanitization)
  - No `eval()` or `new Function()`

### 6.2 Data Privacy

- [ ] **No sensitive data logged**
  - No PII in console.log
  - No user data sent to servers

- [ ] **LocalStorage namespaced**
  - Keys prefixed with `rb-os:v1:`
  - No collisions with other apps

---

## 7. Git & CI/CD

### 7.1 Commit Quality

- [ ] **Commit messages are descriptive**
  - Format: `Type: Brief description`
  - Examples:
    - `feat: Add Share button with clipboard support`
    - `fix: Resolve React bundling in rb-shell`
    - `docs: Update genesis.md with tutorial API`

- [ ] **Commits co-authored**
  - All commits include:
    ```
    Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
    ```

### 7.2 Branch Strategy

- [ ] **Feature branch from `main`**
  - Branch naming: `feature/`, `fix/`, `docs/`
  - Example: `feature/stage-k2-l-final-genesis`

- [ ] **No merge conflicts**
  - Resolve conflicts before creating PR
  - Prefer rebase over merge commits

### 7.3 CI Checks

- [ ] **All CI workflows pass**
  - Build (`pnpm build`)
  - Lint (`pnpm lint`)
  - Typecheck (`pnpm typecheck`)
  - Test (`pnpm test`)
  - Publish check (`npm publish --dry-run`)

- [ ] **No CI warnings**
  - Deprecation warnings addressed
  - Dependency vulnerabilities resolved

---

## 8. Pull Request

### 8.1 PR Description

- [ ] **Summary of changes**
  - What was changed and why
  - Link to related issues (if any)

- [ ] **Breaking changes noted**
  - Migration steps provided (if applicable)

- [ ] **Screenshots/videos for UI changes**
  - Before/after comparisons
  - Tutorial flow demos

### 8.2 Review Process

- [ ] **Self-review completed**
  - Code re-read for clarity
  - No debug code or TODOs left behind

- [ ] **Tests reviewed**
  - Test cases cover new functionality
  - No redundant or duplicate tests

### 8.3 Merge Requirements

- [ ] **Approved by reviewer** (if team workflow requires)
- [ ] **Squash or rebase** (no merge commits)
- [ ] **Delete branch after merge**

---

## 9. Deployment

### 9.1 NPM Publish (for package releases)

- [ ] **Dry-run succeeds**
  ```bash
  npm publish --dry-run
  # No errors, tarball contents verified
  ```

- [ ] **Version bump follows SemVer**
  - MAJOR: Breaking changes
  - MINOR: New features
  - PATCH: Bug fixes

- [ ] **Changelog updated**
  - Entry added to `CHANGELOG.md` (if exists)
  - Changesets committed

### 9.2 Cloudflare Pages

- [ ] **Docs deployment succeeds**
  - No build errors
  - Site accessible at `https://redbyte-docs.pages.dev`

### 9.3 GitHub Pages

- [ ] **Playground deployment succeeds**
  - No build errors
  - App loads at `https://swaggyp52.github.io/redbyte-ui`

---

## 10. Cleanup

### 10.1 No Dead Code

- [ ] **Unused files removed**
  - Old components
  - Deprecated utilities
  - Test fixtures no longer needed

- [ ] **Unused dependencies removed**
  ```bash
  pnpm list
  # Check for unused packages
  ```

### 10.2 No Temporary Hacks

- [ ] **No `// TODO:` comments** (or tracked in GitHub Issues)
- [ ] **No `// HACK:` comments** (or documented with explanation)
- [ ] **No feature flags for completed work**

---

## 11. Stage-Specific Checklists

### Stage K: Genesis Experience

- [ ] Welcome window shows on first run
- [ ] Tutorial overlay renders correctly
- [ ] Share button copies URL to clipboard
- [ ] Shared circuits load from URL
- [ ] Toast notifications appear for all actions

### Stage L: Documentation

- [ ] `genesis.md` spec is immutable and complete
- [ ] `dod.md` is up to date
- [ ] ADRs document all architectural decisions
- [ ] CI includes DoD checks

---

## 12. Final Verification

Before marking any task as "done", verify:

```bash
# 1. Build
pnpm build

# 2. Lint
pnpm lint

# 3. Typecheck
pnpm typecheck

# 4. Test
pnpm test

# 5. Publish check
pnpm -r exec npm publish --dry-run

# 6. Visual check
pnpm run capture:screenshots
```

If ALL commands pass with exit code 0, the work is **DONE**.

---

## Appendix: Common Pitfalls

### ❌ Anti-Patterns

- **Bundling React in packages** → Use `external: ['react', 'react-dom']` in Vite config
- **Hardcoded file paths** → Use relative paths or environment variables
- **Magic numbers** → Extract to constants or design tokens
- **Nested ternaries** → Extract to if/else or helper functions
- **200+ line functions** → Break into smaller functions
- **Global state mutations** → Use Zustand or React state

### ✅ Best Practices

- **Prefer composition over inheritance**
- **Keep components under 150 lines**
- **Extract complex logic to hooks or utilities**
- **Use TypeScript enums for state machines**
- **Write tests for edge cases first**

---

**END OF DEFINITION OF DONE v1.0.0**

Use this checklist for ALL pull requests to ensure consistent quality.
