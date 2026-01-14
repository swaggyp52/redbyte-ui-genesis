export {};

declare global {
  interface Window {
    __RB_MOUNT_TRACE__?: Array<string>;
    __RB_LAST_FATAL__?: unknown;
    __RB_LAST_CLOSE__?: unknown;
    __RB_RUNAWAY__?: unknown;
    __RB_ERROR_BOUNDARY_HIT__?: boolean;
  }
}
