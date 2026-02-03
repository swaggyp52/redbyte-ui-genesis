export function* replayHardwareTrace(events) {
    const ordered = [...events].sort((a, b) => {
        if (a.hw_tick !== b.hw_tick)
            return a.hw_tick - b.hw_tick;
        return a.mono_seq - b.mono_seq;
    });
    for (const event of ordered) {
        yield event;
    }
}
