// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

const sortObject = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const next: Record<string, unknown> = {};
    keys.forEach((key) => {
      next[key] = sortObject(obj[key]);
    });
    return next;
  }
  return value;
};

export const stableStringify = (value: unknown) => {
  return JSON.stringify(sortObject(value));
};

export const hashString = (input: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

export const digestValue = (value: unknown) => {
  return hashString(stableStringify(value));
};
