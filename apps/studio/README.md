# RedByte OS Genesis - Studio

Interactive studio environment for demos, examples, and experimentation.

## Purpose

The Studio app provides:

- **Component Playground**: Live interactive demos of all UI components
- **Logic Circuit Demos**: Pre-built circuit examples (gates, adders, CPU)
- **Interactive Tutorials**: Step-by-step guided experiences
- **Performance Tools**: Profiling and optimization utilities
- **3D Showcase**: Isometric and 3D visualization examples

## Features

### Component Playground
- Browse all @redbyte/* components
- Adjust props in real-time
- View source code and examples
- Copy-paste ready snippets

### Logic Circuit Gallery
- AND/OR/NOT gates
- Half/Full adders
- Multiplexers and decoders
- ALU components
- Simple CPU example

### Tutorials
- "Build Your First Gate"
- "Creating a 4-bit Adder"
- "Designing a Simple CPU"
- "3D Visualization Basics"

## Development

```bash
# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Architecture

Built with:
- Vite for fast dev/build
- React 19 for UI
- All @redbyte/* packages
- Monaco Editor for code editing
- React Three Fiber for 3D

## License

MIT
