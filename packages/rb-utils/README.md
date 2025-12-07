# @redbyte/rb-utils

Utility functions for RedByte OS Genesis.

## Purpose

Common utilities and helpers:

- **cn()**: Tailwind class name merger
- **debounce()**: Function debouncing
- **throttle()**: Function throttling
- **clamp()**: Number clamping
- **formatters**: Date, number, bytes formatters
- **validators**: Input validation helpers

## Status

🚧 **Placeholder** - Ready for implementation in Stage B

## Planned API

```ts
import { cn, debounce, clamp } from '@redbyte/rb-utils';

const className = cn('base', condition && 'active');
const debouncedFn = debounce(() => {}, 300);
const value = clamp(num, 0, 100);
```

## License

MIT
