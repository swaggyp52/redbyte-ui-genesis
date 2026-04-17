// Copyright (c) 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { IdeButton, IdeCallout, IdeStatusPill } from './IdePrimitives';

/**
 * S3: Focused-asset banner shown on the Design surface after the Project
 * surface hands off a focus request. Purely presentational — the caller owns
 * the focus context, clearing actions, and back-navigation.
 *
 * Deliberately kept narrow: this banner communicates what is focused, why
 * the student landed here, and what to do next. Long descriptions live in the
 * right-dock focused-asset inspector (R3 reconciliation) so the canvas is not
 * stacked with duplicate prose. It does NOT introduce a new selection authority;
 * placement/palette state remains `activeMacroInsertionId` + `paletteQuery`.
 */

export type DesignFocusContext =
  | {
      kind: 'macro';
      macroId: string;
      name: string;
      ioSummary: string;
      description?: string;
    }
  | {
      kind: 'custom-component';
      componentName: string;
      description?: string;
    };

export interface DesignFocusBannerProps {
  context: DesignFocusContext;
  onClear: () => void;
  onBackToProject?: () => void;
  /**
   * Whether the macro is currently armed for click-to-place on the canvas.
   * Ignored for `custom-component` context — components are placed via the
   * palette drag flow.
   */
  isPlacementArmed?: boolean;
  testId?: string;
}

export const DesignFocusBanner: React.FC<DesignFocusBannerProps> = ({
  context,
  onClear,
  onBackToProject,
  isPlacementArmed = false,
  testId = 'ide-design-focus-banner',
}) => {
  const kindLabel = context.kind === 'macro' ? 'Macro' : 'Custom component';
  const displayName =
    context.kind === 'macro' ? context.name : context.componentName;

  // R3 reconciliation: placement mechanics stay in the canvas tool HUD; the banner
  // only orients + routes actions. Avoid duplicating the long "click to place" copy.
  let hint: string;
  if (context.kind === 'macro') {
    hint = isPlacementArmed
      ? 'Esc or Clear focus exits placement. (Placement steps also show in the canvas HUD.)'
      : 'Palette is filtered to this macro — click its card in the palette to arm click-to-place.';
  } else {
    hint =
      'Palette is filtered to this component — drag from the palette onto the canvas.';
  }

  return (
    <div
      className="ide-design-focus-banner"
      data-testid={testId}
      data-blocks-canvas-placement="1"
      data-blocks-macro-placement="1"
      data-focus-kind={context.kind}
      data-placement-armed={isPlacementArmed ? '1' : '0'}
    >
      <IdeCallout tone="info">
        <div className="ide-design-focus-banner-heading">
          <span
            className="ide-design-focus-banner-kind"
            data-testid={`${testId}-kind`}
          >
            {kindLabel}
          </span>
          <code
            className="ide-design-focus-banner-name"
            data-testid={`${testId}-name`}
          >
            {displayName}
          </code>
          {context.kind === 'macro' && (
            <IdeStatusPill tone={isPlacementArmed ? 'ok' : 'idle'}>
              {context.ioSummary}
            </IdeStatusPill>
          )}
          {context.kind === 'macro' && isPlacementArmed && (
            <span
              className="ide-design-focus-banner-armed"
              data-testid={`${testId}-armed`}
            >
              Armed for placement
            </span>
          )}
        </div>
        <div
          className="ide-design-focus-banner-hint"
          data-testid={`${testId}-hint`}
        >
          {hint}
        </div>
        <div className="ide-inline-actions ide-design-focus-banner-actions">
          <IdeButton
            tone="secondary"
            onClick={onClear}
            testId={`${testId}-clear`}
          >
            Clear focus
          </IdeButton>
          {onBackToProject && (
            <IdeButton
              tone="ghost"
              onClick={onBackToProject}
              testId={`${testId}-back-to-project`}
            >
              Back to Project
            </IdeButton>
          )}
        </div>
      </IdeCallout>
    </div>
  );
};
