export function tokensToCSSVariables(tokens) {
    const vars = {};
    for (const key in tokens) {
        vars[`--rb-${key}`] = tokens[key];
    }
    return vars;
}
