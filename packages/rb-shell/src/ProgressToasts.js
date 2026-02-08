/**
 * Progress Toast Adapter
 * Subscribes to progress events and displays them as student-facing toasts
 */
import { useEffect } from 'react';
import { progressBus } from '@redbyte/rb-utils';
import { useToast } from '@redbyte/rb-primitives';
const MAX_ACTIVE_TOASTS = 5;
// Hardware error codes that should show "Troubleshoot" action
const HARDWARE_ERROR_CODES = new Set([
    'HW_NOT_CONNECTED',
    'HW_DEVICE_NOT_FOUND',
    'HW_TIMEOUT',
    'HW_STREAM_FAILED',
    'BRIDGE_UNREACHABLE',
    'FIRMWARE_UPLOAD_FAILED',
    'DEVICE_VERIFICATION_FAILED',
]);
export function ProgressToasts({ onOpenHelp }) {
    const toast = useToast();
    useEffect(() => {
        // Track active progress actions and their toast IDs
        const activeActions = new Map();
        let overflowToastId = null;
        const handleProgressEvent = (event) => {
            const { actionId, type, message, failPayload } = event;
            // If we have too many active toasts, collapse into overflow
            if (activeActions.size >= MAX_ACTIVE_TOASTS && type === 'start') {
                if (!overflowToastId) {
                    overflowToastId = toast.info({
                        message: `${activeActions.size + 1} tasks running...`,
                        duration: 30000,
                    });
                }
                return;
            }
            switch (type) {
                case 'start': {
                    // Show "working" toast with long duration
                    const toastId = toast.info({
                        message,
                        duration: 30000, // Keep visible until terminal event
                    });
                    activeActions.set(actionId, toastId);
                    break;
                }
                case 'update': {
                    // Dismiss old toast and show updated one
                    const prevToastId = activeActions.get(actionId);
                    if (prevToastId) {
                        toast.dismiss(prevToastId);
                    }
                    const newToastId = toast.info({
                        message,
                        duration: 30000,
                    });
                    activeActions.set(actionId, newToastId);
                    break;
                }
                case 'succeed': {
                    // Dismiss working toast, show success
                    const prevToastId = activeActions.get(actionId);
                    if (prevToastId) {
                        toast.dismiss(prevToastId);
                    }
                    toast.success({
                        message,
                        duration: 3000, // Auto-dismiss success quickly
                    });
                    activeActions.delete(actionId);
                    // Clear overflow toast if all done
                    if (activeActions.size === 0 && overflowToastId) {
                        toast.dismiss(overflowToastId);
                        overflowToastId = null;
                    }
                    break;
                }
                case 'fail': {
                    // Dismiss working toast, show error with "Copy details" and optional "Troubleshoot"
                    const prevToastId = activeActions.get(actionId);
                    if (prevToastId) {
                        toast.dismiss(prevToastId);
                    }
                    const actions = [];
                    // Extract error code from failPayload
                    const errorCode = typeof failPayload?.code === 'string' ? failPayload.code : undefined;
                    // Add "Troubleshoot" action for hardware errors
                    if (errorCode && HARDWARE_ERROR_CODES.has(errorCode)) {
                        actions.push({
                            label: 'Troubleshoot',
                            onClick: () => {
                                onOpenHelp(errorCode);
                            },
                        });
                    }
                    // Add "Copy details" action if details available
                    if (failPayload?.details) {
                        actions.push({
                            label: 'Copy details',
                            onClick: () => {
                                const details = typeof failPayload.details === 'string'
                                    ? failPayload.details
                                    : JSON.stringify(failPayload.details, null, 2);
                                navigator.clipboard
                                    .writeText(details)
                                    .then(() => {
                                    toast.info({
                                        message: 'Details copied to clipboard',
                                        duration: 2000,
                                    });
                                })
                                    .catch((err) => {
                                    console.error('[ProgressToasts] Failed to copy:', err);
                                    toast.error({
                                        message: 'Failed to copy details',
                                        duration: 2000,
                                    });
                                });
                            },
                        });
                    }
                    toast.error({
                        message: failPayload?.studentMessage || message,
                        duration: 10000, // Keep errors visible longer
                        actions: actions.length > 0 ? actions : undefined,
                    });
                    activeActions.delete(actionId);
                    // Clear overflow toast if all done
                    if (activeActions.size === 0 && overflowToastId) {
                        toast.dismiss(overflowToastId);
                        overflowToastId = null;
                    }
                    break;
                }
            }
        };
        // Subscribe to progress bus
        const unsubscribe = progressBus.subscribe(handleProgressEvent);
        // Cleanup on unmount
        return () => {
            unsubscribe();
            // Dismiss any active toasts
            activeActions.forEach((toastId) => toast.dismiss(toastId));
            if (overflowToastId) {
                toast.dismiss(overflowToastId);
            }
        };
    }, [toast]);
    // This component has no visual output; it's just a subscriber
    return null;
}
