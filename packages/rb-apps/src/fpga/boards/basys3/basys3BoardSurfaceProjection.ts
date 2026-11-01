import {
  BASYS3_BOARD_PROFILE,
  listBasys3CompatibleResources,
  type Basys3BoardResource,
  type Basys3SignalCompatibilityCandidate,
} from './basys3Pins';

export type Basys3DesignBoardResourceKind =
  | 'switch'
  | 'button'
  | 'clock'
  | 'reset'
  | 'led'
  | 'segment'
  | 'anode'
  | 'dp';

export type Basys3DesignBoardResourceSource =
  | {
      readonly kind: 'board-profile';
      readonly profileId: typeof BASYS3_BOARD_PROFILE.id;
      readonly profileVersion: typeof BASYS3_BOARD_PROFILE.version;
      readonly resourceId: string;
    }
  | {
      readonly kind: 'synthetic-non-board';
      readonly reason: string;
    };

export interface Basys3DesignBoardResourceItem {
  /** Existing student-facing Design alias. */
  readonly alias: string;
  /** Official board alias when this item projects a physical Basys3 resource. */
  readonly boardAlias: string | null;
  readonly direction: 'in' | 'out';
  readonly kind: Basys3DesignBoardResourceKind;
  readonly source: Basys3DesignBoardResourceSource;
}

const DESIGN_KIND_ORDER: Readonly<Record<Basys3DesignBoardResourceKind, number>> = {
  switch: 0,
  button: 1,
  clock: 2,
  reset: 3,
  led: 4,
  segment: 5,
  anode: 6,
  dp: 7,
};

const SYNTHETIC_RESET_ITEM: Basys3DesignBoardResourceItem = Object.freeze({
  alias: 'RST',
  boardAlias: null,
  direction: 'in',
  kind: 'reset',
  source: Object.freeze({
    kind: 'synthetic-non-board',
    reason:
      'Logical reset input for circuit authoring; choose a compatible physical input in Map Pins.',
  }),
});

function boardProfileSource(
  resource: Basys3BoardResource
): Basys3DesignBoardResourceSource {
  return Object.freeze({
    kind: 'board-profile',
    profileId: BASYS3_BOARD_PROFILE.id,
    profileVersion: BASYS3_BOARD_PROFILE.version,
    resourceId: resource.id,
  });
}

function projectProfileResource(
  resource: Basys3BoardResource
): Basys3DesignBoardResourceItem | null {
  const common = {
    boardAlias: resource.alias,
    source: boardProfileSource(resource),
  } as const;

  switch (resource.category) {
    case 'switch':
      return Object.freeze({
        ...common,
        alias: resource.alias,
        direction: 'in',
        kind: 'switch',
      });
    case 'button':
      return Object.freeze({
        ...common,
        alias: resource.alias,
        direction: 'in',
        kind: 'button',
      });
    case 'clock':
      return Object.freeze({
        ...common,
        alias: resource.alias,
        direction: 'in',
        kind: 'clock',
      });
    case 'led':
      return Object.freeze({
        ...common,
        alias: resource.alias,
        direction: 'out',
        kind: 'led',
      });
    case 'seven_seg': {
      const segment = /^seg\[(\d+)\]$/i.exec(resource.xdcPort);
      if (segment) {
        return Object.freeze({
          ...common,
          // Preserve the existing Design authoring alias while retaining the
          // official CA-CG board identity in boardAlias/source.resourceId.
          alias: `SEG${segment[1]}`,
          direction: 'out',
          kind: 'segment',
        });
      }
      const anode = /^an\[(\d+)\]$/i.exec(resource.xdcPort);
      if (anode) {
        return Object.freeze({
          ...common,
          alias: `AN${anode[1]}`,
          direction: 'out',
          kind: 'anode',
        });
      }
      if (resource.xdcPort.toLowerCase() === 'dp') {
        return Object.freeze({
          ...common,
          alias: resource.alias,
          direction: 'out',
          kind: 'dp',
        });
      }
      return null;
    }
    default:
      return null;
  }
}

const PROFILE_DESIGN_ITEMS: readonly Basys3DesignBoardResourceItem[] = Object.freeze(
  BASYS3_BOARD_PROFILE.resources
    .filter((resource) => resource.supportedInPlanner)
    .map(projectProfileResource)
    .filter((item): item is Basys3DesignBoardResourceItem => item !== null)
    .sort((left, right) => DESIGN_KIND_ORDER[left.kind] - DESIGN_KIND_ORDER[right.kind])
);

/**
 * Projects versioned Basys3 profile facts into Design's existing palette
 * vocabulary and order. The logical RST helper is opt-in because it is not a
 * physical Basys3 resource.
 */
export function listBasys3DesignBoardResourceInventory(options: {
  includeSyntheticReset: boolean;
}): Basys3DesignBoardResourceItem[] {
  const items = options.includeSyntheticReset
    ? [...PROFILE_DESIGN_ITEMS, SYNTHETIC_RESET_ITEM]
    : [...PROFILE_DESIGN_ITEMS];
  return items.sort(
    (left, right) => DESIGN_KIND_ORDER[left.kind] - DESIGN_KIND_ORDER[right.kind]
  );
}

/**
 * Returns the profile-owned physical aliases compatible with an assignment
 * direction. Synthetic Design helpers such as RST are intentionally absent.
 */
export function listBasys3CompatibleBoardAliases(
  signal: Basys3SignalCompatibilityCandidate
): string[] {
  return listBasys3CompatibleResources(signal).map((resource) => resource.alias);
}
