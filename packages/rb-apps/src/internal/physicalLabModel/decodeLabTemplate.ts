import type { LabBehaviorCheck, LabTemplate, LabTemplatePinSelector } from './labTemplate';

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const optionalString = (value: unknown): boolean => value === undefined || typeof value === 'string';
const optionalNumber = (value: unknown): boolean => value === undefined || typeof value === 'number';
const selector = (value: unknown): value is LabTemplatePinSelector =>
  record(value) && typeof value.part === 'string' && Array.isArray(value.pins) &&
  value.pins.every((pin: unknown) => typeof pin === 'string') && optionalString(value.label) && optionalString(value.hint);
const behavior = (value: unknown): value is LabBehaviorCheck => {
  if (!record(value) || typeof value.id !== 'string' || !selector(value.pin) || !optionalString(value.hint)) return false;
  switch (value.type) {
    case 'blink': return typeof value.period_ticks === 'number' && typeof value.tolerance_ticks === 'number' && optionalNumber(value.min_cycles);
    case 'serial_matches_pin': return typeof value.on_text === 'string' && typeof value.off_text === 'string';
    case 'digital_level': return typeof value.value === 'number' && optionalNumber(value.min_ticks);
    default: return false;
  }
};

/** Structural decoder at the retained template-registry/evaluator boundary. */
export const isLabTemplate = (value: unknown): value is LabTemplate => {
  if (!record(value) || value.template_version !== 'virtual-lab.v1' ||
    typeof value.lab_id !== 'string' || typeof value.lab_version !== 'string' || typeof value.name !== 'string' ||
    !optionalString(value.summary) || !optionalString(value.hardware_target) || !optionalString(value.firmware_path)) return false;
  if (!Array.isArray(value.required_parts) || !value.required_parts.every((part: unknown) =>
    record(part) && typeof part.type === 'string' && typeof part.min === 'number' && optionalNumber(part.max))) return false;
  if (!Array.isArray(value.required_nets) || !value.required_nets.every((net: unknown) =>
    record(net) && typeof net.id === 'string' && typeof net.label === 'string' && optionalString(net.hint) &&
    Array.isArray(net.pins) && net.pins.every(selector))) return false;
  if (value.behavior_checks !== undefined && (!Array.isArray(value.behavior_checks) || !value.behavior_checks.every(behavior))) return false;
  if (value.guide !== undefined && (!Array.isArray(value.guide) || !value.guide.every((step: unknown) =>
    record(step) && typeof step.id === 'string' && typeof step.title === 'string' && typeof step.markdown === 'string' && optionalString(step.verify_criteria)))) return false;
  if (value.allowed_variations !== undefined) {
    if (!record(value.allowed_variations)) return false;
    const variations = value.allowed_variations;
    if (variations.resistor_values_ohms !== undefined && (!Array.isArray(variations.resistor_values_ohms) ||
      variations.resistor_values_ohms.length !== 2 || !variations.resistor_values_ohms.every((entry: unknown) => typeof entry === 'number'))) return false;
    if (variations.alternate_pins !== undefined && (!Array.isArray(variations.alternate_pins) ||
      !variations.alternate_pins.every((entry: unknown) => record(entry) && typeof entry.part === 'string' &&
        Array.isArray(entry.pins) && entry.pins.every((pin: unknown) => typeof pin === 'string')))) return false;
  }
  return true;
};

export function decodeLabTemplate(value: unknown): LabTemplate {
  if (!isLabTemplate(value)) throw new Error('Invalid physical lab template structure.');
  return value;
}
