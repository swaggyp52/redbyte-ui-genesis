import type { DeterministicZipEntry } from '../../export/deterministicZip';
import { buildDeterministicZip, sha256Hex } from '../../export/deterministicZip';
import { compareCodepoint } from '../../export/codepointSort';
import { hashString } from '../../utils/digest';
import { generateVivadoImportTcl } from '../boards/basys3/vivadoImportTcl';

export interface VivadoProjectFolderArtifact {
  path: string;
  content: string;
}

export interface BuildVivadoProjectFolderInput {
  artifacts: VivadoProjectFolderArtifact[];
  projectName: string;
  projectSlug?: string;
  topModule: string;
  part?: string;
}

const BASYS3_PART = 'xc7a35tcpg236-1';
const BASYS3_BOARD_PART = 'digilentinc.com:basys3:part0:1.2';
const READABLE_TOOL_VERSION = 'Vivado 2024.1+';
const TESTBENCH_TOP_MODULE = 'tb_top';

export function deriveVivadoProjectSlug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : 'redbyte-project';
}

export function resolveVivadoPart(value?: string): string {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : BASYS3_PART;
}

export async function buildVivadoProjectFolderZip(
  input: BuildVivadoProjectFolderInput
): Promise<Uint8Array> {
  return buildDeterministicZip(await buildVivadoProjectFolderEntries(input));
}

export async function buildVivadoProjectFolderEntries(
  input: BuildVivadoProjectFolderInput
): Promise<DeterministicZipEntry[]> {
  const slug = deriveVivadoProjectSlug(input.projectSlug ?? input.projectName);
  const topModule = sanitizeIdentifier(input.topModule, 'top');
  const part = resolveVivadoPart(input.part);
  const artifactMap = new Map(
    input.artifacts.map((artifact) => [artifact.path.trim().toLowerCase(), artifact.content])
  );

  const manifestText = requireArtifactText(artifactMap, 'project.rbproj.json');
  const sourceText = requireArtifactText(artifactMap, 'top.vhd');
  const constraintsText = requireArtifactText(artifactMap, 'top.xdc');
  const testbenchText = optionalArtifactText(artifactMap, 'testbench.vhd');
  const expectedIoText = optionalArtifactText(artifactMap, 'expected_io.json');
  const bringupText = optionalArtifactText(artifactMap, 'bringup.md');
  const programAndTestText = optionalArtifactText(artifactMap, 'program_and_test.tcl');

  const projectSourcesDir = `${slug}/${slug}.srcs`;
  const sourcePath = `${projectSourcesDir}/sources_1/new/top.vhd`;
  const constraintsPath = `${projectSourcesDir}/constrs_1/new/top.xdc`;
  const simulationPath = `${projectSourcesDir}/sim_1/new/testbench.vhd`;
  const xprId = await buildVivadoProjectId(manifestText);
  const xprText = buildVivadoXpr({
    projectFileName: `${slug}.xpr`,
    topModule,
    part,
    xprId,
    includeSimulation: testbenchText.length > 0,
  });
  const readmeText = buildVivadoProjectFolderReadme({
    projectName: input.projectName,
    projectSlug: slug,
    topModule,
    part,
    includeSimulation: testbenchText.length > 0,
  });
  const importTclText = generateVivadoImportTcl({
    projectName: slug,
    topEntity: topModule,
    part,
    sourcePaths: [`${slug}.srcs/sources_1/new/top.vhd`],
    constraintsPath: `${slug}.srcs/constrs_1/new/top.xdc`,
    simulationPath: testbenchText.length > 0 ? `${slug}.srcs/sim_1/new/testbench.vhd` : undefined,
  });

  const entries: DeterministicZipEntry[] = [
    { name: `${slug}/${slug}.xpr`, text: xprText },
    { name: `${slug}/project.rbproj.json`, text: manifestText },
    { name: `${slug}/README.txt`, text: readmeText },
    { name: `${slug}/vivado_import.tcl`, text: importTclText },
    { name: sourcePath, text: sourceText },
    { name: constraintsPath, text: constraintsText },
  ];

  if (testbenchText.length > 0) {
    entries.push({ name: simulationPath, text: testbenchText });
  }
  if (expectedIoText.length > 0) {
    entries.push({ name: `${slug}/EXPECTED_IO.json`, text: expectedIoText });
  }
  if (bringupText.length > 0) {
    entries.push({ name: `${slug}/BRINGUP.md`, text: bringupText });
  }
  if (programAndTestText.length > 0) {
    entries.push({ name: `${slug}/program_and_test.tcl`, text: programAndTestText });
  }

  return entries.sort((left, right) => compareCodepoint(left.name, right.name));
}

export interface BuildVivadoXprInput {
  projectFileName: string;
  topModule: string;
  part?: string;
  xprId: string;
  includeSimulation?: boolean;
}

export function buildVivadoXpr(input: BuildVivadoXprInput): string {
  const projectFileName = sanitizeFileName(input.projectFileName, 'redbyte-project.xpr');
  const topModule = sanitizeIdentifier(input.topModule, 'top');
  const part = resolveVivadoPart(input.part);
  const includeSimulation = input.includeSimulation === true;

  const simulationFileBlock = includeSimulation
    ? [
        '      <File Path="$PSRCDIR/sim_1/new/testbench.vhd">',
        '        <FileInfo>',
        '          <Attr Name="UsedIn" Val="simulation"/>',
        '          <Attr Name="OrigSrcFilePath" Val="$PSRCDIR/sim_1/new/testbench.vhd"/>',
        '          <Attr Name="OrigSrcFileType" Val="FILE_SET"/>',
        '        </FileInfo>',
        '      </File>',
      ]
    : [];

  const simulationConfigTop = includeSimulation ? TESTBENCH_TOP_MODULE : topModule;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<Project Version="7" Minor="65" Path="${xmlAttr(`$PPRDIR/${projectFileName}`)}">`,
    '  <DefaultLaunch Dir="$PPRDIR/.Xil" Mode="default"/>',
    '  <Configuration>',
    `    <Option Name="Id" Val="${xmlAttr(input.xprId)}"/>`,
    `    <Option Name="Part" Val="${xmlAttr(part)}"/>`,
    `    <Option Name="BoardPart" Val="${xmlAttr(BASYS3_BOARD_PART)}"/>`,
    '    <Option Name="ActiveSimSet" Val="sim_1"/>',
    '    <Option Name="DefaultLib" Val="xil_defaultlib"/>',
    '    <Option Name="EnableVHDL2008" Val="1"/>',
    '    <Option Name="ProjectType" Val="Default"/>',
    '    <Option Name="TargetLanguage" Val="VHDL"/>',
    '  </Configuration>',
    '  <FileSets Version="1" Minor="31">',
    '    <FileSet Name="sources_1" Type="DesignSrcs" RelSrcDir="$PSRCDIR/sources_1" RelGenDir="$PGENDIR/sources_1">',
    '      <Filter Type="Srcs"/>',
    '      <File Path="$PSRCDIR/sources_1/new/top.vhd">',
    '        <FileInfo>',
    '          <Attr Name="UsedIn" Val="synthesis"/>',
    '          <Attr Name="UsedIn" Val="implementation"/>',
    '          <Attr Name="UsedIn" Val="simulation"/>',
    '          <Attr Name="OrigSrcFilePath" Val="$PSRCDIR/sources_1/new/top.vhd"/>',
    '          <Attr Name="OrigSrcFileType" Val="FILE_SET"/>',
    '        </FileInfo>',
    '      </File>',
    '      <Config>',
    '        <Option Name="DesignMode" Val="RTL"/>',
    `        <Option Name="TopModule" Val="${xmlAttr(topModule)}"/>`,
    '        <Option Name="TopAutoSet" Val="FALSE"/>',
    '      </Config>',
    '    </FileSet>',
    '    <FileSet Name="constrs_1" Type="Constrs" RelSrcDir="$PSRCDIR/constrs_1" RelGenDir="$PGENDIR/constrs_1">',
    '      <File Path="$PSRCDIR/constrs_1/new/top.xdc">',
    '        <FileInfo>',
    '          <Attr Name="UsedIn" Val="synthesis"/>',
    '          <Attr Name="UsedIn" Val="implementation"/>',
    '          <Attr Name="OrigSrcFilePath" Val="$PSRCDIR/constrs_1/new/top.xdc"/>',
    '          <Attr Name="OrigSrcFileType" Val="FILE_SET"/>',
    '        </FileInfo>',
    '      </File>',
    '      <Config>',
    '        <Option Name="TargetConstrsFile" Val="$PSRCDIR/constrs_1/new/top.xdc"/>',
    '      </Config>',
    '    </FileSet>',
    '    <FileSet Name="sim_1" Type="SimulationSrcs" RelSrcDir="$PSRCDIR/sim_1" RelGenDir="$PGENDIR/sim_1">',
    '      <Filter Type="Srcs"/>',
    ...simulationFileBlock,
    '      <Config>',
    `        <Option Name="TopModule" Val="${xmlAttr(simulationConfigTop)}"/>`,
    '        <Option Name="TopAutoSet" Val="FALSE"/>',
    '      </Config>',
    '    </FileSet>',
    '    <FileSet Name="utils_1" Type="Utils" RelSrcDir="$PSRCDIR/utils_1" RelGenDir="$PGENDIR/utils_1"/>',
    '  </FileSets>',
    '  <Simulators>',
    '    <Simulator Name="XSim"/>',
    '  </Simulators>',
    '  <Runs Version="1" Minor="28">',
    `    <Run Id="synth_1" Type="Ft3:Synth:Vivado Synthesis 2022" SrcSet="sources_1" Part="${xmlAttr(part)}" ConstrsSet="constrs_1" Description="" AutoIncrementalCheckpoint="false">`,
    '      <Strategy Version="1" Minor="1">Vivado Synthesis Defaults</Strategy>',
    '      <ReportStrategy Name="Vivado Synthesis Default Reports"/>',
    '    </Run>',
    `    <Run Id="impl_1" Type="Ft4:Imp:Vivado Implementation 2022" SrcSet="sources_1" Part="${xmlAttr(part)}" ConstrsSet="constrs_1" SynthRun="synth_1" Description="" AutoIncrementalCheckpoint="false">`,
    '      <Strategy Version="1" Minor="1">Vivado Implementation Defaults</Strategy>',
    '      <ReportStrategy Name="Vivado Implementation Default Reports"/>',
    '    </Run>',
    '  </Runs>',
    '  <Boards>',
    `    <Board Id="basys3" Spec="1.2" Part="${xmlAttr(part)}"/>`,
    '  </Boards>',
    '</Project>',
    '',
  ].join('\n');
}

interface BuildVivadoProjectFolderReadmeInput {
  projectName: string;
  projectSlug: string;
  topModule: string;
  part: string;
  includeSimulation: boolean;
}

function buildVivadoProjectFolderReadme(input: BuildVivadoProjectFolderReadmeInput): string {
  const lines = [
    'RedByte Vivado Project Folder (Open Project)',
    '',
    `Project: ${input.projectName}`,
    'Board: Basys3',
    `Part: ${input.part}`,
    `Top module: ${input.topModule}`,
    `Tool: ${READABLE_TOOL_VERSION}`,
    '',
    'Recommended student flow:',
    `1. Unzip the download so the folder "${input.projectSlug}" is visible.`,
    '2. Open Vivado.',
    `3. Click "Open Project" and select "${input.projectSlug}.xpr".`,
    '4. Confirm the design sources and constraints are loaded.',
    '5. Run Synthesis, Run Implementation, then Generate Bitstream.',
    '6. Open Hardware Manager and program the Basys3.',
    '',
    'Fallback:',
    'If Open Project is blocked on your machine, run:',
    '  vivado -mode batch -source vivado_import.tcl -notrace -nojournal -log vivado_import.log',
    '',
    'Important:',
    '- The exported constraints assume top-level HDL port names match the generated XDC get_ports names.',
    '- RedByte generated this folder deterministically from the project manifest.',
  ];

  if (input.includeSimulation) {
    lines.push('- The project includes testbench.vhd under sim_1 for behavioral simulation.');
  }

  lines.push('');
  return lines.join('\n');
}

async function buildVivadoProjectId(manifestText: string): Promise<string> {
  const manifestBytes = new TextEncoder().encode(manifestText);
  try {
    return (await sha256Hex(manifestBytes)).slice(0, 32);
  } catch {
    return hashString(manifestText).padStart(32, '0').slice(0, 32);
  }
}

function requireArtifactText(
  artifactMap: Map<string, string>,
  path: string
): string {
  const value = optionalArtifactText(artifactMap, path);
  if (value.length === 0) {
    throw new Error(`Missing required export artifact: ${path}`);
  }
  return value;
}

function optionalArtifactText(
  artifactMap: Map<string, string>,
  path: string
): string {
  return (artifactMap.get(path.toLowerCase()) ?? '').trim();
}

function sanitizeIdentifier(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (normalized.length === 0) return fallback;
  if (!/^[A-Za-z_]/.test(normalized)) return `${fallback}_${normalized}`;
  return normalized;
}

function sanitizeFileName(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : fallback;
}

function xmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
