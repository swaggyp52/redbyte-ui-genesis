export function computeInstrumentHz(opts) {
    if (opts.minimized)
        return 0;
    if (opts.performanceMode)
        return 10;
    if (!opts.focused)
        return 15;
    return 60;
}

