// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useWindowStore } from '@redbyte/rb-windowing';
import { digestValue, stableStringify } from './digest';
import { getAppInvariants } from './appInvariants';
const AUDIT_LOG = [];
let auditSeq = 1;
const getEnvFlag = (key) => {
    const env = import.meta?.env;
    return env?.[key];
};
export const isAuditMode = () => {
    if (typeof window !== 'undefined' && window.__RB_AUDIT__ === true) {
        return true;
    }
    const rbAudit = getEnvFlag('RB_AUDIT');
    const viteAudit = getEnvFlag('VITE_RB_AUDIT');
    return rbAudit === '1' || viteAudit === '1';
};
const resolveActor = (explicit) => {
    if (explicit)
        return explicit;
    if (typeof window === 'undefined')
        return 'system';
    try {
        const focused = useWindowStore.getState().getFocusedWindow?.();
        return focused?.contentId ?? 'system';
    }
    catch {
        return 'system';
    }
};
export const recordAuditTransition = (input) => {
    const actor = resolveActor(input.actor);
    const invariants = getAppInvariants(actor);
    if (invariants && !invariants.writes.includes(input.scope)) {
        throw new Error(`App "${actor}" is not allowed to write "${input.scope}"`);
    }
    if (!isAuditMode())
        return;
    const entry = {
        seq: auditSeq++,
        actor,
        scope: input.scope,
        action: input.action,
        before_hash: digestValue(input.before),
        after_hash: digestValue(input.after),
    };
    AUDIT_LOG.push(entry);
};
export const getAuditLog = () => {
    return [...AUDIT_LOG];
};
const downloadText = (filename, text) => {
    if (typeof window === 'undefined')
        return;
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};
export const exportAuditLog = () => {
    const payload = {
        schema_version: 'audit_v1',
        entries: getAuditLog(),
    };
    downloadText('rb-audit-log.json', stableStringify(payload));
};
