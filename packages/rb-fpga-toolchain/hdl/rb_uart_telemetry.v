// RB UART telemetry scaffold (MVP)
// Packet format: fixed 28 bytes, big-endian, CRC-16-CCITT over bytes 0..25.
// TODO: Add a testbench to validate CRC bytes against software vectors.

module rb_uart_telemetry #(
  parameter integer SEND_INTERVAL_CYCLES = 1_000_000
) (
  input wire clk,
  input wire reset,
  input wire force_send,
  input wire [7:0] flags,
  input wire [15:0] digital,
  input wire [15:0] analog0,
  input wire [15:0] analog1,
  input wire [15:0] analog2,
  input wire [15:0] analog3,
  input wire [15:0] analog4,
  input wire [15:0] analog5,
  input wire [15:0] analog6,
  input wire [15:0] analog7,
  output reg [7:0] uart_tx_data,
  output reg uart_tx_valid,
  input wire uart_tx_ready
);

  localparam integer PACKET_SIZE = 28;
  localparam [7:0] MAGIC0 = 8'h52;
  localparam [7:0] MAGIC1 = 8'h42;
  localparam [7:0] VERSION = 8'h01;

  reg [31:0] seq;
  reg [5:0] byte_index;
  reg sending;
  reg prep;
  reg [31:0] interval_count;
  reg [15:0] crc_final;
  reg crc_init;
  reg crc_en;
  reg crc_wait;

  wire handshake = uart_tx_ready && uart_tx_valid;

  wire [15:0] crc_out;
  rb_crc16 crc16_inst (
    .clk(clk),
    .reset(reset),
    .init(crc_init),
    .enable(crc_en),
    .data_in(uart_tx_data),
    .crc_out(crc_out)
  );

  wire [15:0] crc_value = crc_out;

  function [7:0] get_byte;
    input [5:0] idx;
    begin
      case (idx)
        6'd0: get_byte = MAGIC0;
        6'd1: get_byte = MAGIC1;
        6'd2: get_byte = VERSION;
        6'd3: get_byte = flags;
        6'd4: get_byte = seq[31:24];
        6'd5: get_byte = seq[23:16];
        6'd6: get_byte = seq[15:8];
        6'd7: get_byte = seq[7:0];
        6'd8: get_byte = digital[15:8];
        6'd9: get_byte = digital[7:0];
        6'd10: get_byte = analog0[15:8];
        6'd11: get_byte = analog0[7:0];
        6'd12: get_byte = analog1[15:8];
        6'd13: get_byte = analog1[7:0];
        6'd14: get_byte = analog2[15:8];
        6'd15: get_byte = analog2[7:0];
        6'd16: get_byte = analog3[15:8];
        6'd17: get_byte = analog3[7:0];
        6'd18: get_byte = analog4[15:8];
        6'd19: get_byte = analog4[7:0];
        6'd20: get_byte = analog5[15:8];
        6'd21: get_byte = analog5[7:0];
        6'd22: get_byte = analog6[15:8];
        6'd23: get_byte = analog6[7:0];
        6'd24: get_byte = analog7[15:8];
        6'd25: get_byte = analog7[7:0];
        6'd26: get_byte = crc_final[15:8];
        6'd27: get_byte = crc_final[7:0];
        default: get_byte = 8'h00;
      endcase
    end
  endfunction

  always @(posedge clk) begin
    if (reset) begin
      seq <= 32'd0;
      byte_index <= 6'd0;
      sending <= 1'b0;
      prep <= 1'b0;
      interval_count <= SEND_INTERVAL_CYCLES;
      uart_tx_data <= 8'h00;
      uart_tx_valid <= 1'b0;
      crc_final <= 16'hFFFF;
      crc_init <= 1'b0;
      crc_en <= 1'b0;
      crc_wait <= 1'b0;
    end else begin
      crc_init <= 1'b0;
      crc_en <= 1'b0;

      if (interval_count == 0) begin
        interval_count <= SEND_INTERVAL_CYCLES;
      end else begin
        interval_count <= interval_count - 1;
      end

      if (!sending && !prep && (force_send || interval_count == 0)) begin
        prep <= 1'b1;
        uart_tx_valid <= 1'b0;
        crc_init <= 1'b1;
        crc_wait <= 1'b0;
      end else if (prep) begin
        prep <= 1'b0;
        sending <= 1'b1;
        byte_index <= 6'd0;
        uart_tx_data <= get_byte(6'd0);
        uart_tx_valid <= 1'b1;
      end else if (crc_wait) begin
        crc_final <= crc_value;
        crc_wait <= 1'b0;
        byte_index <= 6'd26;
        uart_tx_data <= get_byte(6'd26);
        uart_tx_valid <= 1'b1;
      end else if (sending) begin
        if (handshake) begin
          if (byte_index <= 6'd25) begin
            crc_en <= 1'b1;
          end

          if (byte_index == 6'd25) begin
            crc_wait <= 1'b1;
            uart_tx_valid <= 1'b0;
          end else if (byte_index == PACKET_SIZE - 1) begin
            sending <= 1'b0;
            uart_tx_valid <= 1'b0;
            byte_index <= 6'd0;
            seq <= seq + 1;
          end else begin
            byte_index <= byte_index + 1;
            uart_tx_data <= get_byte(byte_index + 1);
          end
        end
      end else begin
        uart_tx_valid <= 1'b0;
      end
    end
  end

endmodule
