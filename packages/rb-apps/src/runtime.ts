/**
 * @redbyte/rb-apps/runtime — the project runtime store and its persistence gate, without the
 * IdeApp shell or any of its stylesheets. A host that is not the workbench (the Meridian
 * studio entry) opens the same persisted session through this entry.
 */
export { useProjectRuntime } from './apps/ide/projectRuntime';
export { projectRepository } from './apps/ide/projectRepository';
export { runtimePersistence } from './apps/ide/durableProjectStorage';
// The workbench's blocking-design check before a checked Run (needs the export view model,
// which reaches the runtime store, so it is offered here rather than by the pure domain entry).
export { deriveIdeBlockingDesignIssue } from './apps/ide/ideDesignBlocking';
