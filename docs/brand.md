# RedByte Brand Guidelines

## Logo

### Wordmark
**RedByte** — A fusion of digital innovation and circuit design.

The brand name is styled as:
- Primary: `RedByte` (PascalCase)
- Secondary: `REDBYTE` (all caps for headers)
- Never: `Redbyte`, `redbyte`, or `Red Byte`

### Visual Identity
The RedByte logo combines:
- A stylized circuit node or logic gate element
- Clean, modern typography
- Neon accents suggesting digital energy flow

## Color Ramps

### Primary Palette

#### Neon Red (Accent)
```css
--rb-neon-red-50:  #ffe5e5
--rb-neon-red-100: #ffcccc
--rb-neon-red-200: #ff9999
--rb-neon-red-300: #ff6666
--rb-neon-red-400: #ff3333
--rb-neon-red-500: #ff0000  /* Primary brand color */
--rb-neon-red-600: #cc0000
--rb-neon-red-700: #990000
--rb-neon-red-800: #660000
--rb-neon-red-900: #330000
```

#### Electric Blue (Interactive)
```css
--rb-electric-blue-50:  #e6f3ff
--rb-electric-blue-100: #cce7ff
--rb-electric-blue-200: #99cfff
--rb-electric-blue-300: #66b7ff
--rb-electric-blue-400: #339fff
--rb-electric-blue-500: #0087ff  /* Primary interactive */
--rb-electric-blue-600: #006ccc
--rb-electric-blue-700: #005199
--rb-electric-blue-800: #003666
--rb-electric-blue-900: #001b33
```

#### Cyber Purple (Logic)
```css
--rb-cyber-purple-50:  #f3e6ff
--rb-cyber-purple-100: #e6ccff
--rb-cyber-purple-200: #cc99ff
--rb-cyber-purple-300: #b366ff
--rb-cyber-purple-400: #9933ff
--rb-cyber-purple-500: #8000ff  /* Logic/circuit accent */
--rb-cyber-purple-600: #6600cc
--rb-cyber-purple-700: #4d0099
--rb-cyber-purple-800: #330066
--rb-cyber-purple-900: #1a0033
```

### Secondary Palette

#### Neutral Gray
```css
--rb-neutral-50:  #f8f9fa
--rb-neutral-100: #e9ecef
--rb-neutral-200: #dee2e6
--rb-neutral-300: #ced4da
--rb-neutral-400: #adb5bd
--rb-neutral-500: #6c757d
--rb-neutral-600: #495057
--rb-neutral-700: #343a40
--rb-neutral-800: #212529
--rb-neutral-900: #0a0c0e
```

#### Success Green
```css
--rb-success-50:  #e6fff2
--rb-success-100: #ccffe5
--rb-success-200: #99ffcc
--rb-success-300: #66ffb2
--rb-success-400: #33ff99
--rb-success-500: #00ff7f  /* System success */
--rb-success-600: #00cc66
--rb-success-700: #00994d
--rb-success-800: #006633
--rb-success-900: #00331a
```

#### Warning Amber
```css
--rb-warning-50:  #fff8e6
--rb-warning-100: #fff0cc
--rb-warning-200: #ffe199
--rb-warning-300: #ffd166
--rb-warning-400: #ffc233
--rb-warning-500: #ffb300  /* System warning */
--rb-warning-600: #cc8f00
--rb-warning-700: #996b00
--rb-warning-800: #664800
--rb-warning-900: #332400
```

#### Error Orange-Red
```css
--rb-error-50:  #fff3e6
--rb-error-100: #ffe6cc
--rb-error-200: #ffcc99
--rb-error-300: #ffb366
--rb-error-400: #ff9933
--rb-error-500: #ff6600  /* System error */
--rb-error-600: #cc5200
--rb-error-700: #993d00
--rb-error-800: #662900
--rb-error-900: #331400
```

## Typography

### Font Stack
```css
--rb-font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
--rb-font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
```

### Scale
```css
--rb-font-size-xs:   0.75rem  /* 12px */
--rb-font-size-sm:   0.875rem /* 14px */
--rb-font-size-base: 1rem     /* 16px */
--rb-font-size-lg:   1.125rem /* 18px */
--rb-font-size-xl:   1.25rem  /* 20px */
--rb-font-size-2xl:  1.5rem   /* 24px */
--rb-font-size-3xl:  1.875rem /* 30px */
--rb-font-size-4xl:  2.25rem  /* 36px */
```

## Tone & Voice

### Brand Personality
RedByte speaks with:
- **Precision**: Technical accuracy without jargon overload
- **Innovation**: Forward-thinking, experimental, cutting-edge
- **Accessibility**: Complex concepts explained simply
- **Energy**: Active voice, dynamic language, momentum

### Writing Style

#### Do
- Use active voice: "Build circuits" not "Circuits can be built"
- Lead with benefits: "Visualize logic flows in 3D" not "3D visualization is available"
- Be specific: "Simulate AND, OR, XOR gates" not "Simulate various gates"
- Use parallel structure: "Build • Simulate • Understand"

#### Don't
- Avoid passive constructions
- Skip unnecessary modifiers ("very", "really", "quite")
- No marketing fluff or empty superlatives
- Don't assume expertise — define terms inline

### Messaging Pillars

1. **Visual Learning**: See how circuits work, don't just read about them
2. **Interactive Exploration**: Click, drag, connect — learn by doing
3. **Real-Time Feedback**: Instant simulation results as you build
4. **Zero Setup**: No installation, no configuration — just start building

## Application

### UI Elements
- Primary actions: Neon Red (#ff0000)
- Secondary actions: Electric Blue (#0087ff)
- Success states: Success Green (#00ff7f)
- Warnings: Warning Amber (#ffb300)
- Errors: Error Orange-Red (#ff6600)
- Neutral elements: Neutral Gray scale

### Backgrounds
- Light mode base: `--rb-neutral-50`
- Dark mode base: `--rb-neutral-900`
- Elevated surfaces: One step lighter than base
- Interactive hover: Subtle glow effect with brand colors

### Animations
- Duration: Fast (150ms), Standard (250ms), Slow (350ms)
- Easing: `cubic-bezier(0.4, 0.0, 0.2, 1)` — Material Design standard
- Glow effects: Use `box-shadow` with brand colors at low opacity

## Wallpapers

### Neon Circuit
Dark background with glowing circuit traces in neon red, electric blue, and cyber purple. Animated subtle pulse effect on nodes.

### Frost Grid
Light background with subtle grid pattern. Clean, minimal, professional. Blue-gray tones with electric blue accents.

## Social & Meta

### Tagline
**Build • Simulate • Understand**

### Description
RedByte is a visual logic circuit simulator. Build digital circuits, simulate behavior in real-time, and understand how logic gates work — all in your browser.

### Keywords
- Logic circuit simulator
- Digital logic design
- Visual circuit builder
- Boolean logic tool
- Educational electronics
- Interactive circuit simulator
- Logic gate playground
- Digital design learning

---

*Last updated: 2025-12-08*
