import crypto from "crypto";

export const WRAPPER_VERSION = "0.1.0";

const BOARD_DEFAULTS = {
  basys3: {
    clockHz: 100_000_000,
    uartRxPort: "RsRx",
    uartTxPort: "RsTx",
    btnMode: "split",
  },
  "spartan3e-starter": {
    clockHz: 50_000_000,
    uartRxPort: "rs232_dce_rxd",
    uartTxPort: "rs232_dce_txd",
    btnMode: "bus4",
  },
};

function hexByte(value) {
  return value.toString(16).padStart(2, "0");
}

function buildPayloadInitLines(varName, payload) {
  const lines = [];
  for (let i = 0; i < payload.length; i += 1) {
    lines.push(`    ${varName}[${i}] = 8'h${hexByte(payload.charCodeAt(i))};`);
  }
  return lines.join("\n");
}

export function buildSampleTemplate() {
  const template = '{"io":{"sw":"0x0000","btn":"0x00","led":"0x0000","seg":null,"an":null}}';
  const swMarker = '"sw":"0x';
  const btnMarker = '"btn":"0x';
  const ledMarker = '"led":"0x';

  const swStart = template.indexOf(swMarker) + swMarker.length;
  const btnStart = template.indexOf(btnMarker) + btnMarker.length;
  const ledStart = template.indexOf(ledMarker) + ledMarker.length;

  const swPositions = [0, 1, 2, 3].map((idx) => swStart + idx);
  const btnPositions = [0, 1].map((idx) => btnStart + idx);
  const ledPositions = [0, 1, 2, 3].map((idx) => ledStart + idx);

  return {
    template,
    swPositions,
    btnPositions,
    ledPositions,
  };
}

export function generateWrapperVerilog(options) {
  const {
    boardModelId,
    studentTop,
    pinmapHash,
    designHash,
    buildId,
    wrapperVersion = WRAPPER_VERSION,
    clockHz,
    uartRxPort,
    uartTxPort,
    btnMode,
    sampleHz,
  } = options;

  const defaults = BOARD_DEFAULTS[boardModelId] || BOARD_DEFAULTS.basys3;
  const resolvedClockHz = clockHz || defaults.clockHz;
  const resolvedUartRx = uartRxPort || defaults.uartRxPort;
  const resolvedUartTx = uartTxPort || defaults.uartTxPort;
  const resolvedBtnMode = btnMode || defaults.btnMode;
  const resolvedSampleHz = sampleHz || 20;

  const identifyPayload = JSON.stringify({
    kind: "identify",
    board_model_id: boardModelId,
    bridge_proto: 1,
    wrapper_version: wrapperVersion,
    pinmap_hash: pinmapHash,
    features: ["io_stream_v1"],
    design: {
      design_hash: designHash,
      build_id: buildId,
    },
  });

  const sampleInfo = buildSampleTemplate();
  const sampleTemplate = sampleInfo.template;
  const swPositions = sampleInfo.swPositions;
  const btnPositions = sampleInfo.btnPositions;
  const ledPositions = sampleInfo.ledPositions;

  const identifyInit = buildPayloadInitLines("identify_payload", identifyPayload);
  const sampleInit = buildPayloadInitLines("sample_payload", sampleTemplate);

  const swUpdate = [
    `    sample_payload[${swPositions[0]}] = hex_char(sw_value[15:12]);`,
    `    sample_payload[${swPositions[1]}] = hex_char(sw_value[11:8]);`,
    `    sample_payload[${swPositions[2]}] = hex_char(sw_value[7:4]);`,
    `    sample_payload[${swPositions[3]}] = hex_char(sw_value[3:0]);`,
  ].join("\n");

  const btnUpdate = [
    `    sample_payload[${btnPositions[0]}] = hex_char(btn_value[7:4]);`,
    `    sample_payload[${btnPositions[1]}] = hex_char(btn_value[3:0]);`,
  ].join("\n");

  const ledUpdate = [
    `    sample_payload[${ledPositions[0]}] = hex_char(led_value[15:12]);`,
    `    sample_payload[${ledPositions[1]}] = hex_char(led_value[11:8]);`,
    `    sample_payload[${ledPositions[2]}] = hex_char(led_value[7:4]);`,
    `    sample_payload[${ledPositions[3]}] = hex_char(led_value[3:0]);`,
  ].join("\n");

  const buttonPorts =
    resolvedBtnMode === "split"
      ? "  input  wire btnC,\n  input  wire btnU,\n  input  wire btnD,\n  input  wire btnL,\n  input  wire btnR,\n"
      : "  input  wire [3:0] btn,\n";

  const buttonBus =
    resolvedBtnMode === "split"
      ? "  wire [4:0] btn_bus = {btnR, btnL, btnD, btnU, btnC};\n"
      : "  wire [4:0] btn_bus = {1'b0, btn};\n";

  return `// Auto-generated RedByte wrapper (do not edit by hand)
// board_model_id: ${boardModelId}
// wrapper_version: ${wrapperVersion}
// pinmap_hash: ${pinmapHash}
// design_hash: ${designHash}

module rb_uart_tx #(
  parameter CLKS_PER_BIT = 868
) (
  input  wire clk,
  input  wire reset,
  input  wire [7:0] tx_data,
  input  wire tx_valid,
  output reg  tx_ready,
  output reg  tx_line
);
  localparam STATE_IDLE  = 2'd0;
  localparam STATE_START = 2'd1;
  localparam STATE_DATA  = 2'd2;
  localparam STATE_STOP  = 2'd3;

  reg [1:0] state = STATE_IDLE;
  reg [15:0] clk_count = 0;
  reg [2:0] bit_index = 0;
  reg [7:0] data_reg = 8'h00;

  always @(posedge clk) begin
    if (reset) begin
      state <= STATE_IDLE;
      clk_count <= 0;
      bit_index <= 0;
      tx_line <= 1'b1;
      tx_ready <= 1'b1;
    end else begin
      case (state)
        STATE_IDLE: begin
          tx_line <= 1'b1;
          tx_ready <= 1'b1;
          clk_count <= 0;
          bit_index <= 0;
          if (tx_valid) begin
            data_reg <= tx_data;
            tx_ready <= 1'b0;
            tx_line <= 1'b0;
            state <= STATE_START;
          end
        end
        STATE_START: begin
          if (clk_count == CLKS_PER_BIT - 1) begin
            clk_count <= 0;
            state <= STATE_DATA;
            bit_index <= 0;
          end else begin
            clk_count <= clk_count + 1;
          end
        end
        STATE_DATA: begin
          tx_line <= data_reg[bit_index];
          if (clk_count == CLKS_PER_BIT - 1) begin
            clk_count <= 0;
            if (bit_index == 3'd7) begin
              state <= STATE_STOP;
            end else begin
              bit_index <= bit_index + 1;
            end
          end else begin
            clk_count <= clk_count + 1;
          end
        end
        STATE_STOP: begin
          tx_line <= 1'b1;
          if (clk_count == CLKS_PER_BIT - 1) begin
            clk_count <= 0;
            state <= STATE_IDLE;
          end else begin
            clk_count <= clk_count + 1;
          end
        end
        default: state <= STATE_IDLE;
      endcase
    end
  end
endmodule

module rb_uart_rx #(
  parameter CLKS_PER_BIT = 868
) (
  input  wire clk,
  input  wire reset,
  input  wire rx_line,
  output reg  [7:0] rx_data,
  output reg  rx_valid
);
  localparam STATE_IDLE  = 2'd0;
  localparam STATE_START = 2'd1;
  localparam STATE_DATA  = 2'd2;
  localparam STATE_STOP  = 2'd3;

  reg [1:0] state = STATE_IDLE;
  reg [15:0] clk_count = 0;
  reg [2:0] bit_index = 0;

  always @(posedge clk) begin
    if (reset) begin
      state <= STATE_IDLE;
      clk_count <= 0;
      bit_index <= 0;
      rx_data <= 8'h00;
      rx_valid <= 1'b0;
    end else begin
      rx_valid <= 1'b0;
      case (state)
        STATE_IDLE: begin
          if (rx_line == 1'b0) begin
            clk_count <= 0;
            state <= STATE_START;
          end
        end
        STATE_START: begin
          if (clk_count == (CLKS_PER_BIT / 2)) begin
            if (rx_line == 1'b0) begin
              clk_count <= 0;
              bit_index <= 0;
              state <= STATE_DATA;
            end else begin
              state <= STATE_IDLE;
            end
          end else begin
            clk_count <= clk_count + 1;
          end
        end
        STATE_DATA: begin
          if (clk_count == CLKS_PER_BIT - 1) begin
            clk_count <= 0;
            rx_data[bit_index] <= rx_line;
            if (bit_index == 3'd7) begin
              state <= STATE_STOP;
            end else begin
              bit_index <= bit_index + 1;
            end
          end else begin
            clk_count <= clk_count + 1;
          end
        end
        STATE_STOP: begin
          if (clk_count == CLKS_PER_BIT - 1) begin
            rx_valid <= 1'b1;
            state <= STATE_IDLE;
            clk_count <= 0;
          end else begin
            clk_count <= clk_count + 1;
          end
        end
        default: state <= STATE_IDLE;
      endcase
    end
  end
endmodule

module rb_wrapper_top (
  input  wire clk,
  input  wire [15:0] sw,
${buttonPorts}  output wire [15:0] led,
  output wire [6:0] seg,
  output wire [3:0] an,
  output wire dp,
  input  wire ${resolvedUartRx},
  output wire ${resolvedUartTx}
);
  localparam integer CLK_HZ = ${resolvedClockHz};
  localparam integer BAUD = 115200;
  localparam integer CLKS_PER_BIT = CLK_HZ / BAUD;
  localparam integer SAMPLE_HZ = ${resolvedSampleHz};
  localparam integer SAMPLE_TICKS = CLK_HZ / SAMPLE_HZ;
  localparam integer HEADER_LEN = 8;
  localparam integer CRC_LEN = 4;
  localparam integer IDENT_LEN = ${identifyPayload.length};
  localparam integer SAMPLE_LEN = ${sampleTemplate.length};
  localparam integer IDENT_FRAME_LEN = HEADER_LEN + IDENT_LEN + CRC_LEN;
  localparam integer SAMPLE_FRAME_LEN = HEADER_LEN + SAMPLE_LEN + CRC_LEN;

${buttonBus}

  wire [15:0] led_wire;
  wire [6:0] seg_wire;
  wire [3:0] an_wire;
  wire dp_wire;

  assign led = led_wire;
  assign seg = seg_wire;
  assign an = an_wire;
  assign dp = dp_wire;

  ${studentTop} student_top (
    .clk(clk),
    .sw(sw),
    .btn(btn_bus),
    .led(led_wire),
    .seg(seg_wire),
    .an(an_wire),
    .dp(dp_wire)
  );

  rb_uart_rx #(.CLKS_PER_BIT(CLKS_PER_BIT)) uart_rx (
    .clk(clk),
    .reset(1'b0),
    .rx_line(${resolvedUartRx}),
    .rx_data(rx_data),
    .rx_valid(rx_valid)
  );

  rb_uart_tx #(.CLKS_PER_BIT(CLKS_PER_BIT)) uart_tx (
    .clk(clk),
    .reset(1'b0),
    .tx_data(tx_data),
    .tx_valid(tx_valid),
    .tx_ready(tx_ready),
    .tx_line(${resolvedUartTx})
  );

  reg streaming_enabled = 1'b0;
  reg identify_pending = 1'b0;

  reg [31:0] sample_count = 0;
  reg [31:0] tick = 0;

  wire rx_valid;
  wire [7:0] rx_data;

  reg tx_valid = 1'b0;
  reg [7:0] tx_data = 8'h00;
  wire tx_ready;

  // RBHB frame parser for START/STOP/IDENTIFY
  localparam RX_WAIT = 2'd0;
  localparam RX_HEADER = 2'd1;
  localparam RX_SKIP = 2'd2;

  reg [1:0] rx_state = RX_WAIT;
  reg [1:0] header_index = 0;
  reg [7:0] rx_type = 8'h00;
  reg [15:0] payload_len = 16'd0;
  reg [15:0] skip_count = 16'd0;
  reg [31:0] magic_shift = 32'h00000000;

  always @(posedge clk) begin
    if (rx_valid) begin
      case (rx_state)
        RX_WAIT: begin
          magic_shift <= { magic_shift[23:0], rx_data };
          if ({ magic_shift[23:0], rx_data } == 32'h52424842) begin
            rx_state <= RX_HEADER;
            header_index <= 0;
          end
        end
        RX_HEADER: begin
          header_index <= header_index + 1;
          if (header_index == 1) begin
            rx_type <= rx_data;
          end else if (header_index == 2) begin
            payload_len[7:0] <= rx_data;
          end else if (header_index == 3) begin
            payload_len[15:8] <= rx_data;
            skip_count <= { rx_data, payload_len[7:0] } + 16'd4;
            rx_state <= RX_SKIP;
            header_index <= 0;
            if (rx_type == 8'h10) begin
              streaming_enabled <= 1'b1;
            end else if (rx_type == 8'h11) begin
              streaming_enabled <= 1'b0;
            end else if (rx_type == 8'h01) begin
              identify_pending <= 1'b1;
            end
          end
        end
        RX_SKIP: begin
          if (skip_count > 0) begin
            skip_count <= skip_count - 1;
          end
          if (skip_count == 1) begin
            rx_state <= RX_WAIT;
          end
        end
        default: rx_state <= RX_WAIT;
      endcase
    end
  end

  // SAMPLE timer
  wire sample_tick = (sample_count == SAMPLE_TICKS - 1);

  always @(posedge clk) begin
    if (!streaming_enabled) begin
      sample_count <= 0;
      tick <= 0;
    end else begin
      if (sample_tick) begin
        sample_count <= 0;
        tick <= tick + 1;
      end else begin
        sample_count <= sample_count + 1;
      end
    end
  end

  // Payload buffers
  reg [7:0] identify_payload [0:IDENT_LEN-1];
  reg [7:0] sample_payload [0:SAMPLE_LEN-1];
  integer init_index;

  initial begin
    ${identifyInit}
    ${sampleInit}
  end

  function [7:0] hex_char;
    input [3:0] nib;
    begin
      case (nib)
        4'h0: hex_char = 8'h30;
        4'h1: hex_char = 8'h31;
        4'h2: hex_char = 8'h32;
        4'h3: hex_char = 8'h33;
        4'h4: hex_char = 8'h34;
        4'h5: hex_char = 8'h35;
        4'h6: hex_char = 8'h36;
        4'h7: hex_char = 8'h37;
        4'h8: hex_char = 8'h38;
        4'h9: hex_char = 8'h39;
        4'hA: hex_char = 8'h41;
        4'hB: hex_char = 8'h42;
        4'hC: hex_char = 8'h43;
        4'hD: hex_char = 8'h44;
        4'hE: hex_char = 8'h45;
        4'hF: hex_char = 8'h46;
      endcase
    end
  endfunction

  task update_sample_payload;
    reg [15:0] sw_value;
    reg [15:0] led_value;
    reg [7:0] btn_value;
    begin
      sw_value = sw;
      led_value = led_wire;
      btn_value = {3'b000, btn_bus};
${swUpdate}
${btnUpdate}
${ledUpdate}
    end
  endtask

  localparam MODE_SAMPLE = 1'b0;
  localparam MODE_IDENT = 1'b1;
  reg send_mode = MODE_SAMPLE;
  reg sending = 1'b0;
  reg [15:0] frame_index = 0;
  reg [15:0] active_len = 0;
  reg [15:0] active_total = 0;
  reg [7:0] active_type = 8'h12;

  always @(posedge clk) begin
    tx_valid <= 1'b0;

    if (!sending) begin
      if (identify_pending) begin
        identify_pending <= 1'b0;
        send_mode <= MODE_IDENT;
        active_len <= IDENT_LEN;
        active_total <= IDENT_FRAME_LEN;
        active_type <= 8'h02;
        frame_index <= 0;
        sending <= 1'b1;
      end else if (streaming_enabled && sample_tick) begin
        update_sample_payload();
        send_mode <= MODE_SAMPLE;
        active_len <= SAMPLE_LEN;
        active_total <= SAMPLE_FRAME_LEN;
        active_type <= 8'h12;
        frame_index <= 0;
        sending <= 1'b1;
      end
    end else begin
      if (tx_ready) begin
        if (frame_index == 0) tx_data <= 8'h52;
        else if (frame_index == 1) tx_data <= 8'h42;
        else if (frame_index == 2) tx_data <= 8'h48;
        else if (frame_index == 3) tx_data <= 8'h42;
        else if (frame_index == 4) tx_data <= 8'h01;
        else if (frame_index == 5) tx_data <= active_type;
        else if (frame_index == 6) tx_data <= active_len[7:0];
        else if (frame_index == 7) tx_data <= active_len[15:8];
        else if (frame_index < HEADER_LEN + active_len) begin
          if (send_mode == MODE_IDENT) begin
            tx_data <= identify_payload[frame_index - HEADER_LEN];
          end else begin
            tx_data <= sample_payload[frame_index - HEADER_LEN];
          end
        end else begin
          tx_data <= 8'h00;
        end
        tx_valid <= 1'b1;
        if (frame_index == active_total - 1) begin
          sending <= 1'b0;
        end else begin
          frame_index <= frame_index + 1;
        end
      end
    end
  end
endmodule
`;
}

export function hashText(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
