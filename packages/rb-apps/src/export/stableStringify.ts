// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const next: Record<string, unknown> = {};
    keys.forEach((key) => {
      next[key] = sortValue(obj[key]);
    });
    return next;
  }
  return value;
};

export const stableStringify = (value: unknown) => {
  return JSON.stringify(sortValue(value), null, 2);
};
