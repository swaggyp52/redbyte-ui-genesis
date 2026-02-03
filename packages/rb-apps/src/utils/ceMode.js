// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Classroom Edition (CE) Mode Detection
 *
 * CE mode is enabled via:
 * - Query param: ?ce=1
 * - Environment variable: VITE_CLASSROOM=true
 *
 * In CE mode:
 * - Autosave/restore always enabled
 * - Example gallery, Export/Submit, Reset workspace buttons visible
 * - Help overlay accessible via "?" key
 * - Performance guardrails active (tick rate caps, heavy circuit detection)
 * - Simplified UI optimized for student workflows
 */
export function isCEMode() {
    // Check query param first
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('ce') === '1') {
            return true;
        }
    }
    // Check environment variable
    if (import.meta.env.VITE_CLASSROOM === 'true') {
        return true;
    }
    return false;
}
/**
 * Get CE mode configuration overrides
 */
export function getCEConfig() {
    const isEnabled = isCEMode();
    return {
        isEnabled,
        // Performance limits for student circuits
        maxTickRate: isEnabled ? 60 : 120, // Cap at 60Hz in CE mode
        heavyCircuitThreshold: {
            nodes: 200,
            connections: 400,
        },
        // Autosave settings
        autosaveEnabled: isEnabled,
        autosaveDebounceMs: 3000,
    };
}
/**
 * Check if circuit is "heavy" and should trigger performance warnings
 */
export function isHeavyCircuit(nodeCount, connectionCount) {
    const config = getCEConfig();
    return (nodeCount >= config.heavyCircuitThreshold.nodes ||
        connectionCount >= config.heavyCircuitThreshold.connections);
}
