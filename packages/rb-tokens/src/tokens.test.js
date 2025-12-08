import { describe, it, expect } from 'vitest';
import { tokensDarkNeon, tokensLightFrost, tokensToCSSVariables } from './index';
describe('@rb/rb-tokens', () => {
    describe('tokensDarkNeon', () => {
        it('has all required top-level properties', () => {
            expect(tokensDarkNeon).toHaveProperty('color');
            expect(tokensDarkNeon).toHaveProperty('radius');
            expect(tokensDarkNeon).toHaveProperty('shadow');
            expect(tokensDarkNeon).toHaveProperty('spacing');
            expect(tokensDarkNeon).toHaveProperty('typography');
            expect(tokensDarkNeon).toHaveProperty('motion');
        });
        it('has complete color scales', () => {
            const colorCategories = ['accent', 'neutral', 'success', 'warning', 'error', 'info'];
            colorCategories.forEach((category) => {
                expect(tokensDarkNeon.color).toHaveProperty(category);
                const scale = tokensDarkNeon.color[category];
                // Each color scale should have shades 50-900
                expect(scale).toHaveProperty('50');
                expect(scale).toHaveProperty('100');
                expect(scale).toHaveProperty('200');
                expect(scale).toHaveProperty('300');
                expect(scale).toHaveProperty('400');
                expect(scale).toHaveProperty('500');
                expect(scale).toHaveProperty('600');
                expect(scale).toHaveProperty('700');
                expect(scale).toHaveProperty('800');
                expect(scale).toHaveProperty('900');
            });
        });
        it('has all radius values', () => {
            expect(tokensDarkNeon.radius).toHaveProperty('none');
            expect(tokensDarkNeon.radius).toHaveProperty('sm');
            expect(tokensDarkNeon.radius).toHaveProperty('md');
            expect(tokensDarkNeon.radius).toHaveProperty('lg');
            expect(tokensDarkNeon.radius).toHaveProperty('xl');
            expect(tokensDarkNeon.radius).toHaveProperty('2xl');
            expect(tokensDarkNeon.radius).toHaveProperty('3xl');
            expect(tokensDarkNeon.radius).toHaveProperty('full');
        });
        it('has all shadow values', () => {
            expect(tokensDarkNeon.shadow).toHaveProperty('none');
            expect(tokensDarkNeon.shadow).toHaveProperty('sm');
            expect(tokensDarkNeon.shadow).toHaveProperty('md');
            expect(tokensDarkNeon.shadow).toHaveProperty('lg');
            expect(tokensDarkNeon.shadow).toHaveProperty('xl');
            expect(tokensDarkNeon.shadow).toHaveProperty('2xl');
            expect(tokensDarkNeon.shadow).toHaveProperty('inner');
        });
        it('has complete typography tokens', () => {
            expect(tokensDarkNeon.typography).toHaveProperty('fontFamily');
            expect(tokensDarkNeon.typography).toHaveProperty('fontSize');
            expect(tokensDarkNeon.typography).toHaveProperty('fontWeight');
            expect(tokensDarkNeon.typography).toHaveProperty('lineHeight');
            expect(tokensDarkNeon.typography).toHaveProperty('letterSpacing');
        });
        it('has motion tokens', () => {
            expect(tokensDarkNeon.motion).toHaveProperty('duration');
            expect(tokensDarkNeon.motion).toHaveProperty('easing');
            expect(tokensDarkNeon.motion.duration).toHaveProperty('instant');
            expect(tokensDarkNeon.motion.duration).toHaveProperty('fast');
            expect(tokensDarkNeon.motion.duration).toHaveProperty('normal');
        });
    });
    describe('tokensLightFrost', () => {
        it('has the same structure as dark neon', () => {
            expect(tokensLightFrost).toHaveProperty('color');
            expect(tokensLightFrost).toHaveProperty('radius');
            expect(tokensLightFrost).toHaveProperty('shadow');
            expect(tokensLightFrost).toHaveProperty('spacing');
            expect(tokensLightFrost).toHaveProperty('typography');
            expect(tokensLightFrost).toHaveProperty('motion');
        });
        it('has inverted neutral colors (light theme)', () => {
            // Light theme should have lighter neutrals at higher numbers
            const lightNeutral900 = tokensLightFrost.color.neutral['900'];
            const lightNeutral50 = tokensLightFrost.color.neutral['50'];
            // 900 should be lighter than 50 in light theme
            expect(lightNeutral900).toMatch(/#[fF]/); // Starts with f (light)
            expect(lightNeutral50).toMatch(/#[01]/); // Starts with 0-1 (dark)
        });
    });
    describe('tokensToCSSVariables', () => {
        it('generates CSS variables from tokens', () => {
            const cssVars = tokensToCSSVariables(tokensDarkNeon);
            expect(cssVars).toHaveProperty('--rb-color-accent-500');
            expect(cssVars).toHaveProperty('--rb-radius-md');
            expect(cssVars).toHaveProperty('--rb-shadow-lg');
            expect(cssVars).toHaveProperty('--rb-spacing-4');
            expect(cssVars).toHaveProperty('--rb-font-size-base');
        });
        it('generates correct color variable names', () => {
            const cssVars = tokensToCSSVariables(tokensDarkNeon);
            // Check accent color scale
            expect(cssVars['--rb-color-accent-50']).toBe(tokensDarkNeon.color.accent['50']);
            expect(cssVars['--rb-color-accent-500']).toBe(tokensDarkNeon.color.accent['500']);
            expect(cssVars['--rb-color-accent-900']).toBe(tokensDarkNeon.color.accent['900']);
        });
        it('generates correct radius variables', () => {
            const cssVars = tokensToCSSVariables(tokensDarkNeon);
            expect(cssVars['--rb-radius-sm']).toBe(tokensDarkNeon.radius.sm);
            expect(cssVars['--rb-radius-full']).toBe(tokensDarkNeon.radius.full);
        });
        it('generates correct typography variables', () => {
            const cssVars = tokensToCSSVariables(tokensDarkNeon);
            expect(cssVars['--rb-font-family-sans']).toBe(tokensDarkNeon.typography.fontFamily.sans);
            expect(cssVars['--rb-font-size-base']).toBe(tokensDarkNeon.typography.fontSize.base);
            expect(cssVars['--rb-font-weight-bold']).toBe(tokensDarkNeon.typography.fontWeight.bold);
        });
        it('generates correct motion variables', () => {
            const cssVars = tokensToCSSVariables(tokensDarkNeon);
            expect(cssVars['--rb-duration-fast']).toBe(tokensDarkNeon.motion.duration.fast);
            expect(cssVars['--rb-easing-inOut']).toBe(tokensDarkNeon.motion.easing.inOut);
        });
        it('matches snapshot for dark-neon', () => {
            const cssVars = tokensToCSSVariables(tokensDarkNeon);
            expect(cssVars).toMatchSnapshot();
        });
        it('matches snapshot for light-frost', () => {
            const cssVars = tokensToCSSVariables(tokensLightFrost);
            expect(cssVars).toMatchSnapshot();
        });
    });
});
