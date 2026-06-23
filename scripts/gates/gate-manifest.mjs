#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

const DEFAULT_TIMEOUT_MS = 300_000;
const BUILD_TIMEOUT_MS = 900_000;
const CLASSROOM_SUITE = 'classroom:gate';
const VERIFY_CLASSROOM_SUITE = 'verify:gates:classroom';
const VERIFY_LEGACY_SUITE = 'verify:gates:legacy';

const classroomRequired = [
  ['build', 'pnpm build', { owner: 'build', category: 'release identity', timeoutMs: BUILD_TIMEOUT_MS }],
  ['verify:truth-integration-gate', 'pnpm -s verify:truth-integration-gate', { owner: 'verify', category: 'domain/unit' }],
  ['ide:gate:examples-contract', 'pnpm -s ide:gate:examples-contract', { owner: 'project', category: 'product workflow' }],
  ['ide:gate:project-command-center', 'pnpm -s ide:gate:project-command-center', { owner: 'project', category: 'product workflow' }],
  ['ide:gate:project-command-center-v2', 'pnpm -s ide:gate:project-command-center-v2', { owner: 'project', category: 'product workflow' }],
  ['ide:gate:project-loaded-paths-first-viewport', 'pnpm -s ide:gate:project-loaded-paths-first-viewport', { owner: 'project', category: 'visual geometry' }],
  ['ide:gate:project-loaded-command-surface', 'pnpm -s ide:gate:project-loaded-command-surface', { owner: 'project', category: 'product workflow' }],
  ['ide:gate:interaction-affordance', 'pnpm -s ide:gate:interaction-affordance', { owner: 'project', category: 'product workflow' }],
  ['ide:gate:project-identity-editing', 'pnpm -s ide:gate:project-identity-editing', { owner: 'project', category: 'product workflow' }],
  ['ide:gate:v2-student-chrome', 'pnpm -s ide:gate:v2-student-chrome', { owner: 'shell', category: 'product workflow' }],
  ['ide:gate:active-mode-reload-recovery', 'pnpm -s ide:gate:active-mode-reload-recovery', { owner: 'shell', category: 'durability' }],
  ['ide:gate:student-loop-contract', 'pnpm -s ide:gate:student-loop-contract', { owner: 'workflow', category: 'product workflow' }],
  ['ide:gate:student-task-completion-flow', 'pnpm -s ide:gate:student-task-completion-flow', { owner: 'workflow', category: 'product workflow' }],
  ['ide:gate:authoring-depth-release-safety', 'pnpm -s ide:gate:authoring-depth-release-safety', { owner: 'workflow', category: 'product workflow' }],
  ['ide:gate:design-wire-interaction-contract', 'pnpm -s ide:gate:design-wire-interaction-contract', { owner: 'design', category: 'product workflow' }],
  ['ide:gate:design-no-bridge-required', 'pnpm -s ide:gate:design-no-bridge-required', { owner: 'design', category: 'product workflow' }],
  ['ide:gate:design-canvas-zoom-integrity', 'pnpm -s ide:gate:design-canvas-zoom-integrity', { owner: 'design', category: 'visual geometry' }],
  ['ide:gate:design-workbench-integrity', 'pnpm -s ide:gate:design-workbench-integrity', { owner: 'design', category: 'product workflow' }],
  ['ide:gate:design-canvas-direct-workbench', 'pnpm -s ide:gate:design-canvas-direct-workbench', { owner: 'design', category: 'visual geometry' }],
  ['ide:gate:design-workspace-crash-proof', 'pnpm -s ide:gate:design-workspace-crash-proof', { owner: 'design', category: 'durability' }],
  ['ide:gate:workbench-stability-overhaul', 'pnpm -s ide:gate:workbench-stability-overhaul', { owner: 'shell', category: 'durability' }],
  ['ide:gate:design-correctness-contract', 'pnpm -s ide:gate:design-correctness-contract', { owner: 'design', category: 'semantic browser' }],
  ['ide:gate:design-palette-build-contract', 'pnpm -s ide:gate:design-palette-build-contract', { owner: 'design', category: 'product workflow' }],
  ['ide:gate:verify-reality-contract', 'pnpm -s ide:gate:verify-reality-contract', { owner: 'verify', category: 'semantic browser' }],
  ['ide:gate:verify-saved-checks-default', 'pnpm -s ide:gate:verify-saved-checks-default', { owner: 'verify', category: 'semantic browser' }],
  ['ide:gate:verify-v2-authority-cutover', 'pnpm -s ide:gate:verify-v2-authority-cutover', { owner: 'verify', category: 'semantic browser' }],
  ['ide:gate:verify-authority-phase-3d', 'pnpm -s ide:gate:verify-authority-phase-3d', { owner: 'verify', category: 'semantic browser' }],
  ['ide:gate:verify-sequential-authority-v2', 'pnpm -s ide:gate:verify-sequential-authority-v2', { owner: 'verify', category: 'semantic browser' }],
  ['ide:gate:verify-accessibility-v2', 'pnpm -s ide:gate:verify-accessibility-v2', { owner: 'verify', category: 'accessibility' }],
  ['ide:gate:verify-keyboard-grid-v2', 'pnpm -s ide:gate:verify-keyboard-grid-v2', { owner: 'verify', category: 'accessibility' }],
  ['ide:gate:verify-zoom-contrast-v2', 'pnpm -s ide:gate:verify-zoom-contrast-v2', { owner: 'verify', category: 'accessibility' }],
  ['ide:gate:project-durability-v2', 'pnpm -s ide:gate:project-durability-v2', { owner: 'project', category: 'durability' }],
  ['ide:gate:verify-corrupt-state-recovery-v2', 'pnpm -s ide:gate:verify-corrupt-state-recovery-v2', { owner: 'verify', category: 'durability' }],
  ['ide:gate:verify-multitab-conflict-v2', 'pnpm -s ide:gate:verify-multitab-conflict-v2', { owner: 'project', category: 'durability' }],
  ['ide:gate:diagnostics-bundle-v2', 'pnpm -s ide:gate:diagnostics-bundle-v2', { owner: 'diagnostics', category: 'release identity' }],
  ['ide:gate:project-storage-facade-v2', 'pnpm -s ide:gate:project-storage-facade-v2', { owner: 'project', category: 'durability' }],
  ['gate:project-storage-authority', 'pnpm -s gate:project-storage-authority', { owner: 'project', category: 'durability', semanticOrStructural: 'semantic' }],
  ['ide:gate:atomic-save-journal-v2', 'pnpm -s ide:gate:atomic-save-journal-v2', { owner: 'project', category: 'durability' }],
  ['ide:gate:project-schema-migration-v2', 'pnpm -s ide:gate:project-schema-migration-v2', { owner: 'project', category: 'durability' }],
  ['ide:gate:project-quota-recovery-v2', 'pnpm -s ide:gate:project-quota-recovery-v2', { owner: 'project', category: 'durability' }],
  ['ide:gate:project-multitab-conflict-v2', 'pnpm -s ide:gate:project-multitab-conflict-v2', { owner: 'project', category: 'durability' }],
  ['ide:gate:dirty-update-guard-v2', 'pnpm -s ide:gate:dirty-update-guard-v2', { owner: 'project', category: 'durability' }],
  ['ide:gate:project-recovery-workflow-v2', 'pnpm -s ide:gate:project-recovery-workflow-v2', { owner: 'project', category: 'durability' }],
  ['ide:gate:diagnostics-storage-v2', 'pnpm -s ide:gate:diagnostics-storage-v2', { owner: 'diagnostics', category: 'release identity' }],
  ['ide:gate:recovery-accessibility-v2', 'pnpm -s ide:gate:recovery-accessibility-v2', { owner: 'project', category: 'accessibility' }],
  ['ide:gate:verify-testbench-usable-layout', 'pnpm -s ide:gate:verify-testbench-usable-layout', { owner: 'verify', category: 'visual geometry' }],
  ['ide:gate:verify-no-circuit-task-first', 'pnpm -s ide:gate:verify-no-circuit-task-first', { owner: 'verify', category: 'product workflow' }],
  ['ide:gate:verify-workbench-layout-reset', 'pnpm -s ide:gate:verify-workbench-layout-reset', { owner: 'verify', category: 'visual geometry' }],
  ['ide:gate:verify-postrun-workbench-usability', 'pnpm -s ide:gate:verify-postrun-workbench-usability', { owner: 'verify', category: 'visual geometry' }],
  ['ide:gate:verify-evidence-workbench-integrity', 'pnpm -s ide:gate:verify-evidence-workbench-integrity', { owner: 'verify', category: 'visual geometry' }],
  ['ide:gate:export-download-contract', 'pnpm -s ide:gate:export-download-contract', { owner: 'export', category: 'product workflow' }],
  ['ide:gate:export-artifact-workspace-v2', 'pnpm -s ide:gate:export-artifact-workspace-v2', { owner: 'export', category: 'product workflow' }],
  ['ide:gate:export-handoff-station', 'pnpm -s ide:gate:export-handoff-station', { owner: 'export', category: 'product workflow' }],
  ['ide:gate:export-first-viewport-artifacts', 'pnpm -s ide:gate:export-first-viewport-artifacts', { owner: 'export', category: 'visual geometry' }],
  ['ide:gate:export-package-inspector', 'pnpm -s ide:gate:export-package-inspector', { owner: 'export', category: 'product workflow' }],
  ['ide:gate:export-workspace-density-v2', 'pnpm -s ide:gate:export-workspace-density-v2', { owner: 'export', category: 'visual geometry' }],
  ['ide:gate:export-artifact-direct-preview', 'pnpm -s ide:gate:export-artifact-direct-preview', { owner: 'export', category: 'product workflow' }],
  ['ide:gate:export-e2e-contract', 'pnpm -s ide:gate:export-e2e-contract', { owner: 'export', category: 'semantic browser' }],
  ['ide:gate:export-trust-integrity', 'pnpm -s ide:gate:export-trust-integrity', { owner: 'export', category: 'semantic browser' }],
  ['ide:gate:hardware-basys3-workbench', 'pnpm -s ide:gate:hardware-basys3-workbench', { owner: 'hardware', category: 'product workflow' }],
  ['ide:gate:hardware-first-viewport', 'pnpm -s ide:gate:hardware-first-viewport', { owner: 'hardware', category: 'visual geometry' }],
  ['ide:gate:shell-layout-integrity', 'pnpm -s ide:gate:shell-layout-integrity', { owner: 'shell', category: 'visual geometry' }],
  ['ide:gate:shell-workbench-hierarchy', 'pnpm -s ide:gate:shell-workbench-hierarchy', { owner: 'shell', category: 'visual geometry' }],
  ['ide:gate:shell-navigation-overhaul', 'pnpm -s ide:gate:shell-navigation-overhaul', { owner: 'shell', category: 'product workflow' }],
  ['ide:gate:primary-work-object-dominance', 'pnpm -s ide:gate:primary-work-object-dominance', { owner: 'shell', category: 'visual geometry' }],
  ['ide:gate:nested-scroll-regression', 'pnpm -s ide:gate:nested-scroll-regression', { owner: 'shell', category: 'visual geometry' }],
  ['ide:gate:root-overflow-regression', 'pnpm -s ide:gate:root-overflow-regression', { owner: 'shell', category: 'visual geometry' }],
  ['ide:gate:workbench-reconstruction-v1', 'pnpm -s ide:gate:workbench-reconstruction-v1', { owner: 'shell', category: 'visual geometry' }],
  ['ide:gate:design-dual-tool-windows', 'pnpm -s ide:gate:design-dual-tool-windows', { owner: 'design', category: 'visual geometry' }],
  ['ide:gate:design-library-not-cropped', 'pnpm -s ide:gate:design-library-not-cropped', { owner: 'design', category: 'visual geometry' }],
  ['ide:gate:design-tool-window-coexistence', 'pnpm -s ide:gate:design-tool-window-coexistence', { owner: 'design', category: 'visual geometry' }],
  ['ide:gate:design-workspace-v2', 'pnpm -s ide:gate:design-workspace-v2', { owner: 'design', category: 'visual geometry' }],
  ['ide:gate:verify-task-plane-usability', 'pnpm -s ide:gate:verify-task-plane-usability', { owner: 'verify', category: 'visual geometry' }],
  ['ide:gate:hardware-board-dominance', 'pnpm -s ide:gate:hardware-board-dominance', { owner: 'hardware', category: 'visual geometry' }],
  ['ide:gate:map-pins-workspace-v2', 'pnpm -s ide:gate:map-pins-workspace-v2', { owner: 'hardware', category: 'visual geometry' }],
  ['ide:gate:hardware-board-unblocked', 'pnpm -s ide:gate:hardware-board-unblocked', { owner: 'hardware', category: 'visual geometry' }],
  ['ide:gate:hardware-resource-catalog-not-obstructing', 'pnpm -s ide:gate:hardware-resource-catalog-not-obstructing', { owner: 'hardware', category: 'visual geometry' }],
  ['ide:gate:release-readiness-visual-contract', 'pnpm -s ide:gate:release-readiness-visual-contract', { owner: 'shell', category: 'visual geometry' }],
  ['ide:gate:no-cropped-controls-regression', 'pnpm -s ide:gate:no-cropped-controls-regression', { owner: 'shell', category: 'visual geometry' }],
  ['ide:gate:action-first-entry-surfaces', 'pnpm -s ide:gate:action-first-entry-surfaces', { owner: 'shell', category: 'product workflow' }],
  ['ide:gate:outer-workflow-action-density', 'pnpm -s ide:gate:outer-workflow-action-density', { owner: 'shell', category: 'visual geometry' }],
  ['ide:gate:card-chrome-regression', 'pnpm -s ide:gate:card-chrome-regression', { owner: 'shell', category: 'visual geometry' }],
  ['ide:gate:release-solidification-v2', 'pnpm -s ide:gate:release-solidification-v2', { owner: 'shell', category: 'product workflow' }],
  ['ide:gate:browser-e0-packaging-readiness', 'pnpm -s ide:gate:browser-e0-packaging-readiness', { owner: 'release', category: 'release identity' }],
  ['ide:gate:workbench-space-utilization', 'pnpm -s ide:gate:workbench-space-utilization', { owner: 'shell', category: 'visual geometry' }],
  ['ide:gate:workbench-visual-finish', 'pnpm -s ide:gate:workbench-visual-finish', { owner: 'shell', category: 'visual geometry' }],
  ['ide:gate:zip-import-contract', 'pnpm -s ide:gate:zip-import-contract', { owner: 'import', category: 'semantic browser' }],
  ['ide:gate:import-recovery-contract', 'pnpm -s ide:gate:import-recovery-contract', { owner: 'import', category: 'product workflow' }],
  ['ide:gate:import-step-workflow-v2', 'pnpm -s ide:gate:import-step-workflow-v2', { owner: 'import', category: 'product workflow' }],
  ['ide:gate:import-guided-recovery-workflow', 'pnpm -s ide:gate:import-guided-recovery-workflow', { owner: 'import', category: 'product workflow' }],
  ['ide:gate:import-guided-recovery-wizard', 'pnpm -s ide:gate:import-guided-recovery-wizard', { owner: 'import', category: 'product workflow' }],
  ['ide:gate:outer-workflow-continuity-v2', 'pnpm -s ide:gate:outer-workflow-continuity-v2', { owner: 'workflow', category: 'product workflow' }],
  [
    'determinism-and-parity-suite',
    'pnpm exec vitest run packages/rb-lab-engine/src/__tests__/verifyTruthTable.schedule.test.ts packages/rb-apps/src/export/__tests__/ideSubmissionDeterminism.test.ts packages/rb-apps/src/__tests__/lab-submission-gates.test.ts packages/rb-apps/src/__tests__/submission-inspector-submission-bundle.test.tsx packages/rb-apps/src/import/__tests__/fixture03-sequential-parity.test.ts packages/rb-apps/src/export/__tests__/parseIdeSubmission.test.ts',
    { owner: 'export', category: 'domain/unit', timeoutMs: 600_000 },
  ],
];

const verifyCurrentFocused = [
  ['gate:manifest:validate', 'pnpm -s gate:manifest:validate', { owner: 'gates', category: 'domain/unit' }],
  ['gate:no-hardcoded-redbyte-test-ports', 'pnpm -s gate:no-hardcoded-redbyte-test-ports', { owner: 'gates', category: 'domain/unit' }],
  ['ci:no-solution:lab1', 'pnpm -s ci:no-solution:lab1', { owner: 'course', category: 'domain/unit' }],
  ['ci:no-solution:lab2', 'pnpm -s ci:no-solution:lab2', { owner: 'course', category: 'domain/unit' }],
  ['ci:no-solution:lab3', 'pnpm -s ci:no-solution:lab3', { owner: 'course', category: 'domain/unit' }],
  ['classroom:rehearse:lab4', 'pnpm -s classroom:rehearse:lab4', { owner: 'course', category: 'rehearsal' }],
  ['ci:no-solution:lab4', 'pnpm -s ci:no-solution:lab4', { owner: 'course', category: 'domain/unit' }],
  ['ci:no-solution:lab5', 'pnpm -s ci:no-solution:lab5', { owner: 'course', category: 'domain/unit' }],
  ['ci:no-solution:lab6', 'pnpm -s ci:no-solution:lab6', { owner: 'course', category: 'domain/unit' }],
  ['ci:no-solution:lab7', 'pnpm -s ci:no-solution:lab7', { owner: 'course', category: 'domain/unit' }],
  ['ci:no-solution:lab8', 'pnpm -s ci:no-solution:lab8', { owner: 'course', category: 'domain/unit' }],
  ['lab:profile-contract', 'pnpm -s lab:profile-contract', { owner: 'course', category: 'domain/unit' }],
  ['rc:e1:golden-basys3-export-gate', 'pnpm -s rc:e1:golden-basys3-export-gate', { owner: 'export', category: 'domain/unit' }],
  ['rc:e1:golden-basys3-alu-export-gate', 'pnpm -s rc:e1:golden-basys3-alu-export-gate', { owner: 'export', category: 'domain/unit' }],
  ['ui:dev-guards-contract-gate', 'pnpm -s ui:dev-guards-contract-gate', { owner: 'dev-guards', category: 'domain/unit' }],
  ['gates:ide-boot-shadow-contract', 'pnpm -s gates:ide-boot-shadow-contract', { owner: 'shell', category: 'product workflow' }],
  ['ide:gate:lab4-load-fast', 'pnpm -s ide:gate:lab4-load-fast', { owner: 'course', category: 'product workflow' }],
  ['ide:gate:export-generates-hdl', 'pnpm -s ide:gate:export-generates-hdl', { owner: 'export', category: 'semantic browser' }],
  ['ide:gate:import-renders-schematic', 'pnpm -s ide:gate:import-renders-schematic', { owner: 'import', category: 'semantic browser' }],
];

const retiredGates = [
  retired('classroom:smoke:labs-5-8', 'pnpm -s classroom:smoke:labs-5-8', 'course', 'Lab 8 bridge no-solution coverage now lives in dedicated no-solution/profile gates; old smoke falsely treats unconnected placeholder gates as a solved scaffold.', ['ci:no-solution:lab5', 'ci:no-solution:lab6', 'ci:no-solution:lab7', 'ci:no-solution:lab8', 'lab:profile-contract'], 'C'),
  retired('ide:gate:route-contract', 'pnpm -s ide:gate:route-contract', 'shell', 'Hardcoded localhost:5173 route smoke is superseded by dynamic shared-harness route/reload/history coverage.', ['ide:gate:active-mode-reload-recovery', 'ide:gate:shell-navigation-overhaul'], 'D'),
  retired('ide:gate:default-launcher-hidden', 'pnpm -s ide:gate:default-launcher-hidden', 'shell', 'Hardcoded localhost:5173 default-launcher contract targets a retired launcher/chrome path.', ['ide:gate:v2-student-chrome', 'ide:gate:final-current-build-smoke'], 'D'),
  retired('ide:gate:layout-contract', 'pnpm -s ide:gate:layout-contract', 'shell', 'Old rail-width structural contract conflicts with V2 compact shell measurements.', ['ide:gate:shell-layout-integrity', 'ide:gate:v2-student-chrome'], 'C'),
  retired('ide:gate:workbench-layout-contract', 'pnpm -s ide:gate:workbench-layout-contract', 'shell', 'Old contract requires generic left docks in modes where V2 fixed workspaces replaced them.', ['ide:gate:shell-workbench-hierarchy', 'ide:gate:workbench-reconstruction-v1'], 'C'),
  retired('ide:gate:visual-contract', 'pnpm -s ide:gate:visual-contract', 'shell', 'Old visual contract requires V1 left dock structure and is superseded by V2 visual/work-object gates.', ['ide:gate:v2-student-chrome', 'ide:gate:primary-work-object-dominance', 'ide:gate:card-chrome-regression'], 'C'),
  retired('ide:gate:shell-structure', 'pnpm -s ide:gate:shell-structure', 'shell', 'Old shell structure contract looks for retired mode markers/chrome instead of V2 primitives.', ['ide:gate:shell-layout-integrity', 'ide:gate:shell-navigation-overhaul'], 'C'),
  retired('ide:gate:design-build-contract', 'pnpm -s ide:gate:design-build-contract', 'design', 'Old Design build gate expects the hidden zoom-stat element as visible proof; V2 proves direct canvas and build readiness elsewhere.', ['ide:gate:design-workbench-integrity', 'ide:gate:design-canvas-direct-workbench'], 'C'),
  retired('ide:gate:design-workbench-contract', 'pnpm -s ide:gate:design-workbench-contract', 'design', 'Old Design workbench gate requires a V1 right-inspector marker instead of the fixed/contextual V2 workbench contract.', ['ide:gate:design-workbench-integrity', 'ide:gate:design-tool-window-coexistence'], 'C'),
  retired('ide:gate:design-fit-contract', 'pnpm -s ide:gate:design-fit-contract', 'design', 'Old visible fit-control assertion is superseded by direct canvas and zoom-integrity V2 gates.', ['ide:gate:design-canvas-direct-workbench', 'ide:gate:design-canvas-zoom-integrity'], 'C'),
  retired('ide:gate:canvas-legibility-contract', 'pnpm -s ide:gate:canvas-legibility-contract', 'design', 'Old zoom-indicator visibility contract is superseded by no-cropped-controls and direct canvas proof.', ['ide:gate:no-cropped-controls-regression', 'ide:gate:design-canvas-direct-workbench'], 'C'),
  retired('ide:gate:verify-workbench-contract', 'pnpm -s ide:gate:verify-workbench-contract', 'verify', 'Old Verify workbench path waits on pre-V2 side/workbench conditions; V2 coverage is split across authority, testbench, postrun, and task-plane gates.', ['ide:gate:verify-v2-authority-cutover', 'ide:gate:verify-testbench-usable-layout', 'ide:gate:verify-workbench-layout-reset', 'ide:gate:verify-postrun-workbench-usability', 'ide:gate:verify-task-plane-usability'], 'C'),
  retired('ide:gate:export-blockers-contract', 'pnpm -s ide:gate:export-blockers-contract', 'export', 'Old Export blocker-list assertion targets a retired blocker panel while V2 Export uses handoff/readiness/artifact workspace authority.', ['ide:gate:export-handoff-station', 'ide:gate:export-trust-integrity', 'ide:gate:export-ready-contract'], 'C'),
  retired('ide:gate:hardware-checklist-contract', 'pnpm -s ide:gate:hardware-checklist-contract', 'hardware', 'Old Hardware checklist panel assertion targets retired panel structure; V2 Map Pins is covered by board/table/resource gates.', ['ide:gate:hardware-basys3-workbench', 'ide:gate:hardware-first-viewport', 'ide:gate:hardware-board-unblocked'], 'C'),
  retired('ide:gate:primary-cta-contract', 'pnpm -s ide:gate:primary-cta-contract', 'workflow', 'Old universal CTA contract is too generic for V2 surface-specific primary actions.', ['ide:gate:student-task-completion-flow', 'ide:gate:action-first-entry-surfaces', 'ide:gate:verify-no-circuit-task-first'], 'C'),
  legacyDiagnostic('ide:gate:fullscreen-no-chrome', 'pnpm -s ide:gate:fullscreen-no-chrome', 'shell', 'Historical fullscreen chrome diagnostic; not a V2 merge requirement.'),
];

export const GATE_MANIFEST = [
  ...classroomRequired.map(([id, command, extra]) =>
    normalizeGate({
      id,
      command,
      status: 'current-required',
      requiredSuiteMembership: [CLASSROOM_SUITE, VERIFY_CLASSROOM_SUITE],
      ...extra,
    })
  ),
  ...verifyCurrentFocused.map(([id, command, extra]) =>
    normalizeGate({
      id,
      command,
      status: 'current-focused',
      requiredSuiteMembership: [VERIFY_CLASSROOM_SUITE],
      ...extra,
    })
  ),
  ...retiredGates.map(normalizeGate),
];

function normalizeGate(gate) {
  const browserGate = gate.command.includes('ide:gate:') || gate.command.includes('gates:ide-');
  return {
    gateId: gate.id,
    command: gate.command,
    ownerSubsystem: gate.owner ?? ownerFor(gate.id),
    category: gate.category ?? (browserGate ? 'product workflow' : 'domain/unit'),
    status: gate.status,
    requiredSuiteMembership: gate.requiredSuiteMembership ?? [],
    productInvariant: gate.productInvariant ?? invariantFor(gate.id, gate.owner),
    viewports: gate.viewports ?? (browserGate ? ['1366x768', '1440x900'] : []),
    fixtures: gate.fixtures ?? [],
    expectedRuntimeMs: gate.expectedRuntimeMs ?? gate.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    timeoutMs: gate.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    serverOwnership: gate.serverOwnership ?? (browserGate ? 'shared-preview-harness' : 'not-applicable'),
    replacement: gate.replacement ?? [],
    supersedes: gate.supersedes ?? [],
    evidenceOutputPath:
      gate.evidenceOutputPath ?? `.redbyte/proof/gate-reset/phase-3g/after/${sanitizeId(gate.id)}.log`,
    semanticOrStructural: gate.semanticOrStructural ?? (gate.category === 'visual geometry' ? 'structural' : 'semantic'),
    retirementReason: gate.retirementReason,
    failureCategory: gate.failureCategory,
  };
}

function retired(id, command, owner, retirementReason, replacement, failureCategory) {
  return {
    id,
    command,
    owner,
    category: 'legacy V1',
    status: 'retired-with-replacement',
    requiredSuiteMembership: [],
    retirementReason,
    replacement,
    failureCategory,
    semanticOrStructural: 'structural',
    serverOwnership: 'legacy-diagnostic',
  };
}

function legacyDiagnostic(id, command, owner, retirementReason) {
  return {
    id,
    command,
    owner,
    category: 'legacy V1',
    status: 'legacy-diagnostic',
    requiredSuiteMembership: [],
    retirementReason,
    semanticOrStructural: 'structural',
    serverOwnership: 'legacy-diagnostic',
  };
}

function ownerFor(id) {
  if (id.includes('verify')) return 'verify';
  if (id.includes('design')) return 'design';
  if (id.includes('export')) return 'export';
  if (id.includes('import') || id.includes('zip')) return 'import';
  if (id.includes('hardware')) return 'hardware';
  if (id.includes('project') || id.includes('examples')) return 'project';
  if (id.includes('shell') || id.includes('workbench') || id.includes('chrome')) return 'shell';
  if (id.includes('lab') || id.includes('classroom') || id.includes('no-solution')) return 'course';
  return 'release';
}

function invariantFor(id, owner) {
  const subsystem = owner ?? ownerFor(id);
  return `${subsystem} contract remains current, observable, and aligned with Product Trust Reset v2.`;
}

function sanitizeId(id) {
  return id.replace(/[^a-zA-Z0-9_.-]+/g, '-');
}

export function gatesForSuite(suiteName) {
  return GATE_MANIFEST.filter(
    (gate) =>
      gate.requiredSuiteMembership.includes(suiteName) &&
      (gate.status === 'current-required' || gate.status === 'current-focused')
  );
}

export function legacyGates() {
  return GATE_MANIFEST.filter(
    (gate) => gate.status === 'retired-with-replacement' || gate.status === 'legacy-diagnostic'
  );
}

export function validateGateManifest({ checkPorts = false } = {}) {
  const issues = [];
  const seen = new Set();
  const allowedStatuses = new Set([
    'current-required',
    'current-focused',
    'replacement-pending',
    'retired-with-replacement',
    'legacy-diagnostic',
    'quarantined-with-owner-and-ticket',
  ]);

  for (const gate of GATE_MANIFEST) {
    if (seen.has(gate.gateId)) issues.push(`${gate.gateId}: duplicate gate ID`);
    seen.add(gate.gateId);
    if (!gate.ownerSubsystem) issues.push(`${gate.gateId}: missing owner subsystem`);
    if (!allowedStatuses.has(gate.status)) issues.push(`${gate.gateId}: unknown status ${gate.status}`);
    if (gate.status === 'retired-with-replacement' && gate.replacement.length === 0) {
      issues.push(`${gate.gateId}: retired gate requires replacement`);
    }
    if (gate.requiredSuiteMembership.length > 0 && !gate.timeoutMs) {
      issues.push(`${gate.gateId}: required suite gate requires timeout`);
    }
    if (isCurrentBrowserGate(gate) && gate.serverOwnership !== 'shared-preview-harness') {
      issues.push(`${gate.gateId}: required browser gate requires shared preview harness ownership`);
    }
    const packageScript = packageScriptFromCommand(gate.command);
    if (packageScript && !packageJson.scripts?.[packageScript]) {
      issues.push(`${gate.gateId}: unknown package script ${packageScript}`);
    }
  }

  if (checkPorts) {
    for (const gate of GATE_MANIFEST.filter(isCurrentDefaultGate)) {
      const scanned = scanCommandForHardcodedPorts(gate.command);
      for (const match of scanned) {
        issues.push(`${gate.gateId}: hardcoded RedByte test port in ${match}`);
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    gateCount: GATE_MANIFEST.length,
    currentRequired: GATE_MANIFEST.filter((gate) => gate.status === 'current-required').length,
    currentFocused: GATE_MANIFEST.filter((gate) => gate.status === 'current-focused').length,
    retired: GATE_MANIFEST.filter((gate) => gate.status === 'retired-with-replacement').length,
    legacyDiagnostic: GATE_MANIFEST.filter((gate) => gate.status === 'legacy-diagnostic').length,
  };
}

function isCurrentDefaultGate(gate) {
  return (
    (gate.status === 'current-required' || gate.status === 'current-focused') &&
    gate.requiredSuiteMembership.some((suite) => suite === CLASSROOM_SUITE || suite === VERIFY_CLASSROOM_SUITE)
  );
}

function isCurrentBrowserGate(gate) {
  return isCurrentDefaultGate(gate) && (gate.command.includes('ide:gate:') || gate.command.includes('gates:ide-'));
}

function packageScriptFromCommand(command) {
  const match = command.match(/^pnpm\s+(?:-s\s+)?([^\s]+)/);
  if (!match) return null;
  const script = match[1];
  if (script === 'exec' || script === '--filter') return null;
  return script;
}

function scanCommandForHardcodedPorts(command) {
  const matches = [];
  if (/localhost:5173|127\.0\.0\.1:5173/.test(command)) {
    matches.push(`command:${command}`);
  }

  const packageScript = packageScriptFromCommand(command);
  const scriptBody = packageScript ? packageJson.scripts?.[packageScript] : command;
  if (!scriptBody) return matches;
  if (/localhost:5173|127\.0\.0\.1:5173/.test(scriptBody)) {
    matches.push(`package:${packageScript}`);
  }

  for (const sourcePath of sourcePathsFromScript(scriptBody)) {
    if (sourcePath.replace(/\\/g, '/') === 'scripts/gates/gate-manifest.mjs') {
      continue;
    }
    const absolutePath = path.join(repoRoot, sourcePath);
    if (!existsSync(absolutePath)) continue;
    const text = readFileSync(absolutePath, 'utf8');
    if (/localhost:5173|127\.0\.0\.1:5173/.test(text)) {
      matches.push(sourcePath);
    }
  }

  return matches;
}

function sourcePathsFromScript(scriptBody) {
  const paths = [];
  const nodeMatch = scriptBody.match(/node\s+\.\/([^\s]+)/);
  if (nodeMatch) paths.push(nodeMatch[1]);
  const tsxMatch = scriptBody.match(/tsx\s+\.\/([^\s]+)/);
  if (tsxMatch) paths.push(tsxMatch[1]);
  return paths;
}

export async function runGateSuite(suiteName, options = {}) {
  const validation = validateGateManifest();
  if (!validation.ok) {
    for (const issue of validation.issues) console.error(`[gate-manifest] ${issue}`);
    process.exitCode = 1;
    return;
  }

  const gates = gatesForSuite(suiteName);
  const label = options.label ?? suiteName;
  const outputDir =
    process.env.REDBYTE_GATE_PROOF_DIR ??
    path.join(repoRoot, '.redbyte', 'proof', 'gate-reset', 'phase-3g', 'after');
  mkdirSync(outputDir, { recursive: true });

  const startedUtc = new Date().toISOString();
  const suiteStart = performance.now();
  const results = [];
  console.log(`[${label}] START suite=${suiteName} gates=${gates.length}`);

  for (const [index, gate] of gates.entries()) {
    const stage = `${index + 1}/${gates.length}`;
    const result = await runOneGate(gate, { label, stage, outputDir });
    results.push(result);
    if (!result.ok && options.stopOnFailure) break;
  }

  const endedUtc = new Date().toISOString();
  const failed = results.filter((result) => !result.ok);
  const summary = {
    schema: 'redbyte_gate_summary_v1',
    suiteName,
    label,
    startedUtc,
    endedUtc,
    elapsedMs: Math.round(performance.now() - suiteStart),
    head: git(['rev-parse', 'HEAD']),
    branch: git(['branch', '--show-current']),
    validation,
    totals: {
      planned: gates.length,
      run: results.length,
      passed: results.filter((result) => result.ok).length,
      failed: failed.length,
    },
    results,
  };

  const baseName = options.summaryBaseName ?? sanitizeId(suiteName);
  const jsonPath = path.join(outputDir, `${baseName}.json`);
  const mdPath = path.join(outputDir, `${baseName}.md`);
  writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  writeFileSync(mdPath, renderSummaryMarkdown(summary), 'utf8');

  const verdict = failed.length > 0 ? 'FAIL' : 'PASS';
  console.log(`[${label}] ${verdict} run=${results.length}/${gates.length} elapsed=${summary.elapsedMs}ms`);
  console.log(`[${label}] summary=${path.relative(repoRoot, jsonPath)}`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

async function runOneGate(gate, { label, stage, outputDir }) {
  const startedUtc = new Date().toISOString();
  const started = performance.now();
  const logPath = path.join(outputDir, `${sanitizeId(gate.gateId)}.log`);
  let log = '';
  let timedOut = false;

  console.log(`[${label}] START ${stage} ${gate.gateId}`);
  console.log(`[${label}] CMD ${gate.command}`);
  const child = spawnCommand(gate.command);

  const timeout = setTimeout(() => {
    timedOut = true;
    log += `\n[gate-runner] timeout after ${gate.timeoutMs}ms\n`;
    stopProcessTree(child);
  }, gate.timeoutMs);

  child.stdout?.on('data', (chunk) => {
    const text = String(chunk);
    log += text;
    process.stdout.write(text);
  });
  child.stderr?.on('data', (chunk) => {
    const text = String(chunk);
    log += text;
    process.stderr.write(text);
  });

  const exit = await waitForExit(child);
  clearTimeout(timeout);
  const elapsedMs = Math.round(performance.now() - started);
  const ok = !timedOut && exit.code === 0;
  const endedUtc = new Date().toISOString();
  writeFileSync(logPath, log, 'utf8');

  const status = ok ? 'PASS' : timedOut ? 'TIMEOUT' : 'FAIL';
  console.log(`[${label}] ${status} ${stage} ${gate.gateId} (${elapsedMs}ms)`);
  return {
    gateId: gate.gateId,
    status,
    ok,
    stage,
    command: gate.command,
    ownerSubsystem: gate.ownerSubsystem,
    category: gate.category,
    productInvariant: gate.productInvariant,
    serverOwnership: gate.serverOwnership,
    expectedSha: git(['rev-parse', 'HEAD']),
    elapsedMs,
    startedUtc,
    endedUtc,
    timeoutMs: gate.timeoutMs,
    exitCode: exit.code,
    signal: exit.signal,
    logPath: path.relative(repoRoot, logPath),
  };
}

function spawnCommand(command) {
  if (process.platform === 'win32') {
    return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], {
      cwd: repoRoot,
      env: { ...process.env, CI_FAST: process.env.CI_FAST ?? '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  }
  return spawn(command, {
    cwd: repoRoot,
    env: { ...process.env, CI_FAST: process.env.CI_FAST ?? '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
}

function waitForExit(child) {
  return new Promise((resolve) => {
    child.on('exit', (code, signal) => resolve({ code, signal }));
  });
}

function stopProcessTree(child) {
  if (!child?.pid || child.exitCode !== null || child.killed) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
      return;
    }
    child.kill('SIGTERM');
  } catch {
    // best-effort cleanup
  }
}

function git(args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

function renderSummaryMarkdown(summary) {
  const lines = [
    `# ${summary.label}`,
    '',
    `- Suite: \`${summary.suiteName}\``,
    `- Branch: \`${summary.branch}\``,
    `- HEAD: \`${summary.head}\``,
    `- Started: ${summary.startedUtc}`,
    `- Ended: ${summary.endedUtc}`,
    `- Result: ${summary.totals.failed === 0 ? 'PASS' : 'FAIL'}`,
    `- Gates: ${summary.totals.passed} passed / ${summary.totals.failed} failed / ${summary.totals.run} run`,
    '',
    '| Gate | Status | Stage | Elapsed ms | Log |',
    '|---|---:|---:|---:|---|',
  ];

  for (const result of summary.results) {
    lines.push(
      `| \`${result.gateId}\` | ${result.status} | ${result.stage} | ${result.elapsedMs} | \`${result.logPath}\` |`
    );
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

function renderLegacyMarkdown(summary) {
  const lines = [
    `# ${summary.label}`,
    '',
    `- Suite: \`${summary.suiteName}\``,
    `- Branch: \`${summary.branch}\``,
    `- HEAD: \`${summary.head}\``,
    `- Generated: ${summary.generatedUtc}`,
    '- Result: DIAGNOSTIC ONLY',
    '- Merge requirement: no',
    '',
    'These retired V1 diagnostics are not run by default. Each entry must have a current replacement before it can stay retired.',
    '',
    '| Gate | Status | Failure Category | Replacement | Reason |',
    '|---|---|---|---|---|',
  ];

  for (const gate of summary.gates) {
    lines.push(
      `| \`${gate.gateId}\` | ${gate.status} | ${gate.failureCategory ?? ''} | ${gate.replacement
        .map((replacement) => `\`${replacement}\``)
        .join('<br>')} | ${gate.retirementReason ?? ''} |`
    );
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

function printValidation({ checkPorts = false } = {}) {
  const result = validateGateManifest({ checkPorts });
  if (!result.ok) {
    for (const issue of result.issues) console.error(`[gate-manifest] ${issue}`);
    process.exit(1);
  }
  console.log(
    `[gate-manifest] PASS gates=${result.gateCount} currentRequired=${result.currentRequired} currentFocused=${result.currentFocused} retired=${result.retired} legacyDiagnostic=${result.legacyDiagnostic}`
  );
}

function printLegacyDiagnostics() {
  const validation = validateGateManifest();
  if (!validation.ok) {
    for (const issue of validation.issues) console.error(`[gate-manifest] ${issue}`);
    process.exit(1);
  }

  const outputDir =
    process.env.REDBYTE_GATE_PROOF_DIR ??
    path.join(repoRoot, '.redbyte', 'proof', 'gate-reset', 'phase-3g', 'after');
  mkdirSync(outputDir, { recursive: true });
  const summary = {
    schema: 'redbyte_legacy_gate_manifest_v1',
    suiteName: VERIFY_LEGACY_SUITE,
    label: 'verify:gates:legacy',
    generatedUtc: new Date().toISOString(),
    head: git(['rev-parse', 'HEAD']),
    branch: git(['branch', '--show-current']),
    note: 'Diagnostic-only list of retired V1 gates and their current replacements. These are not default merge requirements.',
    gates: legacyGates().map((gate) => ({
      gateId: gate.gateId,
      command: gate.command,
      status: gate.status,
      ownerSubsystem: gate.ownerSubsystem,
      failureCategory: gate.failureCategory,
      retirementReason: gate.retirementReason,
      replacement: gate.replacement,
    })),
  };

  const jsonPath = path.join(outputDir, 'legacy-gate-manifest.json');
  const mdPath = path.join(outputDir, 'legacy-gate-manifest.md');
  writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  writeFileSync(mdPath, renderLegacyMarkdown(summary), 'utf8');

  console.log(
    `[verify:gates:legacy] DIAGNOSTIC_ONLY retired=${summary.gates.filter((gate) => gate.status === 'retired-with-replacement').length} legacyDiagnostic=${summary.gates.filter((gate) => gate.status === 'legacy-diagnostic').length}`
  );
  console.log(`[verify:gates:legacy] summary=${path.relative(repoRoot, jsonPath)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] ?? '--validate';
  if (mode === '--validate') {
    printValidation();
  } else if (mode === '--check-ports') {
    printValidation({ checkPorts: true });
  } else if (mode === '--legacy') {
    printLegacyDiagnostics();
  } else if (mode === '--list') {
    console.log(JSON.stringify(GATE_MANIFEST, null, 2));
  } else {
    console.error(`Unknown gate-manifest mode: ${mode}`);
    process.exit(1);
  }
}
