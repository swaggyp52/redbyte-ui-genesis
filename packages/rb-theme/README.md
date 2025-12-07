# @redbyte/rb-theme

Theme system for RedByte OS Genesis with React provider and theme management.

## Features

- React Context API for theme management
- LocalStorage persistence
- Built-in themes: Neon, Carbon, Midnight
- TypeScript strict mode compliance
- Tailwind CSS integration

## Installation

```bash
pnpm add @redbyte/rb-theme
```

## Usage

### Basic Setup

```tsx
import { ThemeProvider } from '@redbyte/rb-theme';

function App() {
  return (
    <ThemeProvider>
      <YourApp />
    </ThemeProvider>
  );
}
```

### Using Theme in Components

```tsx
import { useTheme } from '@redbyte/rb-theme';

function MyComponent() {
  const { theme, themeId, setThemeId } = useTheme();

  return (
    <div>
      <p>Current theme: {theme.name}</p>
      <button onClick={() => setThemeId('carbon')}>
        Switch to Carbon
      </button>
    </div>
  );
}
```

## License

MIT
