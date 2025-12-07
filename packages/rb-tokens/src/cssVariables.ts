import type { RBTokens, CSSVariables, ColorScale } from './types';

/**
 * Flatten a color scale into CSS variable format
 */
function flattenColorScale(name: string, scale: ColorScale): CSSVariables {
  const vars: CSSVariables = {};
  Object.entries(scale).forEach(([shade, value]) => {
    vars[`--rb-color-${name}-${shade}`] = value;
  });
  return vars;
}

/**
 * Convert RBTokens to CSS custom properties (CSS variables)
 *
 * Example output:
 * {
 *   '--rb-color-accent-500': '#f43f5e',
 *   '--rb-radius-md': '0.375rem',
 *   '--rb-shadow-lg': '0 10px 15px...',
 *   ...
 * }
 */
export function tokensToCSSVariables(tokens: RBTokens): CSSVariables {
  const vars: CSSVariables = {};

  // Colors
  Object.entries(tokens.color).forEach(([colorName, colorScale]) => {
    Object.assign(vars, flattenColorScale(colorName, colorScale));
  });

  // Radius
  Object.entries(tokens.radius).forEach(([key, value]) => {
    vars[`--rb-radius-${key}`] = value;
  });

  // Shadow
  Object.entries(tokens.shadow).forEach(([key, value]) => {
    vars[`--rb-shadow-${key}`] = value;
  });

  // Spacing
  Object.entries(tokens.spacing).forEach(([key, value]) => {
    vars[`--rb-spacing-${key}`] = value;
  });

  // Typography - Font Family
  Object.entries(tokens.typography.fontFamily).forEach(([key, value]) => {
    vars[`--rb-font-family-${key}`] = value;
  });

  // Typography - Font Size
  Object.entries(tokens.typography.fontSize).forEach(([key, value]) => {
    vars[`--rb-font-size-${key}`] = value;
  });

  // Typography - Font Weight
  Object.entries(tokens.typography.fontWeight).forEach(([key, value]) => {
    vars[`--rb-font-weight-${key}`] = value;
  });

  // Typography - Line Height
  Object.entries(tokens.typography.lineHeight).forEach(([key, value]) => {
    vars[`--rb-line-height-${key}`] = value;
  });

  // Typography - Letter Spacing
  Object.entries(tokens.typography.letterSpacing).forEach(([key, value]) => {
    vars[`--rb-letter-spacing-${key}`] = value;
  });

  // Motion - Duration
  Object.entries(tokens.motion.duration).forEach(([key, value]) => {
    vars[`--rb-duration-${key}`] = value;
  });

  // Motion - Easing
  Object.entries(tokens.motion.easing).forEach(([key, value]) => {
    vars[`--rb-easing-${key}`] = value;
  });

  return vars;
}

/**
 * Apply CSS variables to a DOM element
 */
export function applyCSSVariables(
  element: HTMLElement,
  variables: CSSVariables
): void {
  Object.entries(variables).forEach(([property, value]) => {
    element.style.setProperty(property, value);
  });
}
