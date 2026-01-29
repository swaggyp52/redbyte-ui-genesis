module redbyte_basys3_top (
    input wire clk,
    input wire [15:0] sw,
    input wire btnC,
    input wire btnU,
    input wire btnL,
    input wire btnR,
    input wire btnD,
    output wire [15:0] led,
    output wire RsTx
    // RsRx ignored for now (TX only telemetry)
);

    // Local loopback for immediate visual feedback
    assign led = sw;

    wire [7:0] flags = {3'b000, btnD, btnR, btnL, btnU, btnC};
    wire [15:0] digital = sw;
    
    // Analog inputs (dummy for now)
    wire [15:0] analog0 = 16'd0;
    wire [15:0] analog1 = 16'd0;
    wire [15:0] analog2 = 16'd0;
    wire [15:0] analog3 = 16'd0;
    wire [15:0] analog4 = 16'd0;
    wire [15:0] analog5 = 16'd0;
    wire [15:0] analog6 = 16'd0;
    wire [15:0] analog7 = 16'd0;

    wire [7:0] tx_data;
    wire tx_valid;
    wire tx_ready;

    // Instantiate Telemetry Generator
    rb_uart_telemetry #(
        .SEND_INTERVAL_CYCLES(1000000) // 100Hz at 100MHz
    ) telemetry (
        .clk(clk),
        .reset(btnU), // Reset on Up button? Or maybe center? Let's use BTNU as reset provided it's momentary.
        .force_send(1'b0),
        .flags(flags),
        .digital(digital),
        .analog0(analog0),
        .analog1(analog1),
        .analog2(analog2),
        .analog3(analog3),
        .analog4(analog4),
        .analog5(analog5),
        .analog6(analog6),
        .analog7(analog7),
        .uart_tx_data(tx_data),
        .uart_tx_valid(tx_valid),
        .uart_tx_ready(tx_ready)
    );

    // Instantiate UART TX (115200 baud)
    rb_uart_tx #(
        .CLOCKS_PER_BIT(868) // 100MHz / 115200 ~ 868
    ) uart_tx (
        .clk(clk),
        .reset(btnU),
        .tx_data(tx_data),
        .tx_valid(tx_valid),
        .tx_ready(tx_ready),
        .tx_pin(RsTx)
    );

endmodule
