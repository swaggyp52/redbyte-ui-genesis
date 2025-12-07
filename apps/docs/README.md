# RedByte OS Genesis - Documentation

VitePress-powered documentation site for the entire RedByte OS Genesis platform.

## Purpose

Comprehensive documentation covering:

- **Getting Started**: Installation, setup, and first steps
- **API Reference**: Complete API docs for all @redbyte/* packages
- **Design System**: Tokens, themes, components, and patterns
- **Logic Circuit Guide**: Building and simulating digital circuits
- **Architecture**: System design, data flow, and best practices
- **Examples**: Code samples, demos, and tutorials

## Structure

```
docs/
├── .vitepress/         # VitePress config
├── guide/              # User guides
├── api/                # API reference
├── design/             # Design system docs
├── logic/              # Logic circuit tutorials
└── examples/           # Code examples
```

## Development

```bash
# Start dev server
pnpm dev

# Build static site
pnpm build

# Preview production build
pnpm preview
```

## Deployment

Built site deploys to Cloudflare Pages on push to main via GitHub Actions.

## License

MIT
