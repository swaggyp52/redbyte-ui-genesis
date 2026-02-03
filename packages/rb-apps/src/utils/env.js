/**
 * Environment Capability Gate
 *
 * Determines if we are running in the public "Web Demo" environment
 * where hardware access should be disabled.
 */
export const isWebDemoEnvironment = () => {
    // Check for build-time env var or hostname
    if (import.meta.env.VITE_APP_ENV === 'demo')
        return true;
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        return hostname.includes('redbyteapps.dev') || hostname.includes('github.io');
    }
    return false;
};
