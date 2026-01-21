/**
 * RedByte Assignment Schema v1
 * Defines the structure for an instructor-authored assignment file.
 */

export interface HelperGateConstraint {
    gate: string; // e.g., "AND", "OR"
    limit?: number; // Max instances allowed
}

export interface VerificationSpec {
    /**
     * SHA-256 hash of the "Golden Trace" (the perfect solution's trace).
     * Used to verify that the student's output matches the reference implementation.
     */
    golden_trace_hash: string;

    /**
     * The stimulus file used to generate the golden trace.
     * This ensures the student is tested against the same inputs.
     */
    stimulus_file: string;

    /**
     * List of signal names that must be present in the student's trace.
     * e.g., ["Sum", "Carry"]
     */
    required_signals: string[];

    /**
     * Tolerance for comparison (usually 0 for digital logic).
     */
    tolerance_ticks?: number;
}

export interface AssignmentV1 {
    schema: "redbyte/assignment/v1";

    meta: {
        id: string; // unique assignment ID
        title: string;
        course: string;
        version: string;
        due_date?: string; // ISO 8601
    };

    /**
     * Constraints on the student's design.
     */
    constraints: {
        /**
         * List of allowed component types.
         * If empty/undefined, all components are allowed.
         */
        allowed_components?: string[];

        /**
         * List of forbidden component types.
         */
        forbidden_components?: string[];

        /**
         * Maximum number of primitive gates allowed.
         */
        max_gates?: number;

        /**
         * Required clock frequency for the hardware run (Hz).
         * If undefined, any frequency is allowed.
         */
        required_frequency_hz?: number;
    };

    /**
     * Verification rules for grading.
     */
    verification: VerificationSpec;
}
