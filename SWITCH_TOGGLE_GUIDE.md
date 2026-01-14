# Switch Toggle Quick Guide

## How to Toggle Switches in Logic Playground

### Visual Indicator
Every Switch/INPUT node has a **toggle pill** displayed above the node:
- **Gray pill with white knob on LEFT** = OFF (output: 0)
- **Green pill with white knob on RIGHT** = ON (output: 1)
- **"OFF" or "ON" label** appears above the toggle pill
- **Purple highlight** appears when you hover over the toggle area

### How to Toggle
1. **Click the toggle pill** above the switch node (NOT the node body itself)
2. The knob slides left/right with smooth animation
3. The color changes: gray → green (OFF → ON) or green → gray (ON → OFF)
4. The output signal updates instantly (watch the lamp light up!)

### Common Issues

**"I click the switch but nothing happens"**
- ✅ Make sure you're clicking the **toggle pill above the node**, not the node body
- ✅ Check if you're in **wire-drawing mode** (did you click a port?)
  - If wire mode is active, press **Escape** to cancel wire drawing
  - Then try clicking the toggle pill again

**"How do I know if I'm clicking the right spot?"**
- The **cursor changes to pointer** (hand icon) when hovering over the toggle area
- The toggle pill **highlights purple** on hover
- The hit area is slightly larger than the visible pill for easier clicking

### Example Circuit Flow
1. Add: PowerSource → Switch → Lamp
2. Wire them together (click PowerSource output port → click Switch input port, etc.)
3. Click the **toggle pill above the switch**
4. Watch the lamp light up! 💡

### Technical Details
- Toggle area: ~43px wide × 24px tall (at 1.0 zoom)
- Hit target is larger than visual pill (easier to click)
- Toggle is disabled during replay mode (read-only)
- Toggle works instantly (no delay between click and state change)

### Keyboard Shortcuts
- **Space + Drag**: Pan the view (useful if switch is off-screen)
- **Scroll**: Zoom in/out (makes toggle pill larger/smaller)
- **Escape**: Cancel wire drawing if stuck in wire mode

---

**Still having issues?** Check [docs/playground-ux-smoke-test.md](docs/playground-ux-smoke-test.md) Section 6 for manual testing steps.
