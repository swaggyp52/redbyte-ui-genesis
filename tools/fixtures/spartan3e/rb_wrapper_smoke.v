// RedByte Spartan-3E smoke fixture: IDENTIFY + STREAM_START/STOP + SAMPLE over UART.
// UART pins: rs232_dce_rxd (R7), rs232_dce_txd (M14) per board-model pinmap.
// NOTE: SAMPLE payload is constant; stream proves protocol wiring.

module rb_uart_tx #(
  parameter CLKS_PER_BIT = 434
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
  parameter CLKS_PER_BIT = 434
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

module rb_wrapper_smoke_spartan3e (
  input  wire clk,
  input  wire rs232_dce_rxd,
  output wire rs232_dce_txd,
  output reg  [7:0] led
);
  localparam integer CLK_HZ = 50_000_000;
  localparam integer BAUD = 115200;
  localparam integer CLKS_PER_BIT = CLK_HZ / BAUD;
  localparam integer SAMPLE_HZ = 20;
  localparam integer SAMPLE_TICKS = CLK_HZ / SAMPLE_HZ;
  localparam integer FRAME_LEN = 54;

  reg streaming_enabled = 1'b0;
  reg [31:0] sample_count = 0;
  reg [31:0] tick = 0;

  wire rx_valid;
  wire [7:0] rx_data;

  rb_uart_rx #(.CLKS_PER_BIT(CLKS_PER_BIT)) uart_rx (
    .clk(clk),
    .reset(1'b0),
    .rx_line(rs232_dce_rxd),
    .rx_data(rx_data),
    .rx_valid(rx_valid)
  );

  reg tx_valid = 1'b0;
  reg [7:0] tx_data = 8'h00;
  wire tx_ready;

  rb_uart_tx #(.CLKS_PER_BIT(CLKS_PER_BIT)) uart_tx (
    .clk(clk),
    .reset(1'b0),
    .tx_data(tx_data),
    .tx_valid(tx_valid),
    .tx_ready(tx_ready),
    .tx_line(rs232_dce_txd)
  );

  // RBHB frame parser for START/STOP
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

  // LED indicates stream enabled.
  always @(posedge clk) begin
    led <= streaming_enabled ? 8'h01 : 8'h00;
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

  // Frame bytes (constant payload; LED=1)
  function [7:0] frame_byte;
    input [5:0] idx;
    begin
      case (idx)
        6'd0: frame_byte = 8'h52;
        6'd1: frame_byte = 8'h42;
        6'd2: frame_byte = 8'h48;
        6'd3: frame_byte = 8'h42;
        6'd4: frame_byte = 8'h01;
        6'd5: frame_byte = 8'h12;
        6'd6: frame_byte = 8'h2A;
        6'd7: frame_byte = 8'h00;
        6'd8: frame_byte = 8'h7B;
        6'd9: frame_byte = 8'h22;
        6'd10: frame_byte = 8'h69;
        6'd11: frame_byte = 8'h6F;
        6'd12: frame_byte = 8'h22;
        6'd13: frame_byte = 8'h3A;
        6'd14: frame_byte = 8'h7B;
        6'd15: frame_byte = 8'h22;
        6'd16: frame_byte = 8'h73;
        6'd17: frame_byte = 8'h77;
        6'd18: frame_byte = 8'h22;
        6'd19: frame_byte = 8'h3A;
        6'd20: frame_byte = 8'h30;
        6'd21: frame_byte = 8'h2C;
        6'd22: frame_byte = 8'h22;
        6'd23: frame_byte = 8'h62;
        6'd24: frame_byte = 8'h74;
        6'd25: frame_byte = 8'h6E;
        6'd26: frame_byte = 8'h22;
        6'd27: frame_byte = 8'h3A;
        6'd28: frame_byte = 8'h30;
        6'd29: frame_byte = 8'h2C;
        6'd30: frame_byte = 8'h22;
        6'd31: frame_byte = 8'h6C;
        6'd32: frame_byte = 8'h65;
        6'd33: frame_byte = 8'h64;
        6'd34: frame_byte = 8'h22;
        6'd35: frame_byte = 8'h3A;
        6'd36: frame_byte = 8'h31;
        6'd37: frame_byte = 8'h2C;
        6'd38: frame_byte = 8'h22;
        6'd39: frame_byte = 8'h73;
        6'd40: frame_byte = 8'h65;
        6'd41: frame_byte = 8'h67;
        6'd42: frame_byte = 8'h22;
        6'd43: frame_byte = 8'h3A;
        6'd44: frame_byte = 8'h6E;
        6'd45: frame_byte = 8'h75;
        6'd46: frame_byte = 8'h6C;
        6'd47: frame_byte = 8'h6C;
        6'd48: frame_byte = 8'h7D;
        6'd49: frame_byte = 8'h7D;
        6'd50: frame_byte = 8'h00;
        6'd51: frame_byte = 8'h00;
        6'd52: frame_byte = 8'h00;
        6'd53: frame_byte = 8'h00;
        default: frame_byte = 8'h00;
      endcase
    end
  endfunction

  reg sending = 1'b0;
  reg [5:0] frame_index = 0;

  always @(posedge clk) begin
    tx_valid <= 1'b0;
    if (!sending) begin
      if (streaming_enabled && sample_tick) begin
        sending <= 1'b1;
        frame_index <= 0;
      end
    end else begin
      if (tx_ready) begin
        tx_data <= frame_byte(frame_index);
        tx_valid <= 1'b1;
        if (frame_index == FRAME_LEN - 1) begin
          sending <= 1'b0;
        end else begin
          frame_index <= frame_index + 1;
        end
      end
    end
  end
endmodule
