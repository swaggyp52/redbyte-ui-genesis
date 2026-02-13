const t={id:"lab2_adder_truth_table",title:"Adder Truth Table",description:"Validates all 4-bit addition combinations for inputs A, B, and Cin.",presets:[{name:"Zero + Zero",inputs:{SW:"000000000"},expectedOutputs:{LED:"00000"}},{name:"1 + 1",inputs:{SW:"000010001"},expectedOutputs:{LED:"00010"}},{name:"15 + 1 (Overflow)",inputs:{SW:"000011111"},expectedOutputs:{LED:"10000"}},{name:"5 + 5 (Comparator)",inputs:{SW:"001010101"},expectedOutputs:{LED:"01010"}}]},e={id:"lab2_adder",title:"Lab 2: 4-Bit Adder with Comparator",objectives:["Design a 1-bit full adder using basic logic gates (XOR, AND, OR).","Cascade four 1-bit adders to create a 4-bit ripple-carry adder.","Implement a magnitude comparator to detect specific sum values.","Verify the design on the Basys3 FPGA board using switches and LEDs."],steps:[{id:"intro",title:"Lab Overview",description:"In this lab, you will build a 4-bit adder from scratch. You will start by understanding the Full Adder logic, then chain them together. Finally, you will add a unique feature: a comparator that lights up a specific LED when the sum equals 10 (0xA).",markdown:`
# Lab 2 Overview

Digital addition is fundamental to all computing. In this lab, we move beyond single gates to build combinational circuits that perform arithmetic.

**Key Concepts:**
- **Half Adder vs. Full Adder**: Handling the carry bit.
- **Ripple Carry**: How bits propagate through the chain.
- **Comparators**: Detecting specific binary patterns.
      `},{id:"design_fa",title:"Step 1: 1-Bit Full Adder",description:'Create a custom chip named "FullAdder" that handles A, B, and Cin.',checklist:['Create new Custom Chip "FullAdder"',"Inputs: A, B, Cin","Outputs: Sum, Cout","Logic: Sum = A ⊕ B ⊕ Cin","Logic: Cout = (A·B) + (Cin·(A⊕B))","Verify truth table with simulation"]},{id:"build_4bit",title:"Step 2: 4-Bit Ripple Carry",description:'On the main canvas, place four "FullAdder" chips and chain them.',checklist:["Place 4 FullAdder chips","Connect Carry Chain (Cout -> Cin)","Connect Inputs A[0-3] to SW[0-3]","Connect Inputs B[0-3] to SW[4-7]","Connect Sum[0-3] to LED[0-3]","Connect Final Cout to LED[4]"]},{id:"comparator",title:"Step 3: Magnitude Comparator",description:"Add logic to detect when the Sum is equal to 10 (Binary 1010).",checklist:["Analyze binary for 10: (Sum3=1, Sum2=0, Sum1=1, Sum0=0)","Implement AND gate logic to detect this specific pattern","Connect comparator output to LED15 (Blue RGB or separate LED)"]},{id:"verification",title:"Step 4: Hardware Verification",description:"Connect your Basys3 board and verify the physical behavior.",checklist:["Connect Basys3 Board","Toggle input switches to test 5 + 5 = 10 (Comparator should light up)","Test overflow case: 15 + 1 = 0 (with Carry Out)","Export Evidence (Trace + Video)"]}],constraints:{disallowComponents:["adder-4bit","alu-4bit"],requiredIoMapping:{inputs:[{pattern:"SW[0-3]",role:"Operand A"},{pattern:"SW[4-7]",role:"Operand B"}],outputs:[{pattern:"LED[0-3]",role:"Sum Result"},{pattern:"LED[4]",role:"Carry Out"},{pattern:"LED[15]",role:"Comparator Match (10)"}]}},metadata:{hardwareRequired:!0,board:"basys3",difficulty:"intermediate",estimatedDurationMin:45},presets:[t]},i=[{id:"intro",title:"Introduction to Digital Logic",markdown:`
# Welcome to Lab 1

In this lab, you will verify the basic operation of your FPGA board's input/output (I/O) capabilities.

**Objectives:**
1. Connect your hardware board.
2. Manipulate physical switches.
3. Observe LED output in the **RedByte** interface.
        `},{id:"setup",title:"Hardware Setup",markdown:`
# Hardware Setup

1. Ensure your board (Basys3 or Spartan-3E) is plugged in.
2. In the **RedByte** app toolbar, verify the connection status is **Ready**.
3. If not connected, click **Connect** in the Hardware panel on the right.

*Note: If you are simulating, just ensuring the "Sim-Only" or "Mock" driver is active is sufficient.*
        `},{id:"task1",title:"Task 1: The Switch-LED Link",markdown:`
# Task 1: Basic I/O

The default design loaded on your board connects each **Switch (SW)** directly to its corresponding **LED**.

**Action:**
1. Flip **SW0** to the **ON** (up/1) position.
2. Observe **LED0** turning **ON**.

Click **Verify** below when you have set SW0 to 1.
        `,checkpoint:{signal:"LED0",expectedValue:1,description:"Ensure LED0 is ON (High)"}},{id:"completion",title:"Lab Completion",markdown:`
# Congratulations!

You have successfully verified the hardware link.

**Final Step:**
Click **Export Evidence** to save a snapshot of your work (Trace + Report) to the file system. You can submit this capsule as proof of completion.
        `}],a=[{id:"intro",title:"Lab 2: 4-Bit Binary Adder",markdown:`
# Lab 2: 4-Bit Binary Adder

In this lab, you will design and implement a 4-bit ripple-carry adder and verify it on hardware. You will also integrate an analog light sensor (LDR) using a hardware comparator.

**Objectives:**
1. Design a 4-bit adder using logic gates (or Full Adder components).
2. Simulate the adder to verify correctness (Truth Table).
3. Connect the LDR sensor input via a hardware comparator.
4. Deployment to FPGA and hardware verification.
        `},{id:"design",title:"Task 1: Circuit Design",markdown:`
# Task 1: 4-Bit Adder Design

Construct a 4-bit adder that adds two 4-bit numbers **A** and **B** to produce a 4-bit **Sum** and a **Carry Out**.

**Requirements:**
- Inputs: **A[3:0]**, **B[3:0]**, **Cin**
- Outputs: **Sum[3:0]**, **Cout**
- Use Full Adders cascaded together.

**Board Mapping:**
- A[0-3] -> SW0-SW3
- B[0-3] -> SW4-SW7
- Cin -> SW15 (Optional manual carry)
- Sum[0-3] -> LED0-LED3
- Cout -> LED4
        `},{id:"simulation",title:"Task 2: Simulation Verification",markdown:`
# Task 2: Simulation Verification

Verify your design by testing the following cases:

1. **0 + 0**: Set all switches to 0. Correct Sum = 0.
2. **1 + 1**: Set A=1, B=1. Correct Sum = 2 (LED1 ON).
3. **15 + 1**: Set A=1111 (15), B=0001 (1). Correct Sum = 0, Cout = 1.
4. **General Case**: Try 3 + 5 = 8.

Click **Run Self-Check** to automatically verify all combinations.
        `,checkpoint:{signal:"Cout",expectedValue:1,description:"Verify 15 + 1 produces Carry Out"}},{id:"sensor",title:"Task 3: Analog Sensor Integration",markdown:`
# Task 3: LDR Sensor Integration

Integrate the Light Dependent Resistor (LDR) circuit.

1. Build the LDR + LM358 comparator circuit on your breadboard.
2. Connect the LM358 output to **JB1** (or designated input pin).
3. Map this input to influence your adder (e.g. use it as **Cin** instead of SW15).

**Observation:**
- Cover the LDR -> Comparator Low -> Cin=0
- Shine light -> Comparator High -> Cin=1
- Verify that light levels change your add result (e.g. 5+5+1 vs 5+5+0).
        `},{id:"hardware",title:"Task 4: Hardware Deployment",markdown:`
# Task 4: FPGA Verification

1. Connect your Basys3 board.
2. Click **Program FPGA** in the Hardware tab.
3. Once programmed, manipulate the physical switches and observe the physical LEDs.
4. Verify the LDR sensor interaction on real hardware.
        `},{id:"submit",title:"Lab Submission",markdown:`
# Lab Completion

You have successfully built and tested a mixed-signal digital system!

**Submission:**
Click **Export Project** to generate your .rbx.zip submission file. This file contains your circuit, test results, and hardware configuration.
        `}],r={"lab-1":i,"lab-2":a,lab2_adder:e};export{r as L};
//# sourceMappingURL=labContent-BoWZffMJ.js.map
