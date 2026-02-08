// Copyright 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Validate Verilog HDL code for common syntax and semantic errors
 */
export function validateVerilog(verilogCode) {
    const errors = [];
    const warnings = [];
    const lines = verilogCode.split('\n');
    // Check for empty or whitespace-only code
    if (!verilogCode.trim()) {
        errors.push({
            message: 'Verilog code is empty',
            severity: 'error',
            code: 'EMPTY_CODE',
        });
        return { valid: false, errors, warnings };
    }
    // Extract module declaration
    const moduleMatch = verilogCode.match(/module\s+(\w+)\s*\(/);
    if (!moduleMatch) {
        errors.push({
            message: 'No module declaration found',
            severity: 'error',
            code: 'NO_MODULE',
        });
        return { valid: false, errors, warnings };
    }
    const moduleName = moduleMatch[1];
    // Find module declaration line
    const moduleLineIndex = lines.findIndex((line) => line.includes('module'));
    // Check for endmodule
    if (!verilogCode.includes('endmodule')) {
        errors.push({
            message: 'Missing endmodule declaration',
            severity: 'error',
            code: 'NO_ENDMODULE',
        });
    }
    // Extract ports from module declaration
    const portSection = extractPortSection(verilogCode);
    const inputs = [];
    const outputs = [];
    const wires = [];
    if (portSection) {
        // Extract input declarations
        const inputMatches = portSection.matchAll(/input\s+(?:wire\s+)?(?:\[[\d:]+\]\s+)?(\w+)/g);
        for (const match of inputMatches) {
            inputs.push(match[1]);
        }
        // Extract output declarations
        const outputMatches = portSection.matchAll(/output\s+(?:wire\s+|reg\s+)?(?:\[[\d:]+\]\s+)?(\w+)/g);
        for (const match of outputMatches) {
            outputs.push(match[1]);
        }
        // Warn if no ports defined
        if (inputs.length === 0 && outputs.length === 0) {
            warnings.push({
                line: moduleLineIndex + 1,
                message: 'Module has no input or output ports',
                severity: 'warning',
                code: 'NO_PORTS',
            });
        }
    }
    // Extract wire declarations
    const wireMatches = verilogCode.matchAll(/wire\s+(?:\[[\d:]+\]\s+)?(\w+)/g);
    for (const match of wireMatches) {
        wires.push(match[1]);
    }
    // Check for undefined signals in assignments
    const assignMatches = verilogCode.matchAll(/assign\s+(\w+)\s*=/g);
    for (const match of assignMatches) {
        const signal = match[1];
        if (!outputs.includes(signal) && !wires.includes(signal)) {
            const lineNum = findLineNumber(verilogCode, match.index || 0);
            warnings.push({
                line: lineNum,
                message: `Signal '${signal}' assigned but not declared as output or wire`,
                severity: 'warning',
                code: 'UNDECLARED_SIGNAL',
            });
        }
    }
    // Check for module instantiations referencing undefined signals
    const instMatches = verilogCode.matchAll(/\.(\w+)\((\w+)\)/g);
    const allSignals = [...inputs, ...outputs, ...wires];
    for (const match of instMatches) {
        const portName = match[1];
        const signal = match[2];
        if (!allSignals.includes(signal) && !isLiteral(signal)) {
            const lineNum = findLineNumber(verilogCode, match.index || 0);
            warnings.push({
                line: lineNum,
                message: `Signal '${signal}' used in port connection but not declared`,
                severity: 'warning',
                code: 'UNDECLARED_PORT_SIGNAL',
            });
        }
    }
    // Check for common syntax errors
    checkSyntaxErrors(verilogCode, lines, errors);
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        moduleInfo: {
            moduleName,
            inputs,
            outputs,
            wires,
        },
    };
}
/**
 * Extract port declaration section from module
 */
function extractPortSection(verilogCode) {
    const moduleMatch = verilogCode.match(/module\s+\w+\s*\(([\s\S]*?)\);/);
    if (!moduleMatch)
        return null;
    return moduleMatch[1];
}
/**
 * Find line number for a given character index
 */
function findLineNumber(code, index) {
    const upToIndex = code.substring(0, index);
    return upToIndex.split('\n').length;
}
/**
 * Check if a signal name is a literal value (e.g., 1'b0, 1'b1)
 */
function isLiteral(signal) {
    return /^\d+'[bh]\w+$/.test(signal) || /^[01]+$/.test(signal);
}
/**
 * Check for common Verilog syntax errors
 */
function checkSyntaxErrors(verilogCode, lines, errors) {
    // Check for unmatched parentheses
    const openParens = (verilogCode.match(/\(/g) || []).length;
    const closeParens = (verilogCode.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
        errors.push({
            message: `Unmatched parentheses: ${openParens} opening, ${closeParens} closing`,
            severity: 'error',
            code: 'UNMATCHED_PARENS',
        });
    }
    // Check for semicolon at end of module/endmodule
    lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('module ') && !trimmed.includes(';')) {
            // Module declaration spans multiple lines, check if semicolon appears later
            const restOfCode = lines.slice(idx).join('\n');
            const moduleEnd = restOfCode.indexOf(');');
            if (moduleEnd === -1) {
                errors.push({
                    line: idx + 1,
                    message: 'Module declaration missing closing );',
                    severity: 'error',
                    code: 'MISSING_MODULE_SEMICOLON',
                });
            }
        }
        // Check for missing semicolons on assign statements
        if (trimmed.startsWith('assign ') && !trimmed.endsWith(';')) {
            errors.push({
                line: idx + 1,
                message: 'assign statement missing semicolon',
                severity: 'error',
                code: 'MISSING_SEMICOLON',
            });
        }
    });
    // Check for invalid module names (must start with letter)
    const moduleMatch = verilogCode.match(/module\s+(\w+)/);
    if (moduleMatch) {
        const moduleName = moduleMatch[1];
        if (/^\d/.test(moduleName)) {
            errors.push({
                message: `Module name '${moduleName}' cannot start with a digit`,
                severity: 'error',
                code: 'INVALID_MODULE_NAME',
            });
        }
    }
}
/**
 * Validate XDC constraints against circuit signals
 */
export function validateConstraints(xdcCode, circuitSignals) {
    const errors = [];
    const warnings = [];
    const lines = xdcCode.split('\n');
    if (!xdcCode.trim()) {
        errors.push({
            message: 'Constraints file is empty',
            severity: 'error',
            code: 'EMPTY_CONSTRAINTS',
        });
        return { valid: false, errors, warnings };
    }
    const constrainedSignals = [];
    let clockConstraints = 0;
    let timingConstraints = 0;
    lines.forEach((line, idx) => {
        const trimmed = line.trim();
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#'))
            return;
        // Extract signal names from set_property commands
        const propMatch = trimmed.match(/set_property\s+.*\s+\[get_ports\s+(?:\{\s*)?(\w+)(?:\s*\})?]/);
        if (propMatch) {
            const signal = propMatch[1];
            constrainedSignals.push(signal);
            // Check if signal exists in circuit
            if (!circuitSignals.includes(signal)) {
                warnings.push({
                    line: idx + 1,
                    message: `Constrained signal '${signal}' not found in circuit`,
                    severity: 'warning',
                    code: 'UNKNOWN_SIGNAL',
                });
            }
        }
        // Count clock constraints
        if (trimmed.includes('create_clock')) {
            clockConstraints++;
        }
        // Count timing constraints
        if (trimmed.includes('set_input_delay') || trimmed.includes('set_output_delay')) {
            timingConstraints++;
        }
        // Check for syntax errors
        if (trimmed.includes('set_property') && !trimmed.includes('[get_ports')) {
            errors.push({
                line: idx + 1,
                message: 'set_property command missing [get_ports ...] target',
                severity: 'error',
                code: 'INVALID_SET_PROPERTY',
            });
        }
    });
    // Check if all circuit signals are constrained
    circuitSignals.forEach((signal) => {
        if (!constrainedSignals.includes(signal)) {
            warnings.push({
                message: `Circuit signal '${signal}' has no pin constraint`,
                severity: 'warning',
                code: 'UNCONSTRAINED_SIGNAL',
            });
        }
    });
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        pinInfo: {
            constrainedSignals,
            clockConstraints,
            timingConstraints,
        },
    };
}
/**
 * Calculate synthesis readiness score (0-100)
 */
export function calculateReadinessScore(verilogResult, constraintResult) {
    let score = 100;
    // Deduct for errors (major issues)
    score -= verilogResult.errors.length * 20;
    score -= constraintResult.errors.length * 15;
    // Deduct for warnings (minor issues)
    score -= verilogResult.warnings.length * 5;
    score -= constraintResult.warnings.length * 3;
    // Bonus for having module info
    if (verilogResult.moduleInfo) {
        const { inputs, outputs } = verilogResult.moduleInfo;
        if (inputs.length > 0 && outputs.length > 0) {
            score += 10;
        }
    }
    // Bonus for having timing constraints
    if (constraintResult.pinInfo?.timingConstraints > 0) {
        score += 5;
    }
    return Math.max(0, Math.min(100, score));
}
