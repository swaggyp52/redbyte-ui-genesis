import { PART_DEFINITIONS } from './parts';
class UnionFind {
    parent = new Map();
    add(key) {
        if (!this.parent.has(key)) {
            this.parent.set(key, key);
        }
    }
    find(key) {
        const parent = this.parent.get(key);
        if (!parent) {
            this.parent.set(key, key);
            return key;
        }
        if (parent === key)
            return key;
        const root = this.find(parent);
        this.parent.set(key, root);
        return root;
    }
    union(a, b) {
        this.add(a);
        this.add(b);
        const rootA = this.find(a);
        const rootB = this.find(b);
        if (rootA !== rootB) {
            this.parent.set(rootB, rootA);
        }
    }
    keys() {
        return Array.from(this.parent.keys());
    }
}
const buildPinKey = (nodeId, pinId) => `${nodeId}:${pinId}`;
const stableHash32 = (str) => {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};
const stringifyCanonical = (value) => {
    if (value === null || value === undefined)
        return String(value);
    if (typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value)) {
        return `[${value.map((item) => stringifyCanonical(item)).join(',')}]`;
    }
    const obj = value;
    const keys = Object.keys(obj).sort();
    return `{${keys
        .map((key) => `${JSON.stringify(key)}:${stringifyCanonical(obj[key])}`)
        .join(',')}}`;
};
export const fingerprintLabTemplate = (template) => {
    const canonical = stringifyCanonical(template);
    return stableHash32(canonical).toString(16);
};
const validatePinSelector = (selector, context, errors) => {
    const definition = PART_DEFINITIONS[selector.part];
    if (!definition) {
        errors.push(`${context} references unknown part ${selector.part}`);
        return;
    }
    if (!selector.pins || selector.pins.length === 0) {
        errors.push(`${context} selector missing pins`);
        return;
    }
    for (const pin of selector.pins) {
        if (!definition.pins.some((p) => p.id === pin)) {
            errors.push(`${context} selector pin ${pin} invalid on ${selector.part}`);
        }
    }
};
const collectCandidatePins = (graph, selector) => {
    const definition = PART_DEFINITIONS[selector.part];
    if (!definition)
        return [];
    const allowedPins = new Set(selector.pins);
    const pins = definition.pins.map((pin) => pin.id).filter((pinId) => allowedPins.has(pinId));
    if (pins.length === 0)
        return [];
    const candidates = [];
    for (const node of graph.nodes) {
        if (node.type !== selector.part)
            continue;
        for (const pinId of pins) {
            candidates.push(buildPinKey(node.id, pinId));
        }
    }
    return candidates;
};
export const resolveSelectorPins = (graph, selector) => collectCandidatePins(graph, selector);
const buildConnectivity = (graph, extraPins) => {
    const uf = new UnionFind();
    for (const wire of graph.wires) {
        const a = buildPinKey(wire.sourceNodeId, wire.sourcePinId);
        const b = buildPinKey(wire.targetNodeId, wire.targetPinId);
        uf.union(a, b);
    }
    for (const pin of extraPins) {
        uf.add(pin);
    }
    const components = new Map();
    for (const key of uf.keys()) {
        const root = uf.find(key);
        if (!components.has(root)) {
            components.set(root, new Set());
        }
        components.get(root).add(key);
    }
    return components;
};
export const evaluateNetRequirements = (graph, template) => {
    const results = [];
    for (const requirement of template.required_nets) {
        const selectorCandidates = requirement.pins.map((selector) => collectCandidatePins(graph, selector));
        const allPins = selectorCandidates.flat();
        const components = buildConnectivity(graph, allPins);
        let matched = [];
        let satisfied = false;
        for (const componentPins of components.values()) {
            const hits = [];
            let ok = true;
            for (const candidates of selectorCandidates) {
                const match = candidates.find((pin) => componentPins.has(pin));
                if (!match) {
                    ok = false;
                    break;
                }
                hits.push(match);
            }
            if (ok) {
                satisfied = true;
                matched = hits;
                break;
            }
        }
        results.push({
            id: requirement.id,
            label: requirement.label,
            satisfied,
            matched_pins: matched
        });
    }
    return {
        results,
        allSatisfied: results.every((result) => result.satisfied)
    };
};
export const validateLabTemplate = (template) => {
    const errors = [];
    if (template.template_version !== 'virtual-lab.v1') {
        errors.push(`Unsupported template version: ${template.template_version}`);
    }
    if (!template.lab_id) {
        errors.push('lab_id is required');
    }
    if (!template.lab_version) {
        errors.push('lab_version is required');
    }
    if (!template.name) {
        errors.push('name is required');
    }
    for (const part of template.required_parts) {
        if (!PART_DEFINITIONS[part.type]) {
            errors.push(`Unknown part type in required_parts: ${part.type}`);
        }
        if (part.min < 0) {
            errors.push(`Invalid minimum count for part ${part.type}`);
        }
        if (part.max !== undefined && part.max < part.min) {
            errors.push(`Invalid max count for part ${part.type}`);
        }
    }
    for (const net of template.required_nets) {
        if (!net.id) {
            errors.push('required_nets entry missing id');
        }
        if (net.pins.length < 2) {
            errors.push(`required_nets ${net.id} must specify at least 2 pins`);
            continue;
        }
        for (const selector of net.pins) {
            validatePinSelector(selector, `required_nets ${net.id}`, errors);
        }
    }
    if (template.behavior_checks) {
        for (const check of template.behavior_checks) {
            if (!check.id) {
                errors.push('behavior_checks entry missing id');
            }
            validatePinSelector(check.pin, `behavior_checks ${check.id}`, errors);
            if (check.type === 'blink') {
                if (check.period_ticks <= 0) {
                    errors.push(`behavior_checks ${check.id} period_ticks must be > 0`);
                }
                if (check.tolerance_ticks < 0) {
                    errors.push(`behavior_checks ${check.id} tolerance_ticks must be >= 0`);
                }
                if (check.min_cycles !== undefined && check.min_cycles <= 0) {
                    errors.push(`behavior_checks ${check.id} min_cycles must be > 0`);
                }
            }
            if (check.type === 'serial_matches_pin') {
                if (!check.on_text) {
                    errors.push(`behavior_checks ${check.id} on_text is required`);
                }
                if (!check.off_text) {
                    errors.push(`behavior_checks ${check.id} off_text is required`);
                }
            }
            if (check.type === 'digital_level') {
                if (!Number.isFinite(check.value)) {
                    errors.push(`behavior_checks ${check.id} value must be a number`);
                }
                if (check.min_ticks !== undefined && check.min_ticks < 0) {
                    errors.push(`behavior_checks ${check.id} min_ticks must be >= 0`);
                }
            }
        }
    }
    if (template.guide) {
        for (const step of template.guide) {
            if (!step.id)
                errors.push('Guide step missing id');
            if (!step.title)
                errors.push(`Guide step ${step.id} missing title`);
            if (!step.markdown)
                errors.push(`Guide step ${step.id} missing markdown`);
        }
    }
    return { valid: errors.length === 0, errors };
};
