# Scripts

## Screenshot Capture

Automated screenshot capture using Playwright.

### Usage

```bash
# Start the dev server in one terminal
pnpm dev

# In another terminal, run the capture script
pnpm capture:screenshots
```

### What Gets Captured

1. **studio-desktop** - Full desktop view of the Studio app
2. **logic-playground** - Logic Playground app window
3. **home-hero** - Landing page hero section
4. **neon-circuit-wallpaper** - Desktop with neon circuit wallpaper
5. **frost-grid-wallpaper** - Desktop with frost grid wallpaper

### Output

Screenshots are saved to `public/screenshots/` as high-resolution PNG files (2x retina).

### Configuration

Edit `capture-screenshots.ts` to:
- Add new capture targets
- Adjust viewport sizes
- Modify wait times
- Customize selectors

### Requirements

- Playwright must be installed: `pnpm install -D @playwright/test`
- Dev server must be running on http://localhost:5173 (or set `BASE_URL` env var)
