// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { RBTokens, CSSVariables, ColorScale } from './types';

function flattenColorScale(name: string, scale: ColorScale): CSSVariables {
  const vars: CSSVariables = {};
  Object.entries(scale).forEach(([shade, value]) => {
    vars[`--rb-color-${name}-${shade}`] = value;
  });
  return vars;
}

export function tokensToCSSVariables(tokens: RBTokens): CSSVariables {
  const vars: CSSVariables = {};
  Object.entries(tokens.color).forEach(([colorName, colorScale]) => {
    Object.assign(vars, flattenColorScale(colorName, colorScale));
  });
  Object.entries(tokens.radius).forEach(([key, value]) => {
    vars[`--rb-radius-${key}`] = value;
  });
  Object.entries(tokens.shadow).forEach(([key, value]) => {
    vars[`--rb-shadow-${key}`] = value;
  });
  Object.entries(tokens.spacing).forEach(([key, value]) => {
    vars[`--rb-spacing-${key}`] = value;
  });
  Object.entries(tokens.typography.fontFamily).forEach(([key, value]) => {
    vars[`--rb-font-family-${key}`] = value;
  });
  Object.entries(tokens.typography.fontSize).forEach(([key, value]) => {
    vars[`--rb-font-size-${key}`] = value;
  });
  Object.entries(tokens.typography.fontWeight).forEach(([key, value]) => {
    vars[`--rb-font-weight-${key}`] = value;
  });
  Object.entries(tokens.typography.lineHeight).forEach(([key, value]) => {
    vars[`--rb-line-height-${key}`] = value;
  });
  Object.entries(tokens.typography.letterSpacing).forEach(([key, value]) => {
    vars[`--rb-letter-spacing-${key}`] = value;
  });
  Object.entries(tokens.motion.duration).forEach(([key, value]) => {
    vars[`--rb-duration-${key}`] = value;
  });
  Object.entries(tokens.motion.easing).forEach(([key, value]) => {
    vars[`--rb-easing-${key}`] = value;
  });
  return vars;
}

export function applyCSSVariables(element: HTMLElement, variables: CSSVariables): void {
  Object.entries(variables).forEach(([property, value]) => {
    element.style.setProperty(property, value);
  });
}
