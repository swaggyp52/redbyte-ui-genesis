module rb_uart_tx #(
    parameter CLOCKS_PER_BIT = 868 // 100MHz / 115200
) (
    input wire clk,
    input wire reset,
    input wire [7:0] tx_data,
    input wire tx_valid,
    output reg tx_ready,
    output reg tx_pin
);

    localparam IDLE = 0;
    localparam START = 1;
    localparam DATA = 2;
    localparam STOP = 3;

    reg [2:0] state;
    reg [13:0] clk_count;
    reg [2:0] bit_index;
    reg [7:0] data_reg;

    always @(posedge clk) begin
        if (reset) begin
            state <= IDLE;
            tx_ready <= 1'b1;
            tx_pin <= 1'b1;
            clk_count <= 0;
            bit_index <= 0;
            data_reg <= 0;
        end else begin
            case (state)
                IDLE: begin
                    tx_ready <= 1'b1;
                    tx_pin <= 1'b1;
                    if (tx_valid) begin
                        state <= START;
                        tx_ready <= 1'b0;
                        data_reg <= tx_data;
                        clk_count <= 0;
                    end
                end
                START: begin
                    tx_pin <= 1'b0;
                    if (clk_count == CLOCKS_PER_BIT - 1) begin
                        state <= DATA;
                        clk_count <= 0;
                        bit_index <= 0;
                    end else begin
                        clk_count <= clk_count + 1;
                    end
                end
                DATA: begin
                    tx_pin <= data_reg[bit_index];
                    if (clk_count == CLOCKS_PER_BIT - 1) begin
                        clk_count <= 0;
                        if (bit_index == 7) begin
                            state <= STOP;
                        end else begin
                            bit_index <= bit_index + 1;
                        end
                    end else begin
                        clk_count <= clk_count + 1;
                    end
                end
                STOP: begin
                    tx_pin <= 1'b1;
                    if (clk_count == CLOCKS_PER_BIT - 1) begin
                        state <= IDLE;
                        clk_count <= 0;
                        tx_ready <= 1'b1; // Ready for next immediately
                    end else begin
                        clk_count <= clk_count + 1;
                    end
                end
            endcase
        end
    end
endmodule
