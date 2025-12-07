# @redbyte/rb-tokens

Design system tokens for RedByte OS Genesis.

## Features

- **Complete token system**: colors, spacing, typography, motion, shadows, radius
- **Two themes**: dark-neon (cyberpunk) and light-frost (professional)
- **CSS variable generation**: Automatic conversion to --rb-* custom properties
- **TypeScript**: Fully typed with strict mode
- **Tree-shakeable**: Import only what you need

## Installation

```bash
pnpm add @redbyte/rb-tokens
```

## Usage

### Import Tokens

```ts
import { tokensDarkNeon, tokensLightFrost } from '@redbyte/rb-tokens';

// Access tokens
const accentColor = tokensDarkNeon.color.accent[500];  // '#f43f5e'
const borderRadius = tokensDarkNeon.radius.md;          // '0.375rem'
```

### Generate CSS Variables

```ts
import { tokensToCSSVariables, applyCSSVariables } from '@redbyte/rb-tokens';
import { tokensDarkNeon } from '@redbyte/rb-tokens';

// Generate CSS custom properties
const cssVars = tokensToCSSVariables(tokensDarkNeon);
// { '--rb-color-accent-500': '#f43f5e', ... }

// Apply to root element
applyCSSVariables(document.documentElement, cssVars);
```

## Token Structure

### Colors

6 semantic color scales with 10 shades each (50-900):

- `accent`: Primary brand color
- `neutral`: Grays for text/backgrounds
- `success`: Green for positive states
- `warning`: Yellow/orange for cautions
- `error`: Red for errors
- `info`: Blue for informational

```ts
tokensDarkNeon.color.accent[500]   // Primary accent
tokensDarkNeon.color.neutral[800]  // Dark neutral
```

### Spacing

20 spacing values from 0 to 64:

```ts
tokensDarkNeon.spacing[4]   // '1rem' (16px)
tokensDarkNeon.spacing[8]   // '2rem' (32px)
```

### Typography

Complete typography system:

```ts
tokensDarkNeon.typography.fontFamily.sans
tokensDarkNeon.typography.fontSize.base    // '1rem'
tokensDarkNeon.typography.fontWeight.bold  // '700'
tokensDarkNeon.typography.lineHeight.normal
tokensDarkNeon.typography.letterSpacing.wide
```

### Motion

Animation timing and easing:

```ts
tokensDarkNeon.motion.duration.fast   // '150ms'
tokensDarkNeon.motion.easing.inOut    // 'cubic-bezier(...)'
```

### Radius & Shadow

Border radius and box shadows:

```ts
tokensDarkNeon.radius.lg     // '0.5rem'
tokensDarkNeon.shadow.xl     // '0 20px 25px...'
```

## Themes

### dark-neon

Vibrant dark theme with neon pink/red accents. Cyberpunk-inspired.

### light-frost

Clean, bright theme with cool blue accents. Professional daytime theme.

## CSS Variables

All tokens can be converted to CSS custom properties:

```
--rb-color-accent-500
--rb-color-neutral-900
--rb-radius-md
--rb-shadow-lg
--rb-spacing-4
--rb-font-size-base
--rb-font-weight-bold
--rb-duration-fast
--rb-easing-inOut
```

## TypeScript

```ts
import type { RBTokens, ColorScale, CSSVariables } from '@redbyte/rb-tokens';

const myTokens: RBTokens = { ... };
```

## License

MIT
