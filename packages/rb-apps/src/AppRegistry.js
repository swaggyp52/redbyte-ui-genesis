// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
const registry = new Map();
export function registerApp(app) {
    registry.set(app.manifest.id, app);
}
export function getApp(id) {
    return registry.get(id) ?? null;
}
export function listApps() {
    return Array.from(registry.values());
}
