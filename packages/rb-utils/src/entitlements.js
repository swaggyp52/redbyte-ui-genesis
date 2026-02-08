// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
const PLAN_ORDER = {
    free: 0,
    edu: 1,
    pro: 2,
};
const FEATURE_GATES = {
    'evidence-export': {
        minPlan: 'free',
        upsellMessage: 'Evidence export is available on all plans.',
    },
    'cloud-sync': {
        minPlan: 'pro',
        upsellMessage: 'Cloud sync requires a Pro plan. Upgrade to sync projects across devices.',
    },
    'instructor-tools': {
        minPlan: 'edu',
        upsellMessage: 'Instructor tools require an Education plan. Contact us for academic pricing.',
    },
    'unlimited-projects': {
        minPlan: 'edu',
        upsellMessage: 'Free plan allows up to 5 projects. Upgrade to Education for unlimited.',
    },
    'priority-support': {
        minPlan: 'pro',
        upsellMessage: 'Priority support is available on the Pro plan.',
    },
    'custom-branding': {
        minPlan: 'pro',
        upsellMessage: 'Custom branding requires a Pro plan.',
    },
};
// Current plan — defaults to free (anonymous/demo mode)
let currentPlan = 'free';
/**
 * Set the current user's plan. Called by auth system on login.
 */
export function setCurrentPlan(plan) {
    currentPlan = plan;
}
/**
 * Get the current plan.
 */
export function getCurrentPlan() {
    return currentPlan;
}
/**
 * Check if the current plan allows access to a feature.
 * Never returns a dead button — always provides an upsell message.
 */
export function checkEntitlement(feature) {
    const gate = FEATURE_GATES[feature];
    if (!gate) {
        return { allowed: true, requiredPlan: 'free' };
    }
    const allowed = PLAN_ORDER[currentPlan] >= PLAN_ORDER[gate.minPlan];
    return {
        allowed,
        requiredPlan: gate.minPlan,
        upsellMessage: allowed ? undefined : gate.upsellMessage,
    };
}
/**
 * React hook-compatible entitlement check.
 * Returns { allowed, upsellMessage } for use in component rendering.
 */
export function useEntitlement(feature) {
    return checkEntitlement(feature);
}
