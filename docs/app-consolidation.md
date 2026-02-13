# App Consolidation (Student Workflow First)

## Goal

Reduce student-facing navigation to a single obvious workflow:

- Home
- Lab Workspace
- (Optional) Help

Everything else is TA-only, internal, or converted into workspace tabs/panels.

## Current Decision Table

| App ID | Student Launcher | TA Launcher | Disposition | Notes |
| --- | --- | --- | --- | --- |
| home | Keep | Keep | Keep | Primary entrypoint for Start/Resume |
| lab-workspace | Keep | Keep | Keep | Primary lab tool surface |
| help | Optional | Optional | Keep (optional) | Include only if standalone help remains useful |
| ece-lab | Hide | Keep | Convert-to-tab route | Legacy/compat route while workspace is promoted |
| logic-playground | Hide | Keep | Convert-to-tab route | Build/Practice functionality moves under workspace tabs |
| toolchain-setup | Hide | Keep | Convert-to-tab (TA-only) | TA diagnostics and setup flows |
| submission-inspector | Hide | Keep | Convert-to-tab (TA-only) | TA grading and troubleshooting |
| instructor | Hide | Keep | Keep | Instructor/TA management surface |
| labs | Hide | Hide/Keep (TBD) | Internal-only | Candidate for full retirement after migration |
| settings | Hide | Keep | Keep | System settings, not student workflow |
| files | Hide | Keep | Keep | System utility, not student workflow |
| terminal | Hide | Keep | Keep | Advanced/admin only |
| system-log | Hide | Keep | Keep | Advanced/admin only |
| text-viewer | Hide | Keep | Keep | Utility only |
| launcher | Internal | Internal | Internal-only | Shell mechanism |

## Student Mode Rule

If a screen does not directly contribute to:

- Build
- Simulate
- Hardware (when enabled)
- Submit

it is not student-launcher visible.

## Transition Strategy

1. Convert functionality into `lab-workspace` tabs/panels first.
2. Keep deep links for TA and compatibility while migration is active.
3. Remove legacy app launcher exposure in student mode.
4. Delete obsolete routes only after parity validation and test coverage are complete.
