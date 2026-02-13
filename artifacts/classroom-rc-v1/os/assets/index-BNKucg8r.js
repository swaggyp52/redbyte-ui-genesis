const I=[{nodeType:"AND",moduleName:"RB_AND",ports:{inputs:["in1","in2"],outputs:["out"]},verilog:`module RB_AND(
  input wire in1,
  input wire in2,
  output wire out
);
  assign out = in1 & in2;
endmodule`},{nodeType:"OR",moduleName:"RB_OR",ports:{inputs:["in1","in2"],outputs:["out"]},verilog:`module RB_OR(
  input wire in1,
  input wire in2,
  output wire out
);
  assign out = in1 | in2;
endmodule`},{nodeType:"NOT",moduleName:"RB_NOT",ports:{inputs:["in"],outputs:["out"]},verilog:`module RB_NOT(
  input wire in,
  output wire out
);
  assign out = ~in;
endmodule`},{nodeType:"NAND",moduleName:"RB_NAND",ports:{inputs:["in1","in2"],outputs:["out"]},verilog:`module RB_NAND(
  input wire in1,
  input wire in2,
  output wire out
);
  assign out = ~(in1 & in2);
endmodule`},{nodeType:"NOR",moduleName:"RB_NOR",ports:{inputs:["in1","in2"],outputs:["out"]},verilog:`module RB_NOR(
  input wire in1,
  input wire in2,
  output wire out
);
  assign out = ~(in1 | in2);
endmodule`},{nodeType:"XOR",moduleName:"RB_XOR",ports:{inputs:["in1","in2"],outputs:["out"]},verilog:`module RB_XOR(
  input wire in1,
  input wire in2,
  output wire out
);
  assign out = in1 ^ in2;
endmodule`},{nodeType:"XNOR",moduleName:"RB_XNOR",ports:{inputs:["in1","in2"],outputs:["out"]},verilog:`module RB_XNOR(
  input wire in1,
  input wire in2,
  output wire out
);
  assign out = ~(in1 ^ in2);
endmodule`},{nodeType:"Wire",moduleName:"RB_WIRE",ports:{inputs:["in"],outputs:["out"]},verilog:`module RB_WIRE(
  input wire in,
  output wire out
);
  assign out = in;
endmodule`},{nodeType:"PowerSource",moduleName:"RB_VCC",ports:{inputs:[],outputs:["out"]},verilog:`module RB_VCC(
  output wire out
);
  assign out = 1'b1;
endmodule`},{nodeType:"Ground",moduleName:"RB_GND",ports:{inputs:[],outputs:["out"]},verilog:`module RB_GND(
  output wire out
);
  assign out = 1'b0;
endmodule`},{nodeType:"DFlipFlop",moduleName:"RB_DFF",ports:{inputs:["d","clk"],outputs:["q"]},verilog:`module RB_DFF(
  input wire d,
  input wire clk,
  output reg q
);
  always @(posedge clk) begin
    q <= d;
  end
endmodule`},{nodeType:"DFlipFlopReset",moduleName:"RB_DFF_RST",ports:{inputs:["d","clk","rst"],outputs:["q"]},verilog:`module RB_DFF_RST(
  input wire d,
  input wire clk,
  input wire rst,
  output reg q
);
  always @(posedge clk or posedge rst) begin
    if (rst)
      q <= 1'b0;
    else
      q <= d;
  end
endmodule`},{nodeType:"RSLatch",moduleName:"RB_RSLATCH",ports:{inputs:["s","r"],outputs:["q","qn"]},verilog:`module RB_RSLATCH(
  input wire s,
  input wire r,
  output reg q,
  output wire qn
);
  assign qn = ~q;
  always @(*) begin
    if (s && !r)
      q = 1'b1;
    else if (r && !s)
      q = 1'b0;
    // If both high or both low, maintain state
  end
endmodule`},{nodeType:"JKFlipFlop",moduleName:"RB_JKFF",ports:{inputs:["j","k","clk"],outputs:["q","qn"]},verilog:`module RB_JKFF(
  input wire j,
  input wire k,
  input wire clk,
  output reg q,
  output wire qn
);
  assign qn = ~q;
  always @(posedge clk) begin
    case ({j, k})
      2'b00: q <= q;     // Hold
      2'b01: q <= 1'b0;  // Reset
      2'b10: q <= 1'b1;  // Set
      2'b11: q <= ~q;    // Toggle
    endcase
  end
endmodule`},{nodeType:"TFlipFlop",moduleName:"RB_TFF",ports:{inputs:["t","clk"],outputs:["q"]},verilog:`module RB_TFF(
  input wire t,
  input wire clk,
  output reg q
);
  always @(posedge clk) begin
    if (t)
      q <= ~q;
  end
endmodule`},{nodeType:"MUX2",moduleName:"RB_MUX2",ports:{inputs:["a","b","sel"],outputs:["out"]},verilog:`module RB_MUX2(
  input wire a,
  input wire b,
  input wire sel,
  output wire out
);
  assign out = sel ? b : a;
endmodule`},{nodeType:"MUX4",moduleName:"RB_MUX4",ports:{inputs:["a","b","c","d","sel0","sel1"],outputs:["out"]},verilog:`module RB_MUX4(
  input wire a,
  input wire b,
  input wire c,
  input wire d,
  input wire sel0,
  input wire sel1,
  output wire out
);
  wire [1:0] sel = {sel1, sel0};
  assign out = (sel == 2'b00) ? a :
               (sel == 2'b01) ? b :
               (sel == 2'b10) ? c : d;
endmodule`},{nodeType:"FullAdder",moduleName:"RB_FULLADDER",ports:{inputs:["a","b","cin"],outputs:["sum","cout"]},verilog:`module RB_FULLADDER(
  input wire a,
  input wire b,
  input wire cin,
  output wire sum,
  output wire cout
);
  assign sum = a ^ b ^ cin;
  assign cout = (a & b) | (cin & (a ^ b));
endmodule`},{nodeType:"HalfAdder",moduleName:"RB_HALFADDER",ports:{inputs:["a","b"],outputs:["sum","cout"]},verilog:`module RB_HALFADDER(
  input wire a,
  input wire b,
  output wire sum,
  output wire cout
);
  assign sum = a ^ b;
  assign cout = a & b;
endmodule`},{nodeType:"TriState",moduleName:"RB_TRISTATE",ports:{inputs:["in","en"],outputs:["out"]},verilog:`module RB_TRISTATE(
  input wire in,
  input wire en,
  output wire out
);
  assign out = en ? in : 1'bz;
endmodule`},{nodeType:"Delay",moduleName:"RB_DELAY",ports:{inputs:["in","clk"],outputs:["out"]},verilog:`module RB_DELAY(
  input wire in,
  input wire clk,
  output reg out
);
  always @(posedge clk) begin
    out <= in;
  end
endmodule`},{nodeType:"ClockDivider",moduleName:"RB_CLKDIV",ports:{inputs:["clk_in"],outputs:["clk_out"]},verilog:`module RB_CLKDIV #(
  parameter DIVISOR = 2
)(
  input wire clk_in,
  output reg clk_out
);
  reg [$clog2(DIVISOR)-1:0] counter = 0;
  always @(posedge clk_in) begin
    if (counter >= DIVISOR - 1) begin
      counter <= 0;
      clk_out <= ~clk_out;
    end else begin
      counter <= counter + 1;
    end
  end
endmodule`},{nodeType:"SevenSegDecoder",moduleName:"RB_7SEG",ports:{inputs:["d0","d1","d2","d3"],outputs:["seg_a","seg_b","seg_c","seg_d","seg_e","seg_f","seg_g"]},verilog:`module RB_7SEG(
  input wire d0, d1, d2, d3,
  output reg seg_a, seg_b, seg_c, seg_d, seg_e, seg_f, seg_g
);
  wire [3:0] digit = {d3, d2, d1, d0};
  always @(*) begin
    case (digit)
      4'h0: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0000001;
      4'h1: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b1001111;
      4'h2: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0010010;
      4'h3: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0000110;
      4'h4: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b1001100;
      4'h5: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0100100;
      4'h6: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0100000;
      4'h7: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0001111;
      4'h8: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0000000;
      4'h9: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0000100;
      4'hA: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0001000;
      4'hB: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b1100000;
      4'hC: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0110001;
      4'hD: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b1000010;
      4'hE: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0110000;
      4'hF: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b0111000;
      default: {seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g} = 7'b1111111;
    endcase
  end
endmodule`}];function T(e){return I.find(t=>t.nodeType===e)}function S(){return I.map(e=>e.nodeType)}function D(e,t,s={}){const o=s.moduleName||"redbyte_circuit",r=[],u=[],g=new Set(S()),d=e.nodes.filter(n=>g.has(n.type)?!0:(u.push(`${n.id} (${n.type})`),r.push(`Node ${n.id} type "${n.type}" not supported for synthesis`),!1)),a=new Map,l=new Map;for(const n of d){const i=T(n.type);if(!i)continue;const _=i.ports.outputs.map(m=>`${n.id}_${m}`);l.set(n.id,_);for(const m of _)a.set(m,{name:m,loads:[]})}for(const n of e.connections){const i=`${n.fromNodeId}_${n.fromPin}`,_=`${n.toNodeId}_${n.toPin}`,m=a.get(i);m?m.loads.push(_):r.push(`Connection from ${n.fromNodeId}.${n.fromPin} has no driver`)}const p=[],f=[];if(t){for(const n of t.inputs){const i=`${n.nodeId}_${n.port}`;p.push(i)}for(const n of t.outputs){const i=`${n.nodeId}_${n.port}`;f.push(i)}}else for(const[n,i]of a.entries())!i.driver&&i.loads.length>0&&p.push(n),i.driver&&i.loads.length===0&&f.push(n);let c=`// Generated by RedByte FPGA Toolchain
`;c+=`// Source: LabProjectV1 CircuitV1
`,c+=`// Timestamp: ${new Date().toISOString()}

`,c+=`module ${o} (
`;const b=[...p.map(n=>`  input wire ${w(n)}`),...f.map(n=>`  output wire ${w(n)}`)];c+=b.join(`,
`),c+=`
);

`;const N=Array.from(a.keys()).filter(n=>!p.includes(n)&&!f.includes(n));if(N.length>0){c+=`  // Internal wires
`;for(const n of N)c+=`  wire ${w(n)};
`;c+=`
`}c+=`  // Component instantiations
`;for(const n of d){const i=T(n.type);if(!i)continue;const _=`inst_${w(n.id)}`;c+=`  ${i.moduleName} ${_} (
`;const m=[];for(const h of i.ports.inputs){const R=O(n.id,h,e.connections,a);m.push(`    .${h}(${w(R||"1'b0")})`)}for(const h of i.ports.outputs){const R=`${n.id}_${h}`;m.push(`    .${h}(${w(R)})`)}c+=m.join(`,
`),c+=`
  );

`}return c+=`endmodule
`,{verilog:c,moduleName:o,inputs:p.map(w),outputs:f.map(w),warnings:r,unsupportedNodes:u}}function O(e,t,s,o){const r=`${e}_${t}`;for(const[u,g]of o.entries())if(g.loads.includes(r))return u;for(const u of s)if(u.toNodeId===e&&u.toPin===t)return`${u.fromNodeId}_${u.fromPin}`;return null}function w(e){return e.replace(/[^a-zA-Z0-9_]/g,"_").replace(/^(\d)/,"_$1")}function $(e){let t=`# Basys3 Constraints
`;if(t+=`# Generated by RedByte FPGA Toolchain

`,t+=`## Clock signal (100 MHz)
`,t+=`set_property -dict { PACKAGE_PIN W5   IOSTANDARD LVCMOS33 } [get_ports clk]
`,t+=`create_clock -period 10.000 -name sys_clk_pin -waveform {0.000 5.000} -add [get_ports clk]

`,e.inputs.length>0){t+=`## Switches
`;for(const s of e.inputs)if(s.pin?.startsWith("SW")){const o=parseInt(s.pin.slice(2),10),r=["V17","V16","W16","W17","W15","V15","W14","W13","V2","T3","T2","R3","W2","U1","T1","R2"];if(o<r.length){const u=w(`${s.nodeId}_${s.port}`);t+=`set_property -dict { PACKAGE_PIN ${r[o]}  IOSTANDARD LVCMOS33 } [get_ports ${u}]
`}}t+=`
`}if(e.outputs.length>0){t+=`## LEDs
`;for(const s of e.outputs)if(s.pin?.startsWith("LD")){const o=parseInt(s.pin.slice(2),10),r=["U16","E19","U19","V19","W18","U15","U14","V14","V13","V3","W3","U3","P3","N3","P1","L1"];if(o<r.length){const u=w(`${s.nodeId}_${s.port}`);t+=`set_property -dict { PACKAGE_PIN ${r[o]}  IOSTANDARD LVCMOS33 } [get_ports ${u}]
`}}}return t}function B(e,t="basys3"){switch(t){case"basys3":return $(e);case"arty-a7":return`# Arty-A7 constraints not yet implemented
`;default:return`# Unknown board: ${t}
`}}async function y(e){const t=d=>{if(d===null||typeof d!="object")return d;if(Array.isArray(d))return d.map(t);const a={};return Object.keys(d).sort().forEach(l=>{a[l]=t(d[l])}),a},s=JSON.stringify(t(e),null,2),r=new TextEncoder().encode(s),u=await crypto.subtle.digest("SHA-256",r);return Array.from(new Uint8Array(u)).map(d=>d.toString(16).padStart(2,"0")).join("")}async function L(e){const t=new Date().toISOString(),s=D(e.circuit,e.ioMapping,{moduleName:"redbyte_top"}),o=e.ioMapping?B(e.ioMapping,"basys3"):void 0,r=await y(JSON.stringify(e.circuit)),u=await y(s.verilog),g=o?await y(o):void 0,d=e.ioMapping?await y(JSON.stringify(e.ioMapping)):void 0,a={schemaVersion:"1.0",timestamp:t,projectId:e.projectId,projectName:e.name,circuitHash:r,nodeCount:e.circuit.nodes.length,connectionCount:e.circuit.connections.length,verilogHash:u,verilogLines:s.verilog.split(`
`).length,constraintsHash:g,boardProfile:e.boardMap?.boardProfileId||"basys3",ioMappingHash:d,warnings:s.warnings,unsupportedNodes:s.unsupportedNodes};return{verilog:s.verilog,constraints:o,metadata:a}}function k(e){const t=[],s=[],o=e.split(`
`);if(!e.trim())return t.push({message:"Verilog code is empty",severity:"error",code:"EMPTY_CODE"}),{valid:!1,errors:t,warnings:s};const r=e.match(/module\s+(\w+)\s*\(/);if(!r)return t.push({message:"No module declaration found",severity:"error",code:"NO_MODULE"}),{valid:!1,errors:t,warnings:s};const u=r[1],g=o.findIndex(n=>n.includes("module"));e.includes("endmodule")||t.push({message:"Missing endmodule declaration",severity:"error",code:"NO_ENDMODULE"});const d=E(e),a=[],l=[],p=[];if(d){const n=d.matchAll(/input\s+(?:wire\s+)?(?:\[[\d:]+\]\s+)?(\w+)/g);for(const _ of n)a.push(_[1]);const i=d.matchAll(/output\s+(?:wire\s+|reg\s+)?(?:\[[\d:]+\]\s+)?(\w+)/g);for(const _ of i)l.push(_[1]);a.length===0&&l.length===0&&s.push({line:g+1,message:"Module has no input or output ports",severity:"warning",code:"NO_PORTS"})}const f=e.matchAll(/wire\s+(?:\[[\d:]+\]\s+)?(\w+)/g);for(const n of f)p.push(n[1]);const c=e.matchAll(/assign\s+(\w+)\s*=/g);for(const n of c){const i=n[1];if(!l.includes(i)&&!p.includes(i)){const _=A(e,n.index||0);s.push({line:_,message:`Signal '${i}' assigned but not declared as output or wire`,severity:"warning",code:"UNDECLARED_SIGNAL"})}}const b=e.matchAll(/\.(\w+)\((\w+)\)/g),N=[...a,...l,...p];for(const n of b){n[1];const i=n[2];if(!N.includes(i)&&!M(i)){const _=A(e,n.index||0);s.push({line:_,message:`Signal '${i}' used in port connection but not declared`,severity:"warning",code:"UNDECLARED_PORT_SIGNAL"})}}return v(e,o,t),{valid:t.length===0,errors:t,warnings:s,moduleInfo:{moduleName:u,inputs:a,outputs:l,wires:p}}}function E(e){const t=e.match(/module\s+\w+\s*\(([\s\S]*?)\);/);return t?t[1]:null}function A(e,t){return e.substring(0,t).split(`
`).length}function M(e){return/^\d+'[bh]\w+$/.test(e)||/^[01]+$/.test(e)}function v(e,t,s){const o=(e.match(/\(/g)||[]).length,r=(e.match(/\)/g)||[]).length;o!==r&&s.push({message:`Unmatched parentheses: ${o} opening, ${r} closing`,severity:"error",code:"UNMATCHED_PARENS"}),t.forEach((g,d)=>{const a=g.trim();a.startsWith("module ")&&!a.includes(";")&&t.slice(d).join(`
`).indexOf(");")===-1&&s.push({line:d+1,message:"Module declaration missing closing );",severity:"error",code:"MISSING_MODULE_SEMICOLON"}),a.startsWith("assign ")&&!a.endsWith(";")&&s.push({line:d+1,message:"assign statement missing semicolon",severity:"error",code:"MISSING_SEMICOLON"})});const u=e.match(/module\s+(\w+)/);if(u){const g=u[1];/^\d/.test(g)&&s.push({message:`Module name '${g}' cannot start with a digit`,severity:"error",code:"INVALID_MODULE_NAME"})}}function P(e,t){const s=[],o=[],r=e.split(`
`);if(!e.trim())return s.push({message:"Constraints file is empty",severity:"error",code:"EMPTY_CONSTRAINTS"}),{valid:!1,errors:s,warnings:o};const u=[];let g=0,d=0;return r.forEach((a,l)=>{const p=a.trim();if(!p||p.startsWith("#"))return;const f=p.match(/set_property\s+.*\s+\[get_ports\s+(?:\{\s*)?(\w+)(?:\s*\})?]/);if(f){const c=f[1];u.push(c),t.includes(c)||o.push({line:l+1,message:`Constrained signal '${c}' not found in circuit`,severity:"warning",code:"UNKNOWN_SIGNAL"})}p.includes("create_clock")&&g++,(p.includes("set_input_delay")||p.includes("set_output_delay"))&&d++,p.includes("set_property")&&!p.includes("[get_ports")&&s.push({line:l+1,message:"set_property command missing [get_ports ...] target",severity:"error",code:"INVALID_SET_PROPERTY"})}),t.forEach(a=>{u.includes(a)||o.push({message:`Circuit signal '${a}' has no pin constraint`,severity:"warning",code:"UNCONSTRAINED_SIGNAL"})}),{valid:s.length===0,errors:s,warnings:o,pinInfo:{constrainedSignals:u,clockConstraints:g,timingConstraints:d}}}function F(e,t){let s=100;if(s-=e.errors.length*20,s-=t.errors.length*15,s-=e.warnings.length*5,s-=t.warnings.length*3,e.moduleInfo){const{inputs:o,outputs:r}=e.moduleInfo;o.length>0&&r.length>0&&(s+=10)}return t.pinInfo?.timingConstraints>0&&(s+=5),Math.max(0,Math.min(100,s))}export{I as VERILOG_PRIMITIVES,F as calculateReadinessScore,D as circuitToVerilog,$ as generateBasys3Constraints,L as generateBitstreamArtifacts,B as generateConstraints,T as getPrimitive,S as getSupportedNodeTypes,P as validateConstraints,k as validateVerilog};
//# sourceMappingURL=index-BNKucg8r.js.map
