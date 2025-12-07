import { describe, expect, it } from "vitest";
import { Tokens, tokensDarkNeon, tokensLightFrost, tokensToCssVars } from "./index";

describe("tokens", () => {
  it("matches the Tokens structure", () => {
    const check = (tokens: Tokens): void => {
      expect(tokens.color.accent["500"]).toBeTypeOf("string");
      expect(tokens.spacing.md).toBeTruthy();
      expect(tokens.typography.weights.bold).toBeGreaterThan(0);
    };

    check(tokensDarkNeon);
    check(tokensLightFrost);
  });

  it("converts tokens to css vars", () => {
    const vars = tokensToCssVars(tokensDarkNeon);
    expect(vars["--rb-color-accent-500"]).toBe(tokensDarkNeon.color.accent["500"]);
    expect(vars["--rb-radius-md"]).toBe(tokensDarkNeon.radius.md);
    expect(vars["--rb-typography-sizes-2xl"]).toBe(tokensDarkNeon.typography.sizes["2xl"]);
    expect(Object.keys(vars)).toMatchSnapshot();
  });
});
