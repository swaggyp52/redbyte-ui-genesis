// CRC-16-CCITT (CCITT-FALSE) generator
// Poly 0x1021, init 0xFFFF, no reflection, xorout 0x0000

module rb_crc16 (
  input wire clk,
  input wire reset,
  input wire init,
  input wire enable,
  input wire [7:0] data_in,
  output reg [15:0] crc_out
);

  function [15:0] crc16_byte;
    input [15:0] crc;
    input [7:0] data;
    integer i;
    reg [15:0] c;
    begin
      c = crc ^ {data, 8'h00};
      for (i = 0; i < 8; i = i + 1) begin
        if (c[15]) begin
          c = (c << 1) ^ 16'h1021;
        end else begin
          c = c << 1;
        end
      end
      crc16_byte = c;
    end
  endfunction

  always @(posedge clk) begin
    if (reset) begin
      crc_out <= 16'hFFFF;
    end else if (init) begin
      crc_out <= 16'hFFFF;
    end else if (enable) begin
      crc_out <= crc16_byte(crc_out, data_in);
    end
  end

endmodule
