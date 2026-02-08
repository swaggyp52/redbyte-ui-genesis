// Validate evidence against a LabSpecV1
// Returns a structured ValidationResult for UI guidance
export function validateEvidenceAgainstLabSpec(evidence, labSpec) {
    const result = {};
    // Probes check
    if (labSpec.requirements?.probes) {
        result.probes = {};
        for (const probe of labSpec.requirements.probes) {
            result.probes[probe] = evidence.probes?.some(p => p.name === probe)
                ? 'present'
                : 'missing';
        }
    }
    // Ticks check
    if (labSpec.requirements?.minTicks !== undefined) {
        const observed = evidence.ticks?.length || 0;
        result.ticks = {
            required: labSpec.requirements.minTicks,
            observed,
            status: observed >= labSpec.requirements.minTicks
                ? 'sufficient'
                : 'insufficient',
        };
    }
    else {
        result.ticks = { status: 'not-checked' };
    }
    // Example ID check
    if (labSpec.requiredExampleId) {
        result.exampleMatch =
            evidence.exampleId === labSpec.requiredExampleId
                ? 'match'
                : 'mismatch';
    }
    else {
        result.exampleMatch = 'not-checked';
    }
    return result;
}
