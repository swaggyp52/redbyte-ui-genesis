export type ColorStep =
  | '50'
  | '100'
  | '200'
  | '300'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900';

export type ColorScale = Record<ColorStep, string>;

export interface Tokens {
  color: {
    accent: ColorScale;
    primary: ColorScale;
    neutral: ColorScale;
    danger: ColorScale;
    success: ColorScale;
    warning: ColorScale;
    surface: ColorScale;
  };
  radius: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  shadow: {
    sm: string;
    md: string;
    lg: string;
    inner: string;
  };
  motion: {
    duration: {
      instant: string;
      fast: string;
      normal: string;
      slow: string;
    };
    easing: {
      standard: string;
      emphasized: string;
      entrance: string;
      exit: string;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
  };
  typography: {
    fontFamily: string;
    size: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
    lineHeight: {
      tight: string;
      snug: string;
      normal: string;
      relaxed: string;
    };
    weight: {
      regular: number;
      medium: number;
      bold: number;
    };
  };
}

const baseRadius = {
  xs: '4px',
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '18px',
} as const;

const baseShadow = {
  sm: '0 1px 2px rgba(0,0,0,0.18)',
  md: '0 8px 24px rgba(0,0,0,0.18)',
  lg: '0 18px 36px rgba(0,0,0,0.28)',
  inner: 'inset 0 1px 0 rgba(255,255,255,0.06)',
} as const;

const baseMotion = {
  duration: {
    instant: '75ms',
    fast: '150ms',
    normal: '240ms',
    slow: '360ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    entrance: 'cubic-bezier(0.3, 0, 0.2, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;

const baseSpacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
} as const;

const baseTypography = {
  fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
  size: {
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '20px',
    xl: '24px',
  },
  lineHeight: {
    tight: '1.1',
    snug: '1.25',
    normal: '1.4',
    relaxed: '1.6',
  },
  weight: {
    regular: 400,
    medium: 600,
    bold: 700,
  },
} as const;

const darkScale = (base: string): ColorScale => ({
  '50': `${base}0a`,
  '100': `${base}14`,
  '200': `${base}1f`,
  '300': `${base}33`,
  '400': `${base}52`,
  '500': `${base}73`,
  '600': `${base}94`,
  '700': `${base}b8`,
  '800': `${base}db`,
  '900': `${base}ff`,
});

const lightScale = (base: string): ColorScale => ({
  '50': `${base}ff`,
  '100': `${base}f2`,
  '200': `${base}e6`,
  '300': `${base}d9`,
  '400': `${base}cc`,
  '500': `${base}bf`,
  '600': `${base}b3`,
  '700': `${base}a6`,
  '800': `${base}99`,
  '900': `${base}8c`,
});

export const tokensDarkNeon: Tokens = {
  color: {
    accent: darkScale('#7cf0f0'),
    primary: darkScale('#6c7cff'),
    neutral: darkScale('#8ca0b3'),
    danger: darkScale('#ff5f6d'),
    success: darkScale('#6cfab6'),
    warning: darkScale('#ffc860'),
    surface: darkScale('#0d1017'),
  },
  radius: baseRadius,
  shadow: baseShadow,
  motion: baseMotion,
  spacing: baseSpacing,
  typography: baseTypography,
};

export const tokensLightFrost: Tokens = {
  color: {
    accent: lightScale('#15b8d6'),
    primary: lightScale('#3b5bd6'),
    neutral: lightScale('#1d1f21'),
    danger: lightScale('#e23e57'),
    success: lightScale('#1f9d6e'),
    warning: lightScale('#c87b1f'),
    surface: lightScale('#f6f8fb'),
  },
  radius: baseRadius,
  shadow: baseShadow,
  motion: baseMotion,
  spacing: baseSpacing,
  typography: baseTypography,
};

export type TokenVariant = 'dark-neon' | 'light-frost';

const tokenVariantMap: Record<TokenVariant, Tokens> = {
  'dark-neon': tokensDarkNeon,
  'light-frost': tokensLightFrost,
};

const toKebab = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();

export const tokensToCssVariables = (tokens: Tokens): Record<string, string> => {
  const entries: Record<string, string> = {};
  const traverse = (value: unknown, path: string[]) => {
    if (typeof value === 'string' || typeof value === 'number') {
      const variableName = `--rb-${path.map(toKebab).join('-')}`;
      entries[variableName] = `${value}`;
      return;
    }

    if (value && typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([key, nestedValue]) => {
        traverse(nestedValue, [...path, key]);
      });
    }
  };

  traverse(tokens, []);
  return entries;
};

export const getTokensForVariant = (variant: TokenVariant): Tokens => tokenVariantMap[variant];
