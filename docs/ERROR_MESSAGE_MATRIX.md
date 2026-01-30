# Student Error Message Matrix

**Goal:** Every error displayed to a student must explain *what happened*, *why*, and *what to do next*. No "undefined", "object Object", or raw stack traces.

| Context | Current Message (Example) | Proposed Student-Friendly Message | Impact on Grade |
| :--- | :--- | :--- | :--- |
| **Bridge Connection** | "Connection failed: [raw error]" | "RedByte Bridge Unreachable. Ensure the bridge agent is running on your machine." | Blocker |
| **Firmware Upload** | "Upload failed." / [raw error] | "Firmware upload failed: [Friendly Reason]. Check USB connection and try again." | Blocker |
| **Device Verification** | "VERIFICATION FAILED" | "Device Verification Failed. Ensure you have the correct board selected and connected." | Blocker |
| **Session Connect** | session.error (Raw) | "Failed to open session. Port busy or permission denied." | Blocker |
| **Capsule Load** | "Invalid trace: [raw error]" | "Evidence file is invalid. [Friendly Reason]. Please re-export." | Fail |

## Implementation Plan

1. Create `src/utils/studentError.ts` helper.
2. Replace raw `toast.error(err.message)` calls in `HardwareRackPanel` and `HardwarePanel`.
3. Add specific handling for "Failed to fetch" (Bridge offline).
