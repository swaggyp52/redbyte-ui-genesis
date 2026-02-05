# Student Error Message Matrix

**Goal:** Every error displayed to a student must explain *what happened*, *why*, and *what to do next*. No "undefined", "object Object", or raw stack traces.

| Code | Context | Current Message (Example) | Proposed Student-Friendly Message | Impact on Grade |
| :--- | :--- | :--- | :--- |
| `BRIDGE_UNREACHABLE` | **Bridge Connection** | "Connection failed: [raw error]" | "RedByte Bridge Unreachable. Ensure the bridge agent is running on your machine." | Blocker |
| `FIRMWARE_UPLOAD_FAILED` | **Firmware Upload** | "Upload failed." / [raw error] | "Firmware upload failed: [Friendly Reason]. Check USB connection and try again." | Blocker |
| `DEVICE_VERIFICATION_FAILED` | **Device Verification** | "VERIFICATION FAILED" | "Device Verification Failed. Ensure you have the correct board selected and connected." | Blocker |
| `SESSION_CONNECT_FAILED` | **Session Connect** | session.error (Raw) | "Failed to open session. Port busy or permission denied." | Blocker |
| `EVIDENCE_INVALID` | **Capsule Load** | "Invalid trace: [raw error]" | "Evidence file is invalid. [Friendly Reason]. Please re-export." | Fail |
| `UNEXPECTED_ERROR` | **Generic** | raw exception / stack trace | "An unexpected error occurred. Please try again. If it persists, reload the page." | Blocker |

## Implementation Plan

1. Create a student error helper with stable codes (see table above).
2. Replace raw `toast.error(err.message)` calls in `HardwareRackPanel` and `HardwarePanel`.
3. Add specific handling for "Failed to fetch" (Bridge offline) → `BRIDGE_UNREACHABLE`.
