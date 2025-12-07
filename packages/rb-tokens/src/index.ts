export interface Tokens {
  color: {
    [scale: string]: {
      [shade: string]: string;
    };
  };
  radius: { sm: string; md: string; lg: string; xl: string };
  shadow: { soft: string; hard: string; glow: string };
  motion: { fast: string; normal: string; slow: string };
  spacing: { xs: string; sm: string; md: string; lg: string; xl: string };
  typography: {
    fontFamily: string;
    weights: { regular: number; medium: number; bold: number };
    sizes: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      "2xl": string;
    };
  };
}

const baseRadius = { sm: "4px", md: "8px", lg: "12px", xl: "16px" };
const baseShadow = {
  soft: "0 10px 30px rgba(0,0,0,0.25)",
  hard: "0 0 0 1px rgba(255,255,255,0.08)",
  glow: "0 0 25px rgba(0,255,255,0.45)",
};
const baseMotion = { fast: "120ms", normal: "200ms", slow: "320ms" };
const baseSpacing = { xs: "4px", sm: "8px", md: "12px", lg: "16px", xl: "24px" };
const baseTypography = {
  fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  weights: { regular: 400, medium: 500, bold: 700 },
  sizes: { xs: "0.75rem", sm: "0.875rem", md: "1rem", lg: "1.25rem", xl: "1.5rem", "2xl": "1.875rem" },
};

export const tokensDarkNeon: Tokens = {
  color: {
    accent: {
      50: "#e8f7ff",
      100: "#c6ebff",
      200: "#95dbff",
      300: "#5ec7ff",
      400: "#24b1ff",
      500: "#0097e6",
      600: "#0072b4",
      700: "#004f82",
      800: "#003352",
      900: "#011b2e",
    },
    surface: {
      50: "#0b1020",
      100: "#0e1328",
      200: "#111a36",
      300: "#132143",
      400: "#152a56",
      500: "#1a2f63",
      600: "#1f3470",
      700: "#253c82",
      800: "#2d4798",
      900: "#3651a8",
    },
    text: {
      50: "#f8fbff",
      100: "#e2e8f5",
      200: "#c4cee5",
      300: "#9ea8c6",
      400: "#7c87a7",
      500: "#5b6687",
      600: "#444d6b",
      700: "#323956",
      800: "#242b43",
      900: "#161b2d",
    },
  },
  radius: baseRadius,
  shadow: baseShadow,
  motion: baseMotion,
  spacing: baseSpacing,
  typography: baseTypography,
};

export const tokensLightFrost: Tokens = {
  color: {
    accent: {
      50: "#eef8ff",
      100: "#d9ecff",
      200: "#b7d9ff",
      300: "#92c3ff",
      400: "#6eacff",
      500: "#4a95f6",
      600: "#2f7bdc",
      700: "#1f63b3",
      800: "#174c8b",
      900: "#103665",
    },
    surface: {
      50: "#f6fbff",
      100: "#edf4fb",
      200: "#dbe7f3",
      300: "#c3d4e6",
      400: "#a6bfd6",
      500: "#87a6c2",
      600: "#6a8fad",
      700: "#527796",
      800: "#3f5f7c",
      900: "#304863",
    },
    text: {
      50: "#0e1625",
      100: "#1b2433",
      200: "#273141",
      300: "#323f52",
      400: "#3d4c63",
      500: "#4c5e7a",
      600: "#5d7090",
      700: "#6f81a5",
      800: "#8192b8",
      900: "#9aa8cb",
    },
  },
  radius: baseRadius,
  shadow: {
    soft: "0 8px 24px rgba(12, 38, 80, 0.12)",
    hard: "0 0 0 1px rgba(0, 39, 94, 0.08)",
    glow: "0 0 20px rgba(74, 149, 246, 0.35)",
  },
  motion: baseMotion,
  spacing: baseSpacing,
  typography: baseTypography,
};

export function tokensToCssVars(tokens: Tokens, prefix = "--rb"): Record<string, string> {
  const result: Record<string, string> = {};

  const walk = (value: unknown, path: string[]): void => {
    if (typeof value === "string" || typeof value === "number") {
      const name = `${prefix}-${path.join("-")}`;
      result[name] = String(value);
      return;
    }

    if (value && typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
        walk(val, [...path, key]);
      });
    }
  };

  walk(tokens, []);

  return result;
}
