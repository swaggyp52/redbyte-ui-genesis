/**
 * Default `config` for newly placed design nodes.
 * Keep aligned with `evaluateRegisterFamily` in rb-logic-core builtins.
 */
export function defaultNodeConfig(nodeType: string): Record<string, unknown> {
  if (nodeType === 'Clock') {
    return { period: 10 };
  }
  if (nodeType === 'Register1') {
    return {
      width: 1,
      hasEnable: true,
      resetKind: 'none',
      resetPolarity: 'active_high',
      enablePolarity: 'active_high',
      clockPolarity: 'rising_edge',
    };
  }
  if (nodeType === 'RegisterBus' || nodeType === 'StateBank') {
    return {
      width: 8,
      hasEnable: true,
      resetKind: 'none',
      resetPolarity: 'active_high',
      enablePolarity: 'active_high',
      clockPolarity: 'rising_edge',
    };
  }
  return {};
}
