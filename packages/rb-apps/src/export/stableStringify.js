// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
const sortValue = (value) => {
    if (Array.isArray(value)) {
        return value.map(sortValue);
    }
    if (value && typeof value === 'object') {
        const obj = value;
        const keys = Object.keys(obj).sort();
        const next = {};
        keys.forEach((key) => {
            next[key] = sortValue(obj[key]);
        });
        return next;
    }
    return value;
};
export const stableStringify = (value) => {
    return JSON.stringify(sortValue(value), null, 2);
};
