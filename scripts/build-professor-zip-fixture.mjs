// scripts/build-professor-zip-fixture.mjs
// Run once: node scripts/build-professor-zip-fixture.mjs
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

const zip = new JSZip();

// Vivado-style nested structure
zip.file(
  'professor_and/professor_and.srcs/sources_1/new/top.vhd',
  `library ieee;
use ieee.std_logic_1164.all;

entity top is
  port (
    sw0 : in  std_logic;
    sw1 : in  std_logic;
    ld0 : out std_logic
  );
end top;

architecture rtl of top is
begin
  ld0 <= sw0 and sw1;
end rtl;
`
);

zip.file(
  'professor_and/professor_and.srcs/constrs_1/new/basys3.xdc',
  `## Switch Inputs
set_property PACKAGE_PIN V17 [get_ports {sw0}]
set_property PACKAGE_PIN V16 [get_ports {sw1}]
## LED Output
set_property PACKAGE_PIN U16 [get_ports {ld0}]
`
);

// Decoy files (typical Vivado project noise)
zip.file('professor_and/professor_and.xpr', '<!-- Vivado project file -->');
zip.file('professor_and/professor_and.runs/synth_1/.Xil/placeholder', '');

const buffer = await zip.generateAsync({ type: 'nodebuffer' });

const outPath = resolve(
  __dirname,
  '../packages/rb-apps/src/fixtures/import/zip/02-vivado-nested-andgate.zip'
);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, buffer);
console.log('Wrote 02-vivado-nested-andgate.zip to', outPath);
