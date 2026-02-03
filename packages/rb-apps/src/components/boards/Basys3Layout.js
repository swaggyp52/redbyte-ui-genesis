// Basys3 Layout Definitions
// Coordinate system: 0,0 is top-left of the board.
// Dimensions in Board Units (approx mm or arbitrary scale).
export const BASYS3_WIDTH = 800;
export const BASYS3_HEIGHT = 500;
export const LED_Y = 380;
export const SWITCH_Y = 430;
export const IO_START_X = 100;
export const IO_SPACING = 40;
export const BTN_CENTER_X = 650;
export const BTN_CENTER_Y = 250;
export const BTN_OFFSET = 50;
export const SWITCH_POSITIONS = {};
export const LED_POSITIONS = {};
// Linear layout for Switches and LEDs (0-15)
// SW0/LD0 is on the RIGHT side physically on many boards, but Basys3 labels 0 on right.
// Let's verify Basys3 layout. 
// Physically: Switches are a row at the bottom. LEDs are a row just above them.
// SW0 is far right. SW15 is far left.
// Let's implement 15 -> 0 (Left to Right) visual order matches standard index order if we flip?
// Actually if we draw x=100 as SW15 and x=700 as SW0?
// Let's stick to: Index 0 is Right, Index 15 is Left.
// x = IO_START_X + (15 - index) * IO_SPACING
for (let i = 0; i < 16; i++) {
    const x = IO_START_X + (15 - i) * IO_SPACING;
    SWITCH_POSITIONS[i] = { x, y: SWITCH_Y, label: `SW${i}` };
    LED_POSITIONS[i] = { x, y: LED_Y, label: `LD${i}` };
}
export const BUTTON_POSITIONS = {
    BTNC: { x: BTN_CENTER_X, y: BTN_CENTER_Y, label: 'BTNC' },
    BTNU: { x: BTN_CENTER_X, y: BTN_CENTER_Y - BTN_OFFSET, label: 'BTNU' },
    BTND: { x: BTN_CENTER_X, y: BTN_CENTER_Y + BTN_OFFSET, label: 'BTND' },
    BTNL: { x: BTN_CENTER_X - BTN_OFFSET, y: BTN_CENTER_Y, label: 'BTNL' },
    BTNR: { x: BTN_CENTER_X + BTN_OFFSET, y: BTN_CENTER_Y, label: 'BTNR' },
};
export const SEVEN_SEG_POSITIONS = [
    { x: 300, y: 150 }, // AN3
    { x: 360, y: 150 }, // AN2
    { x: 420, y: 150 }, // AN1
    { x: 480, y: 150 }, // AN0
];
