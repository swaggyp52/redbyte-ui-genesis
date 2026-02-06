/**
 * Progress Toast Adapter
 * Subscribes to progress events and displays them as student-facing toasts
 */

import { useEffect } from 'react';
import { progressBus, type RbProgressEvent } from '@redbyte/rb-utils';
import { useToast } from '@redbyte/rb-primitives';

const MAX_ACTIVE_TOASTS = 5;

export function ProgressToasts() {
  const toast = useToast();

  useEffect(() => {
    // Track active progress actions and their toast IDs
    const activeActions = new Map<string, string>();
    let overflowToastId: string | null = null;

    const handleProgressEvent = (event: RbProgressEvent) => {
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
          // Dismiss working toast, show error with "Copy details"
          const prevToastId = activeActions.get(actionId);
          if (prevToastId) {
            toast.dismiss(prevToastId);
          }

          const actions = failPayload?.details
            ? [
                {
                  label: 'Copy details',
                  onClick: () => {
                    const details =
                      typeof failPayload.details === 'string'
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
                },
              ]
            : undefined;

          toast.error({
            message: failPayload?.studentMessage || message,
            duration: 10000, // Keep errors visible longer
            actions,
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
