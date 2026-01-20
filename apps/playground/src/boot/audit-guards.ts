// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

const getEnvFlag = (key: string): string | undefined => {
  const env = (import.meta as any)?.env as Record<string, string | undefined> | undefined;
  return env?.[key];
};

export const isAuditEnabled = (params: URLSearchParams): boolean => {
  if (params.get('audit') === '1') return true;
  const rbAudit = getEnvFlag('RB_AUDIT');
  const viteAudit = getEnvFlag('VITE_RB_AUDIT');
  return rbAudit === '1' || viteAudit === '1';
};

export const installAuditGuards = (enabled: boolean): void => {
  if (!enabled) return;

  if (typeof window !== 'undefined') {
    (window as any).__RB_AUDIT__ = true;
  }

  let randomState = 1;
  const originalRandom = Math.random;
  Math.random = () => {
    randomState = (randomState * 1664525 + 1013904223) >>> 0;
    return randomState / 0xffffffff;
  };

  let now = 0;
  const originalNow = Date.now;
  Date.now = () => {
    now += 1;
    return now;
  };

  if (typeof window !== 'undefined') {
    (window as any).__RB_AUDIT_GUARDS__ = {
      random: originalRandom,
      now: originalNow,
    };
  }
};
