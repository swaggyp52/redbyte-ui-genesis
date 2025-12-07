# @redbyte/rb-shell

Shell window container and boot system for RedByte OS Genesis.

## Components

### BootScreen

Animated boot screen with 15-second progress sequence.

```tsx
import { BootScreen } from '@redbyte/rb-shell';

<BootScreen onComplete={() => console.log('Done!')} />
```

### UniverseOrb

Animated orb with circuit visualization.

```tsx
import { UniverseOrb } from '@redbyte/rb-shell';

<UniverseOrb progress={0.5} />
```

## License

MIT
