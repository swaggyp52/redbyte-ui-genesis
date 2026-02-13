# TA Lockdown Instructions

## Purpose
Keep student UX constrained while preserving TA recovery access.

## Enable Lockdown
1. Enter TA mode (`?ta=1` or set `rb:mode:v1` to `ta`).
2. Open **Toolchain Setup**.
3. Toggle **Classroom Lockdown** ON.

## Effect
- Student mode is enforced by default.
- Advanced grading/toolchain surfaces are hidden from student flow.
- Core classroom path remains: Home -> Lab Workspace -> Submit.

## TA Escape Hatch
- Temporary: `http://127.0.0.1:4173/os/?ta=1`
- Persistent: localStorage key `rb:mode:v1 = "ta"`
