# Public Assets

## Icons & Favicons

The favicon and app icons are currently SVG-based. For production, convert to PNG:

```bash
# Install imagemagick or use an online converter
# Convert favicon.svg to various sizes:
convert -background none -resize 192x192 favicon.svg icon-192.png
convert -background none -resize 512x512 favicon.svg icon-512.png
convert -background none -resize 180x180 favicon.svg apple-touch-icon.png

# Or use a service like https://realfavicongenerator.net/
```

## Social Cards (OG Images)

The `og-image.svg` should be converted to PNG for better compatibility:

```bash
convert -background none -resize 1200x630 og-image.svg og-image.png
```

## Wallpapers

SVG wallpapers are located in `/wallpapers/`:
- `neon-circuit.svg` - Dark theme with glowing circuit traces
- `frost-grid.svg` - Light theme with subtle grid pattern
