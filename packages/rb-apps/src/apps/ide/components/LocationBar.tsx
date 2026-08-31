import React from 'react';

/**
 * Engineering location bar — the workbench's "where am I" trail plus
 * Back / Forward / Up. Presentational: the shell resolves the path and the
 * navigation capabilities from the (single-authority) mode + hierarchy and the
 * navigation history store, and passes them in.
 */

export interface LocationSegment {
  key: string;
  label: string;
  kind: 'mode' | 'module';
  /** Present when the segment is navigable (a module in the drill chain). */
  onSelect?: () => void;
}

export interface LocationBarProps {
  readonly segments: LocationSegment[];
  readonly canBack: boolean;
  readonly canForward: boolean;
  readonly canUp: boolean;
  readonly onBack: () => void;
  readonly onForward: () => void;
  readonly onUp: () => void;
}

export const LocationBar: React.FC<LocationBarProps> = ({
  segments,
  canBack,
  canForward,
  canUp,
  onBack,
  onForward,
  onUp,
}) => {
  return (
    <div className="ide-location-bar" data-testid="ide-location-bar" role="navigation" aria-label="Engineering location">
      <div className="ide-location-nav" role="group" aria-label="History">
        <button
          type="button"
          className="ide-location-btn"
          data-testid="ide-location-back"
          onClick={onBack}
          disabled={!canBack}
          title="Back"
          aria-label="Back"
        >
          ‹
        </button>
        <button
          type="button"
          className="ide-location-btn"
          data-testid="ide-location-forward"
          onClick={onForward}
          disabled={!canForward}
          title="Forward"
          aria-label="Forward"
        >
          ›
        </button>
        <button
          type="button"
          className="ide-location-btn ide-location-up"
          data-testid="ide-location-up"
          onClick={onUp}
          disabled={!canUp}
          title="Up to parent module"
          aria-label="Up to parent module"
        >
          ↑
        </button>
      </div>
      <ol className="ide-location-path" data-testid="ide-location-path">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          return (
            <li
              key={segment.key}
              className={`ide-location-segment is-${segment.kind}${isLast ? ' is-current' : ''}`}
              data-testid={`ide-location-segment-${index}`}
              aria-current={isLast ? 'page' : undefined}
            >
              {segment.onSelect && !isLast ? (
                <button
                  type="button"
                  className="ide-location-segment-btn"
                  onClick={segment.onSelect}
                  data-testid={`ide-location-segment-btn-${index}`}
                >
                  {segment.label}
                </button>
              ) : (
                <span className="ide-location-segment-label">{segment.label}</span>
              )}
              {!isLast ? <span className="ide-location-sep" aria-hidden="true">›</span> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
