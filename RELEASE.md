# RedByte OS Release v1.0

**Status**: 🟢 RELEASE READY

## 1. Local Verification Checklist (10 Minutes)

Before tagging, run through this manual smoke test:

1. **Launch OS**: `pnpm dev`
2. **Open Playground**: Click "Logic Playground" from the dock or launcher.
3. **Load Example**:
    * Click "Examples" (Secondary styling).
    * Select "D-Flip-Flop Demo" (or similar).
4. **Add Probe**:
    * Select a wire or node port.
    * In Right Dock > Probes > Click "Add Probe".
5. **Simulate**:
    * Click "Step" (Primary) several times.
    * Click "Run" (Secondary) and watch the oscilloscope trace.
6. **Export Evidence**:
    * Click "Export Evidence" (Purple button).
    * Save the JSON file.
7. **Verify**:
    * Refresh or open a new tab.
    * Click "Open Lab Evidence" (Emerald button).
    * Load the JSON file.
    * **Confirm**: "✅ Verified" badge appears with matching hash.

## 2. Shipped Artifacts

* **RedByte OS (Client)**: The core desktop environment and logic simulator.
* **Manual Site**: Static documentation site (`apps/manual-site`) deployed to redbyteapps.dev.
* **Instructor Docs**: Integrated into the Manual site (hidden/anchored).

## 3. Release Process (Tagging)

Perform these steps from a clean `main` branch:

```bash
# 1. Ensure clean state
git status

# 2. Tag the release
git tag -a v1.0.0 -m "RedByte OS v1.0 - Initial Stable Release"

# 3. Push tag
git push origin v1.0.0
```

## 4. Deployment Notes

* **Manual Site**: Built via `apps/manual-site`. Deploy using existing CI/CD or `pnpm build` output.
* **Post-Deploy Verification**:
  * Visit <https://redbyteapps.dev> (or staging URL).
  * Verify "Open Playground" CTA works.
  * Verify "Docs" navigation works.
  * Perform a quick "Export Evidence" test in the production environment.
