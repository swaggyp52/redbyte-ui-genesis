# Release Stop Point - Definition of Done

This checklist defines what must PASS before shipping the current RedByte Playground as a production-ready release.

## Build Workflows

- [ ] Add a component (click + drag from palette)
- [ ] Move one component
- [ ] Multi-select + move multiple components
- [ ] Wire output → input
- [ ] Invalid wire prevented (output→output, input→input, duplicate, self-loop)
- [ ] Delete a selected node
- [ ] Delete a selected wire
- [ ] Undo / redo restores everything correctly

## Simulation Workflows

- [ ] Step ticks the engine once
- [ ] Run / pause works without desync
- [ ] Switch toggles take effect immediately
- [ ] Reset / clear behaves safely

## Multi-View Truth

- [ ] Build in Circuit view → Schematic view reflects instantly
- [ ] Move in Schematic → Circuit reflects instantly
- [ ] Wires appear in both views reliably
- [ ] Oscilloscope/analyze views don't crash on empty circuits

## Learn Mode

- [ ] NOT Gate guide: can complete all steps
- [ ] Half Adder guide: can complete all steps
- [ ] Learn mode never gets stuck if user deviates (shows "missing X", doesn't freeze)

## Persistence / Session

- [ ] Refresh page retains expected state (or clearly starts new)
- [ ] Loading an example always renders all views
- [ ] Recovery toast doesn't break state

---

## Status

**Phase**: Initial checklist created
**Last Updated**: 2026-01-05
**Release Gate**: All items must be PASS before shipping
