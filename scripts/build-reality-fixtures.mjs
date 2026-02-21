// scripts/build-reality-fixtures.mjs
// Run once: node scripts/build-reality-fixtures.mjs
// Generates fixtures 03, 04, 05 for the reality-pack gate.
import { createRequire } from 'module';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load JSZip from rb-apps package where it is installed
const require = createRequire(
  pathToFileURL(resolve(__dirname, '../packages/rb-apps/package.json'))
);
const JSZip = require('jszip');

const outDir = resolve(
  __dirname,
  '../packages/rb-apps/src/fixtures/import/zip'
);
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------------------
// Fixture 03: Multi-HDL top ambiguity
// Two HDL files — top.vhd (3-port AND gate) wins over helper.vhd (no ports).
// ---------------------------------------------------------------------------
{
  const zip = new JSZip();

  zip.file(
    'top.vhd',
    `library ieee;
use ieee.std_logic_1164.all;

entity top is
  port (
    a : in  std_logic;
    b : in  std_logic;
    y : out std_logic
  );
end top;

architecture rtl of top is
begin
  y <= a and b;
end rtl;
`
  );

  zip.file(
    'helper.vhd',
    `library ieee;
use ieee.std_logic_1164.all;

entity helper_buf is
end helper_buf;

architecture rtl of helper_buf is
begin
end rtl;
`
  );

  zip.file(
    'basys3.xdc',
    `## Switch Inputs
set_property PACKAGE_PIN V17 [get_ports {a}]
set_property PACKAGE_PIN V16 [get_ports {b}]
## LED Output
set_property PACKAGE_PIN U16 [get_ports {y}]
`
  );

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const outPath = resolve(outDir, '03-multi-hdl-ambiguous-top.zip');
  writeFileSync(outPath, buffer);
  console.log('Wrote 03-multi-hdl-ambiguous-top.zip to', outPath);
}

// ---------------------------------------------------------------------------
// Fixture 04: XDC port mismatch + warnings
// basys3.xdc maps a, b, y (all real HDL ports) PLUS clk (ghost port).
// Import should succeed with a warning about clk being ignored.
// ---------------------------------------------------------------------------
{
  const zip = new JSZip();

  zip.file(
    'top.vhd',
    `library ieee;
use ieee.std_logic_1164.all;

entity top is
  port (
    a : in  std_logic;
    b : in  std_logic;
    y : out std_logic
  );
end top;

architecture rtl of top is
begin
  y <= a and b;
end rtl;
`
  );

  zip.file(
    'basys3.xdc',
    `## Switch Inputs
set_property PACKAGE_PIN V17 [get_ports {a}]
set_property PACKAGE_PIN V16 [get_ports {b}]
## LED Output
set_property PACKAGE_PIN U16 [get_ports {y}]
## Clock (ghost — not in HDL)
set_property PACKAGE_PIN W5 [get_ports {clk}]
`
  );

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const outPath = resolve(outDir, '04-xdc-port-mismatch.zip');
  writeFileSync(outPath, buffer);
  console.log('Wrote 04-xdc-port-mismatch.zip to', outPath);
}

// ---------------------------------------------------------------------------
// Fixture 05: Behavioural VHDL — ports-only reconstruction
// Uses a process block → reconstructionLevel === 'ports-only'.
// top.xdc maps all 3 real ports so import succeeds with no blocking errors.
// ---------------------------------------------------------------------------
{
  const zip = new JSZip();

  zip.file(
    'top.vhd',
    `library ieee;
use ieee.std_logic_1164.all;

entity top is
  port (
    clk : in  std_logic;
    d   : in  std_logic;
    q   : out std_logic
  );
end top;

architecture behav of top is
begin
  process(clk)
  begin
    if rising_edge(clk) then
      q <= d;
    end if;
  end process;
end behav;
`
  );

  zip.file(
    'top.xdc',
    `## Clock
set_property PACKAGE_PIN W5 [get_ports {clk}]
## Data input
set_property PACKAGE_PIN V17 [get_ports {d}]
## Output
set_property PACKAGE_PIN U16 [get_ports {q}]
`
  );

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const outPath = resolve(outDir, '05-behavioural-ports-only.zip');
  writeFileSync(outPath, buffer);
  console.log('Wrote 05-behavioural-ports-only.zip to', outPath);
}
