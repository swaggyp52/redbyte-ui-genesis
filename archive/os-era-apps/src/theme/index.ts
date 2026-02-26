import type { ThemeTokenSet } from "./types";
import { neonTheme } from "./themes/neon";
import { carbonTheme } from "./themes/carbon";
import { midnightTheme } from "./themes/midnight";

export type { ThemeTokenSet };

export const themes: ThemeTokenSet[] = [neonTheme, carbonTheme, midnightTheme];

export { neonTheme, carbonTheme, midnightTheme };

// New canonical names
export const darkTheme = neonTheme;
export const lightTheme = carbonTheme;
