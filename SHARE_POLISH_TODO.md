# Share UX Polish - Follow-up PR

Post-merge improvements for circuit sharing feature.

## Prerequisites

- PR #54 merged to main
- Production deployment verified at https://redbyteapps.dev
- Smoke test passed: Share → Copy → Open link → Circuit loads

## Polish Tasks

### 1. Clipboard Fallback UI

**Problem**: `navigator.clipboard.writeText()` may fail (permissions, HTTPS requirement, browser support)

**Solution**:
```typescript
// In handleShare():
try {
  await navigator.clipboard.writeText(url.toString());
  addToast('Share link copied to clipboard!', 'success');
} catch (error) {
  // Fallback: show modal with selectable input
  setShareFallbackURL(url.toString());
  setShowShareModal(true);
}
```

**UI Component**: Modal with:
- Read-only input field (auto-selected text)
- "Copy" button (uses `execCommand` fallback)
- "Close" button
- Instructions: "Press Ctrl+C to copy"

### 2. Decode Error Handling

**Problem**: Invalid/corrupted URLs show generic error toast, user stuck

**Solution**: Add recovery UI
```typescript
// In URL ingestion:
catch (error) {
  addToast('Failed to load shared circuit', 'error');
  setShowDecodeErrorModal(true);
}
```

**UI Component**: Modal with:
- Error message: "This share link is invalid or corrupted"
- "Clear URL & Start Fresh" button (clears param, resets to empty circuit)
- "Report Issue" link (GitHub issues)

### 3. Idempotent Ingestion

**Problem**: URL ingestion runs on every render, could cause loops

**Current**:
```typescript
useEffect(() => {
  detectAndLoadCircuitFromURL();
}, []); // Empty deps - only runs once ✅
```

**Verification**: Already correct, but add guard:
```typescript
const hasLoadedFromURL = useRef(false);

useEffect(() => {
  if (hasLoadedFromURL.current) return;

  const params = new URLSearchParams(window.location.search);
  if (params.get('circuit')) {
    hasLoadedFromURL.current = true;
    detectAndLoadCircuitFromURL();
  }
}, []);
```

### 4. Keyboard Shortcut Documentation

**Problem**: `Ctrl+Shift+C` not discoverable

**Solution**: Document in Settings → Keyboard Shortcuts
- Add new Settings panel tab: "Keyboard Shortcuts"
- List all global shortcuts:
  - `Ctrl+Space` - System Search
  - `Ctrl+,` - Settings
  - `Ctrl+Shift+C` - Share Circuit (Logic Playground only)
  - etc.

**Conflict Check**: Verify `Ctrl+Shift+C` doesn't conflict with:
- Browser DevTools (usually `Ctrl+Shift+I`)
- Shell global shortcuts
- Other app shortcuts

### 5. Share Link Metadata (Optional)

**Enhancement**: Include circuit name in URL or metadata
```typescript
// Option A: Query param
?circuit=c1:...&name=My%20Awesome%20Circuit

// Option B: Embed in metadata field (already supported)
metadata: {
  name: currentFileId ? getFile(currentFileId)?.name : 'Shared Circuit',
  version: serialized.version,
  sharedAt: new Date().toISOString(), // Optional timestamp
}
```

**UI Update**: On load, if name exists, show "Loaded: My Awesome Circuit"

### 6. Loading State UX

**Enhancement**: Show loading indicator during decode
```typescript
const [isLoadingSharedCircuit, setIsLoadingSharedCircuit] = useState(false);

// In ingestion:
setIsLoadingSharedCircuit(true);
const decoded = await decodeCircuitAsync(circuitParam);
setIsLoadingSharedCircuit(false);
```

**UI**: Show spinner overlay with "Loading shared circuit..."

## Implementation Order

1. **Clipboard fallback** (critical UX fix)
2. **Decode error modal** (critical UX fix)
3. **Idempotent ingestion guard** (defensive robustness)
4. **Keyboard shortcuts docs** (discoverability)
5. **Loading state** (polish)
6. **Share metadata** (optional enhancement)

## Testing Checklist

After implementing polish:

- [ ] Disable clipboard API in DevTools → Share → Fallback modal appears
- [ ] Manually corrupt c1: URL → Error modal with "Clear URL" button works
- [ ] Refresh page with ?circuit param → Circuit only loads once
- [ ] Open Settings → Keyboard Shortcuts tab shows Ctrl+Shift+C
- [ ] Share large circuit → Loading spinner appears during encode

## Non-Goals (Out of Scope)

- Short URL service (e.g., bit.ly integration)
- Server-side circuit storage (client-side only for now)
- Share link analytics (no tracking)
- Social media embeds (just URL sharing)

## Deployment Notes

- No breaking changes
- Can deploy incrementally (one task at a time)
- Each enhancement is backwards compatible
- No new dependencies required

---

**Created**: 2025-12-24
**Related**: PR #54 (feat: circuit sharing)
