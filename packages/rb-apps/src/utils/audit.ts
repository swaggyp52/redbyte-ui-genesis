// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { digestValue, stableStringify } from './digest';
import { getAppInvariants } from './appInvariants';

export interface AuditEntry {
  seq: number;
  actor: string;
  scope: string;
  action: string;
  before_hash: string;
  after_hash: string;
}

const AUDIT_LOG: AuditEntry[] = [];
let auditSeq = 1;

const getEnvFlag = (key: string): string | undefined => {
  const env = (import.meta as any)?.env as Record<string, string | undefined> | undefined;
  return env?.[key];
};

export const isAuditMode = (): boolean => {
  if (typeof window !== 'undefined' && (window as any).__RB_AUDIT__ === true) {
    return true;
  }
  const rbAudit = getEnvFlag('RB_AUDIT');
  const viteAudit = getEnvFlag('VITE_RB_AUDIT');
  return rbAudit === '1' || viteAudit === '1';
};

const resolveActor = (explicit?: string): string => {
  if (explicit) return explicit;
  return 'system';
};

export const recordAuditTransition = (input: {
  scope: string;
  action: string;
  before: unknown;
  after: unknown;
  actor?: string;
}): void => {
  const actor = resolveActor(input.actor);
  const invariants = getAppInvariants(actor);
  if (invariants && !invariants.writes.includes(input.scope)) {
    throw new Error(`App "${actor}" is not allowed to write "${input.scope}"`);
  }

  if (!isAuditMode()) return;
  const entry: AuditEntry = {
    seq: auditSeq++,
    actor,
    scope: input.scope,
    action: input.action,
    before_hash: digestValue(input.before),
    after_hash: digestValue(input.after),
  };
  AUDIT_LOG.push(entry);
};

export const getAuditLog = (): AuditEntry[] => {
  return [...AUDIT_LOG];
};

const downloadText = (filename: string, text: string) => {
  if (typeof window === 'undefined') return;
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportAuditLog = (): void => {
  const payload = {
    schema_version: 'audit_v1',
    entries: getAuditLog(),
  };
  downloadText('rb-audit-log.json', stableStringify(payload));
};
