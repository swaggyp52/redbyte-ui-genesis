// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Board Profile Loader + Validator
 *
 * CRITICAL: Board profiles are JSON data (not TypeScript constants)
 * to enable adding new boards without code changes.
 */
import basys3Profile from '../profiles/basys3.json';
import arduinoProfile from '../profiles/arduino.json';
const BUILT_IN_PROFILES = {
    basys3: basys3Profile,
    arduino: arduinoProfile,
    // Future: nexys4, de10-lite, etc.
};
/**
 * Load board profile by ID.
 * Throws if profile not found or invalid.
 */
export function loadBoardProfile(profileId) {
    const data = BUILT_IN_PROFILES[profileId];
    if (!data) {
        throw new Error(`Board profile not found: ${profileId}`);
    }
    return validateBoardProfile(data);
}
/**
 * List all available board profiles.
 */
export function listBoardProfiles() {
    return Object.values(BUILT_IN_PROFILES).map((p) => ({
        id: p.id,
        name: p.name,
        vendor: p.vendor,
    }));
}
/**
 * Validate board profile structure.
 * Throws Error if invalid.
 */
export function validateBoardProfile(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid board profile: must be an object');
    }
    const profile = data;
    if (!profile.id || !profile.name || !profile.components) {
        throw new Error('Invalid board profile: missing required fields (id, name, components)');
    }
    if (profile.schemaVersion !== '1.0') {
        throw new Error(`Unsupported board profile schema version: ${profile.schemaVersion}`);
    }
    // Validate LEDs have unique IDs
    const ledIds = new Set();
    for (const led of profile.components.leds ?? []) {
        if (ledIds.has(led.id)) {
            throw new Error(`Duplicate LED ID: ${led.id}`);
        }
        ledIds.add(led.id);
    }
    // Validate switches have unique IDs
    const switchIds = new Set();
    for (const sw of profile.components.switches ?? []) {
        if (switchIds.has(sw.id)) {
            throw new Error(`Duplicate switch ID: ${sw.id}`);
        }
        switchIds.add(sw.id);
    }
    // Validate buttons have unique IDs
    const buttonIds = new Set();
    for (const btn of profile.components.buttons ?? []) {
        if (buttonIds.has(btn.id)) {
            throw new Error(`Duplicate button ID: ${btn.id}`);
        }
        buttonIds.add(btn.id);
    }
    return profile;
}
