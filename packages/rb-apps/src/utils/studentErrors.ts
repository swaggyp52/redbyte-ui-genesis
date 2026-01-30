export function getFriendlyErrorMessage(error: any, context: string): string {
    const msg = error?.message || String(error);

    // Network / Bridge errors
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        return `Bridge Unreachable. Is the RedByte Bridge Agent running?`;
    }

    // Port errors
    if (msg.includes('Access denied') || msg.includes('Port busy')) {
        return `Port Busy. Another app might be using the device.`;
    }

    // Upload errors
    if (msg.includes('upload failed') || msg.includes('Exit code')) {
        return `Firmware Upload Failed. Check USB connections and drivers.`;
    }

    // Validation/Verification errors
    if (msg.includes('Invalid signature') || msg.includes('tampered')) {
        return `Integrity Check Failed. The file appears corrupted or modified.`;
    }

    // Timeout
    if (msg.includes('timeout') || msg.includes('timed out')) {
        return `Device Timeout. The board did not respond in time.`;
    }

    // Default: Clean up "Error:" prefix if present
    const cleanMsg = msg.replace(/^Error:\s*/, '');
    return `${context}: ${cleanMsg}`;
}
