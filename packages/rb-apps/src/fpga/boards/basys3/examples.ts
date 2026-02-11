import type { Basys3XdcPresetId } from './presets';

export type Basys3ExampleId =
  | 'basys3-switches-to-leds'
  | 'basys3-seven-seg-counter'
  | 'basys3-debounced-button-toggle';

export interface Basys3VerilogExample {
  id: Basys3ExampleId;
  label: string;
  description: string;
  top: 'top';
  language: 'verilog';
  defaultPath: 'top.v';
  recommendedPreset: Basys3XdcPresetId;
  text: string;
}

function normalizeHdlText(raw: string): string {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}

const switchesToLedsSource = normalizeHdlText(`
module top(
  input  wire        clk,
  input  wire [15:0] sw,
  input  wire [4:0]  btn,
  output wire [15:0] led,
  output wire [6:0]  seg,
  output wire [3:0]  an,
  output wire        dp
);
  assign led = sw;
  assign seg = 7'b1111111;
  assign an  = 4'b1111;
  assign dp  = 1'b1;
endmodule
`);

const sevenSegCounterSource = normalizeHdlText(`
module top(
  input  wire        clk,
  input  wire [15:0] sw,
  input  wire [4:0]  btn,
  output wire [15:0] led,
  output wire [6:0]  seg,
  output wire [3:0]  an,
  output wire        dp
);
  reg [25:0] counter = 26'd0;
  wire [3:0] digit = counter[25:22] ^ sw[3:0];

  always @(posedge clk) begin
    if (btn[0]) begin
      counter <= 26'd0;
    end else begin
      counter <= counter + 26'd1;
    end
  end

  assign led = {12'b0, digit};
  assign an  = 4'b1110;
  assign dp  = 1'b1;
  assign seg = seven_seg_decode(digit);

  function [6:0] seven_seg_decode;
    input [3:0] value;
    begin
      case (value)
        4'h0: seven_seg_decode = 7'b1000000;
        4'h1: seven_seg_decode = 7'b1111001;
        4'h2: seven_seg_decode = 7'b0100100;
        4'h3: seven_seg_decode = 7'b0110000;
        4'h4: seven_seg_decode = 7'b0011001;
        4'h5: seven_seg_decode = 7'b0010010;
        4'h6: seven_seg_decode = 7'b0000010;
        4'h7: seven_seg_decode = 7'b1111000;
        4'h8: seven_seg_decode = 7'b0000000;
        4'h9: seven_seg_decode = 7'b0010000;
        4'hA: seven_seg_decode = 7'b0001000;
        4'hB: seven_seg_decode = 7'b0000011;
        4'hC: seven_seg_decode = 7'b1000110;
        4'hD: seven_seg_decode = 7'b0100001;
        4'hE: seven_seg_decode = 7'b0000110;
        default: seven_seg_decode = 7'b0001110;
      endcase
    end
  endfunction
endmodule
`);

const debouncedButtonToggleSource = normalizeHdlText(`
module top(
  input  wire        clk,
  input  wire [15:0] sw,
  input  wire [4:0]  btn,
  output wire [15:0] led,
  output wire [6:0]  seg,
  output wire [3:0]  an,
  output wire        dp
);
  reg btn_sync_0 = 1'b0;
  reg btn_sync_1 = 1'b0;
  reg btn_stable = 1'b0;
  reg btn_prev = 1'b0;
  reg [19:0] debounce_counter = 20'd0;
  reg led_state = 1'b0;

  always @(posedge clk) begin
    btn_sync_0 <= btn[0];
    btn_sync_1 <= btn_sync_0;

    if (btn_sync_1 == btn_stable) begin
      debounce_counter <= 20'd0;
    end else begin
      debounce_counter <= debounce_counter + 20'd1;
      if (&debounce_counter) begin
        btn_stable <= btn_sync_1;
      end
    end

    btn_prev <= btn_stable;
    if (btn_stable && !btn_prev) begin
      led_state <= ~led_state;
    end
  end

  assign led = {sw[15:1], led_state};
  assign seg = 7'b1111111;
  assign an  = 4'b1111;
  assign dp  = 1'b1;
endmodule
`);

export const basys3VerilogExamples: Basys3VerilogExample[] = [
  {
    id: 'basys3-switches-to-leds',
    label: 'Switches → LEDs',
    description: 'Directly drives led[15:0] from sw[15:0].',
    top: 'top',
    language: 'verilog',
    defaultPath: 'top.v',
    recommendedPreset: 'basys3-switches-leds-7seg',
    text: switchesToLedsSource,
  },
  {
    id: 'basys3-seven-seg-counter',
    label: 'Seven-Seg Counter',
    description: 'Uses clk and btn[0] reset to drive a hexadecimal digit on seven-segment.',
    top: 'top',
    language: 'verilog',
    defaultPath: 'top.v',
    recommendedPreset: 'basys3-switches-leds-7seg',
    text: sevenSegCounterSource,
  },
  {
    id: 'basys3-debounced-button-toggle',
    label: 'Debounced Button Toggle',
    description: 'Debounces btn[0] and toggles led[0] on each stable press edge.',
    top: 'top',
    language: 'verilog',
    defaultPath: 'top.v',
    recommendedPreset: 'basys3-switches-leds-7seg',
    text: debouncedButtonToggleSource,
  },
];

export function getBasys3VerilogExample(exampleId: Basys3ExampleId): Basys3VerilogExample | null {
  return basys3VerilogExamples.find((example) => example.id === exampleId) ?? null;
}

