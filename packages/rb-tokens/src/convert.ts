export function tokensToCSSVariables(tokens: Record<string, string>): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key in tokens) {
    vars[`--rb-${key}`] = tokens[key];
  }
  return vars;
}
