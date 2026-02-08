// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Help topics data structure for student-facing troubleshooting
export const HELP_TOPICS = [
    {
        id: 'bridge-offline',
        title: 'Bridge Offline / Hardware Connect',
        errorCodes: ['BRIDGE_UNREACHABLE', 'HW_NOT_CONNECTED', 'SESSION_CONNECT_FAILED'],
        steps: [
            'Make sure RedByte Bridge is running on your machine.',
            'Check that your USB cable is connected to the FPGA board.',
            'Try refreshing the connection in the Hardware panel.',
            'If using dry-run mode, set RB_BRIDGE_DRYRUN=1 in the URL.',
            'Restart RedByte Bridge and reload this page.',
        ],
    },
    {
        id: 'export-submission',
        title: 'Export / Submission (.rbproj / .rbx.zip)',
        errorCodes: ['EVIDENCE_INVALID'],
        steps: [
            'Use File → Export Project (.rbproj) to save your circuit design.',
            'Use File → Export Evidence (.rbx.zip) to submit lab work.',
            'Ensure your circuit is valid before exporting (no red error markers).',
            'Upload the .rbx.zip file to your course submission portal.',
            'If export fails, check browser console for errors and retry.',
        ],
    },
    {
        id: 'autosave-recovery',
        title: 'Autosave / Recovery ("You Can\'t Lose Your Work")',
        steps: [
            'Your work autosaves every 30 seconds while editing.',
            'If RedByte crashes, you\'ll see a "Restore autosave?" prompt on reload.',
            'Choose "Restore" to recover your last saved state.',
            'Choose "Discard" to start fresh (WARNING: this deletes the autosave).',
            'Autosaves are stored in your browser\'s localStorage (cleared if you clear site data).',
        ],
    },
    {
        id: 'performance-mode',
        title: 'Performance Mode ("Why is Scope Slow?")',
        steps: [
            'Performance Mode reduces visual effects when running heavy circuits.',
            'Enable it via Settings → Performance Mode if the oscilloscope feels laggy.',
            'Performance Mode disables: smooth zoom, advanced animations, real-time shadows.',
            'Recommended for circuits with >50 nodes or when running long simulations.',
            'Reload the page after toggling for full effect.',
        ],
    },
    {
        id: 'hardware-timeout',
        title: 'Hardware Timeout / Device Not Found',
        errorCodes: ['HW_TIMEOUT', 'HW_DEVICE_NOT_FOUND'],
        steps: [
            'Ensure your FPGA board is powered on and connected via USB.',
            'Check that no other program is using the serial port (e.g., Arduino IDE).',
            'Try unplugging and reconnecting the USB cable.',
            'Select the correct device in the Hardware panel.',
            'If timeout persists, restart RedByte Bridge and retry.',
        ],
    },
    {
        id: 'firmware-upload',
        title: 'Firmware Upload / Programming Failed',
        errorCodes: ['FIRMWARE_UPLOAD_FAILED', 'DEVICE_VERIFICATION_FAILED'],
        steps: [
            'Make sure your board is in programming mode (follow manufacturer instructions).',
            'Check that USB drivers are installed for your FPGA board.',
            'Close any other software that might be accessing the board.',
            'Try a different USB port (avoid hubs if possible).',
            'Verify the board model matches your selection in RedByte.',
        ],
    },
    {
        id: 'error-codes',
        title: 'Error Codes / Troubleshooting Matrix',
        errorCodes: ['UNEXPECTED_ERROR', 'HW_STREAM_FAILED', 'RB_CANCELED'],
        steps: [
            'Every error has a code (e.g., HW_NOT_CONNECTED, BRIDGE_UNREACHABLE).',
            'Use the search box above to find troubleshooting steps for your error code.',
            'Copy diagnostics using the button below to share with instructors.',
            'If the error persists, reload the page and try again.',
            'For unrecognized errors, report the code to your course staff.',
        ],
    },
];
/**
 * Get all unique error codes referenced across all help topics.
 */
export function getAllReferencedErrorCodes() {
    const codes = new Set();
    for (const topic of HELP_TOPICS) {
        if (topic.errorCodes) {
            for (const code of topic.errorCodes) {
                codes.add(code);
            }
        }
    }
    return codes;
}
/**
 * Find topics matching a search query (searches title, steps, and error codes).
 */
export function searchHelpTopics(query) {
    if (!query.trim())
        return HELP_TOPICS;
    const lowerQuery = query.toLowerCase().trim();
    return HELP_TOPICS.filter((topic) => {
        // Match title
        if (topic.title.toLowerCase().includes(lowerQuery))
            return true;
        // Match error codes
        if (topic.errorCodes?.some((code) => code.toLowerCase().includes(lowerQuery)))
            return true;
        // Match steps
        if (topic.steps.some((step) => step.toLowerCase().includes(lowerQuery)))
            return true;
        return false;
    });
}
/**
 * Find topics by exact error code match.
 */
export function getTopicsByErrorCode(errorCode) {
    return HELP_TOPICS.filter((topic) => topic.errorCodes?.some((code) => code === errorCode));
}
