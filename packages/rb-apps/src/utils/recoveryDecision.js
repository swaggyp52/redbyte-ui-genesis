// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Recovery mode decision logic (pure function, extracted from gate test)
export function decideRecoveryMode(ctx) {
    // Priority 1: Autosave restore (data loss risk)
    if (ctx.hasAutosaveRestore && !ctx.autosaveDiscarded && !ctx.autosaveRestored) {
        return 'autosave';
    }
    // Priority 2: Workspace crash recovery (layout convenience)
    // Only show if autosave has been handled (restored or discarded) or never existed
    if (ctx.hasWorkspaceCrash && (ctx.autosaveRestored || ctx.autosaveDiscarded || !ctx.hasAutosaveRestore)) {
        return 'workspace';
    }
    // Priority 3: Nothing to recover
    return 'none';
}
