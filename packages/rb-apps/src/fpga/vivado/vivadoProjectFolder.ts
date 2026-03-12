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

export interface VivadoArtifactConsistencyInput {
  topVhd: string;
  topXdc: string;
  xprText: string;
  vivadoImportTcl: string;
  testbenchVhd?: string;
  expectedTopModule?: string;
  expectedXprSourceRef?: string;
  expectedXprConstraintsRef?: string;
  expectedTclSourcePath?: string;
  expectedTclConstraintsPath?: string;
  expectedTclSimulationPath?: string;
}

const BASYS3_PART = 'xc7a35tcpg236-1';
const READABLE_TOOL_VERSION = 'Vivado 2024.1+';
const TESTBENCH_TOP_MODULE = 'tb_top';
const VIVADO_PROJECT_VERSION_MINOR = '68';
const VIVADO_FILESETS_MINOR = '32';
const VIVADO_RUNS_MINOR = '22';
const VIVADO_XSIM_VERSION = '2024.2';
const VIVADO_MODELSIM_VERSION = '2024.1';
const VIVADO_QUESTA_VERSION = '2024.1';
const VIVADO_XCELIUM_VERSION = '24.03.003';
const REFERENCE_CONSTRAINTS_FILE_NAME = 'basys3.xdc';

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
  const constraintsPath = `${projectSourcesDir}/constrs_1/new/${REFERENCE_CONSTRAINTS_FILE_NAME}`;
  const simulationPath = `${projectSourcesDir}/sim_1/new/testbench.vhd`;
  const utilsDirPath = `${projectSourcesDir}/utils_1/`;
  const runsDirPath = `${slug}/${slug}.runs/`;
  const synthRunDirPath = `${slug}/${slug}.runs/synth_1/`;
  const implRunDirPath = `${slug}/${slug}.runs/impl_1/`;
  const cacheDirPath = `${slug}/${slug}.cache/`;
  const hwDirPath = `${slug}/${slug}.hw/`;
  const simDirPath = `${slug}/${slug}.sim/`;
  const ipUserFilesDirPath = `${slug}/${slug}.ip_user_files/`;
  const topModule = resolveVivadoTopModule(sourceText, input.topModule);
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
    constraintsPath: `${slug}.srcs/constrs_1/new/${REFERENCE_CONSTRAINTS_FILE_NAME}`,
    simulationPath: testbenchText.length > 0 ? `${slug}.srcs/sim_1/new/testbench.vhd` : undefined,
  });

  const artifactConsistencyIssues = validateVivadoArtifactConsistency({
    topVhd: sourceText,
    topXdc: constraintsText,
    testbenchVhd: testbenchText,
    xprText,
    vivadoImportTcl: importTclText,
    expectedTopModule: topModule,
    expectedXprSourceRef: 'sources_1/new/top.vhd',
    expectedXprConstraintsRef: `constrs_1/new/${REFERENCE_CONSTRAINTS_FILE_NAME}`,
    expectedTclSourcePath: `${slug}.srcs/sources_1/new/top.vhd`,
    expectedTclConstraintsPath: `${slug}.srcs/constrs_1/new/${REFERENCE_CONSTRAINTS_FILE_NAME}`,
    expectedTclSimulationPath: testbenchText.length > 0 ? `${slug}.srcs/sim_1/new/testbench.vhd` : undefined,
  });
  if (artifactConsistencyIssues.length > 0) {
    throw new Error(
      [
        'Vivado export aborted: artifact naming/top-module consistency check failed.',
        ...artifactConsistencyIssues.map((issue) => `- ${issue}`),
      ].join('\n')
    );
  }

  const entries: DeterministicZipEntry[] = [
    { name: utilsDirPath, text: '', dir: true },
    { name: runsDirPath, text: '', dir: true },
    { name: synthRunDirPath, text: '', dir: true },
    { name: implRunDirPath, text: '', dir: true },
    { name: cacheDirPath, text: '', dir: true },
    { name: hwDirPath, text: '', dir: true },
    { name: simDirPath, text: '', dir: true },
    { name: ipUserFilesDirPath, text: '', dir: true },
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
  const synthRunBlock = buildVivadoSynthRunBlock(part);
  const implRunBlock = buildVivadoImplRunBlock(part);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<Project Product="Vivado" Version="7" Minor="${VIVADO_PROJECT_VERSION_MINOR}" Path="${xmlAttr(`$PPRDIR/${projectFileName}`)}">`,
    '  <DefaultLaunch Dir="$PRUNDIR"/>',
    '  <Configuration>',
    `    <Option Name="Id" Val="${xmlAttr(input.xprId)}"/>`,
    `    <Option Name="Part" Val="${xmlAttr(part)}"/>`,
    '    <Option Name="CompiledLibDir" Val="$PCACHEDIR/compile_simlib"/>',
    '    <Option Name="CompiledLibDirXSim" Val=""/>',
    '    <Option Name="CompiledLibDirModelSim" Val="$PCACHEDIR/compile_simlib/modelsim"/>',
    '    <Option Name="CompiledLibDirQuesta" Val="$PCACHEDIR/compile_simlib/questa"/>',
    '    <Option Name="CompiledLibDirXcelium" Val="$PCACHEDIR/compile_simlib/xcelium"/>',
    '    <Option Name="CompiledLibDirVCS" Val="$PCACHEDIR/compile_simlib/vcs"/>',
    '    <Option Name="CompiledLibDirRiviera" Val="$PCACHEDIR/compile_simlib/riviera"/>',
    '    <Option Name="CompiledLibDirActivehdl" Val="$PCACHEDIR/compile_simlib/activehdl"/>',
    '    <Option Name="SimulatorInstallDirModelSim" Val=""/>',
    '    <Option Name="SimulatorInstallDirQuesta" Val=""/>',
    '    <Option Name="SimulatorInstallDirXcelium" Val=""/>',
    '    <Option Name="SimulatorInstallDirVCS" Val=""/>',
    '    <Option Name="SimulatorInstallDirRiviera" Val=""/>',
    '    <Option Name="SimulatorInstallDirActiveHdl" Val=""/>',
    '    <Option Name="SimulatorGccInstallDirModelSim" Val=""/>',
    '    <Option Name="SimulatorGccInstallDirQuesta" Val=""/>',
    '    <Option Name="SimulatorGccInstallDirXcelium" Val=""/>',
    '    <Option Name="SimulatorGccInstallDirVCS" Val=""/>',
    '    <Option Name="SimulatorGccInstallDirRiviera" Val=""/>',
    '    <Option Name="SimulatorGccInstallDirActiveHdl" Val=""/>',
    `    <Option Name="SimulatorVersionXsim" Val="${VIVADO_XSIM_VERSION}"/>`,
    `    <Option Name="SimulatorVersionModelSim" Val="${VIVADO_MODELSIM_VERSION}"/>`,
    `    <Option Name="SimulatorVersionQuesta" Val="${VIVADO_QUESTA_VERSION}"/>`,
    `    <Option Name="SimulatorVersionXcelium" Val="${VIVADO_XCELIUM_VERSION}"/>`,
    '    <Option Name="ActiveSimSet" Val="sim_1"/>',
    '    <Option Name="DefaultLib" Val="xil_defaultlib"/>',
    '    <Option Name="EnableVHDL2008" Val="1"/>',
    '    <Option Name="ProjectType" Val="Default"/>',
    '    <Option Name="TargetLanguage" Val="VHDL"/>',
    '    <Option Name="EnableBDX" Val="FALSE"/>',
    '    <Option Name="WTXSimLaunchSim" Val="0"/>',
    '    <Option Name="WTModelSimLaunchSim" Val="0"/>',
    '    <Option Name="WTQuestaLaunchSim" Val="0"/>',
    '    <Option Name="WTIesLaunchSim" Val="0"/>',
    '    <Option Name="WTVcsLaunchSim" Val="0"/>',
    '    <Option Name="WTRivieraLaunchSim" Val="0"/>',
    '    <Option Name="WTActivehdlLaunchSim" Val="0"/>',
    '    <Option Name="WTXSimExportSim" Val="0"/>',
    '    <Option Name="WTModelSimExportSim" Val="0"/>',
    '    <Option Name="WTQuestaExportSim" Val="0"/>',
    '    <Option Name="WTIesExportSim" Val="0"/>',
    '    <Option Name="WTVcsExportSim" Val="0"/>',
    '    <Option Name="WTRivieraExportSim" Val="0"/>',
    '    <Option Name="WTActivehdlExportSim" Val="0"/>',
    '    <Option Name="GenerateIPUpgradeLog" Val="TRUE"/>',
    '    <Option Name="XSimRadix" Val="hex"/>',
    '    <Option Name="XSimTimeUnit" Val="ns"/>',
    '    <Option Name="XSimArrayDisplayLimit" Val="1024"/>',
    '    <Option Name="XSimTraceLimit" Val="65536"/>',
    '    <Option Name="SimTypes" Val="rtl"/>',
    '    <Option Name="SimTypes" Val="bfm"/>',
    '    <Option Name="SimTypes" Val="tlm"/>',
    '    <Option Name="SimTypes" Val="tlm_dpi"/>',
    '    <Option Name="MEMEnableMemoryMapGeneration" Val="TRUE"/>',
    '    <Option Name="DcpsUptoDate" Val="TRUE"/>',
    '    <Option Name="UseInlineHdlIP" Val="TRUE"/>',
    '    <Option Name="LocalIPRepoLeafDirName" Val="ip_repo"/>',
    '  </Configuration>',
    `  <FileSets Version="1" Minor="${VIVADO_FILESETS_MINOR}">`,
    '    <FileSet Name="sources_1" Type="DesignSrcs" RelSrcDir="$PSRCDIR/sources_1" RelGenDir="$PGENDIR/sources_1">',
    '      <Filter Type="Srcs"/>',
    '      <File Path="$PSRCDIR/sources_1/new/top.vhd">',
      '        <FileInfo>',
      '          <Attr Name="UsedIn" Val="synthesis"/>',
      '          <Attr Name="UsedIn" Val="simulation"/>',
      '        </FileInfo>',
      '      </File>',
      '      <Config>',
      '        <Option Name="DesignMode" Val="RTL"/>',
      `        <Option Name="TopModule" Val="${xmlAttr(topModule)}"/>`,
      '        <Option Name="TopAutoSet" Val="TRUE"/>',
      '      </Config>',
      '    </FileSet>',
    '    <FileSet Name="constrs_1" Type="Constrs" RelSrcDir="$PSRCDIR/constrs_1" RelGenDir="$PGENDIR/constrs_1">',
    '      <Filter Type="Constrs"/>',
    `      <File Path="$PSRCDIR/constrs_1/new/${REFERENCE_CONSTRAINTS_FILE_NAME}">`,
      '        <FileInfo>',
      '          <Attr Name="UsedIn" Val="synthesis"/>',
      '          <Attr Name="UsedIn" Val="implementation"/>',
      '        </FileInfo>',
      '      </File>',
      '      <Config>',
      '        <Option Name="ConstrsType" Val="XDC"/>',
      '      </Config>',
      '    </FileSet>',
    '    <FileSet Name="sim_1" Type="SimulationSrcs" RelSrcDir="$PSRCDIR/sim_1" RelGenDir="$PGENDIR/sim_1">',
    ...(includeSimulation ? ['      <Filter Type="Srcs"/>'] : []),
    ...simulationFileBlock,
    '      <Config>',
    '        <Option Name="DesignMode" Val="RTL"/>',
      `        <Option Name="TopModule" Val="${xmlAttr(simulationConfigTop)}"/>`,
    '        <Option Name="TopLib" Val="xil_defaultlib"/>',
    '        <Option Name="TopAutoSet" Val="TRUE"/>',
    '        <Option Name="TransportPathDelay" Val="0"/>',
    '        <Option Name="TransportIntDelay" Val="0"/>',
    '        <Option Name="SelectedSimModel" Val="rtl"/>',
    '        <Option Name="PamDesignTestbench" Val=""/>',
    '        <Option Name="PamDutBypassFile" Val="xil_dut_bypass"/>',
    '        <Option Name="PamSignalDriverFile" Val="xil_bypass_driver"/>',
    '        <Option Name="PamPseudoTop" Val="pseudo_tb"/>',
    '        <Option Name="SrcSet" Val="sources_1"/>',
    '        <Option Name="CosimPdi" Val=""/>',
    '        <Option Name="CosimPlatform" Val=""/>',
    '        <Option Name="CosimElf" Val=""/>',
    '      </Config>',
    '    </FileSet>',
    '    <FileSet Name="utils_1" Type="Utils" RelSrcDir="$PSRCDIR/utils_1" RelGenDir="$PGENDIR/utils_1">',
    '      <Filter Type="Utils"/>',
    '      <Config>',
    '        <Option Name="TopAutoSet" Val="TRUE"/>',
    '      </Config>',
    '    </FileSet>',
    '  </FileSets>',
    '  <Simulators>',
    '    <Simulator Name="XSim">',
    '      <Option Name="Description" Val="Vivado Simulator"/>',
    '      <Option Name="CompiledLib" Val="0"/>',
    '    </Simulator>',
    '    <Simulator Name="ModelSim">',
    '      <Option Name="Description" Val="ModelSim Simulator"/>',
    '    </Simulator>',
    '    <Simulator Name="Questa">',
    '      <Option Name="Description" Val="Questa Advanced Simulator"/>',
    '    </Simulator>',
    '    <Simulator Name="Riviera">',
    '      <Option Name="Description" Val="Riviera-PRO Simulator"/>',
    '    </Simulator>',
    '    <Simulator Name="ActiveHDL">',
    '      <Option Name="Description" Val="Active-HDL Simulator"/>',
    '    </Simulator>',
    '  </Simulators>',
    `  <Runs Version="1" Minor="${VIVADO_RUNS_MINOR}">`,
    ...synthRunBlock,
    ...implRunBlock,
    '  </Runs>',
    '  <Board/>',
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
    '4. Confirm the part, top module, design sources, and constraints are loaded.',
    '5. Run Synthesis, Run Implementation, then Generate Bitstream.',
    '6. Open Hardware Manager and program the Basys3.',
    '',
    'Fallback:',
    'If Open Project is blocked on your machine, run:',
    '  vivado -mode batch -source vivado_import.tcl -notrace -nojournal -log vivado_import.log',
    '',
    'Important:',
    `- The exported constraints file is "${REFERENCE_CONSTRAINTS_FILE_NAME}" and assumes top-level HDL port names match the generated XDC get_ports names.`,
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

export function validateVivadoArtifactConsistency(input: VivadoArtifactConsistencyInput): string[] {
  const issues: string[] = [];

  const entityName = detectVhdlTopEntity(input.topVhd);
  if (!entityName) {
    issues.push('Could not extract top entity name from top.vhd.');
    return issues;
  }
  const entityPorts = extractVhdlEntityPorts(input.topVhd);
  if (entityPorts.length === 0) {
    issues.push('Could not extract entity port list from top.vhd.');
    return issues;
  }

  const xdcPorts = extractXdcPorts(input.topXdc);
  if (xdcPorts.length === 0) {
    issues.push('Could not extract any [get_ports {...}] names from top.xdc.');
  }
  compareNameSets(entityPorts, xdcPorts, 'top.vhd entity ports', 'top.xdc get_ports', issues);

  const xprTopModule = extractXprSourcesTopModule(input.xprText);
  if (!xprTopModule) {
    issues.push('Could not extract sources_1 TopModule from .xpr.');
  } else {
    assertSameIdentifier(entityName, xprTopModule, 'top.vhd entity', '.xpr sources_1 TopModule', issues);
  }

  const tclTopModule = extractTclTopModule(input.vivadoImportTcl);
  if (!tclTopModule) {
    issues.push('Could not extract top_module from vivado_import.tcl.');
  } else {
    assertSameIdentifier(entityName, tclTopModule, 'top.vhd entity', 'vivado_import.tcl top_module', issues);
  }

  if (input.expectedTopModule && input.expectedTopModule.trim().length > 0) {
    const expectedTop = input.expectedTopModule.trim();
    assertSameIdentifier(entityName, expectedTop, 'top.vhd entity', 'requested topModule', issues);
  }

  if (
    input.expectedXprSourceRef &&
    !input.xprText.toLowerCase().includes(`$psrcdir/${input.expectedXprSourceRef}`.toLowerCase())
  ) {
    issues.push(`.xpr is missing expected design-source reference "$PSRCDIR/${input.expectedXprSourceRef}".`);
  }
  if (
    input.expectedXprConstraintsRef &&
    !input.xprText.toLowerCase().includes(`$psrcdir/${input.expectedXprConstraintsRef}`.toLowerCase())
  ) {
    issues.push(`.xpr is missing expected constraints reference "$PSRCDIR/${input.expectedXprConstraintsRef}".`);
  }

  if (
    input.expectedTclSourcePath &&
    !input.vivadoImportTcl.toLowerCase().includes(`"${input.expectedTclSourcePath}"`.toLowerCase())
  ) {
    issues.push(`vivado_import.tcl is missing expected source path "${input.expectedTclSourcePath}".`);
  }
  if (
    input.expectedTclConstraintsPath &&
    !input.vivadoImportTcl.toLowerCase().includes(`"${input.expectedTclConstraintsPath}"`.toLowerCase())
  ) {
    issues.push(`vivado_import.tcl is missing expected constraints path "${input.expectedTclConstraintsPath}".`);
  }

  if (input.expectedTclSimulationPath) {
    if (!input.vivadoImportTcl.toLowerCase().includes(`"${input.expectedTclSimulationPath}"`.toLowerCase())) {
      issues.push(`vivado_import.tcl is missing expected simulation path "${input.expectedTclSimulationPath}".`);
    }
    if (!input.vivadoImportTcl.includes('add_files -fileset sim_1 -norecurse [list $tb_file]')) {
      issues.push('vivado_import.tcl is missing add_files for sim_1 testbench.');
    }
  }

  const testbenchText = (input.testbenchVhd ?? '').trim();
  if (testbenchText.length > 0) {
    const tbComponent = extractTestbenchComponent(testbenchText);
    if (!tbComponent) {
      issues.push('Could not extract DUT component declaration from testbench.vhd.');
    } else {
      assertSameIdentifier(entityName, tbComponent.name, 'top.vhd entity', 'testbench component name', issues);
      compareNameSets(
        entityPorts,
        tbComponent.ports,
        'top.vhd entity ports',
        'testbench component ports',
        issues
      );
    }

    const tbDutMap = extractTestbenchDutPortMap(testbenchText);
    if (!tbDutMap) {
      issues.push('Could not extract DUT port map from testbench.vhd.');
    } else {
      assertSameIdentifier(entityName, tbDutMap.instanceOf, 'top.vhd entity', 'testbench DUT instance target', issues);
      if (tbDutMap.usesNamedAssociation) {
        compareNameSets(
          entityPorts,
          tbDutMap.portKeys,
          'top.vhd entity ports',
          'testbench DUT port map keys',
          issues
        );
      }
    }
  }

  return issues;
}

function resolveVivadoTopModule(sourceText: string, requestedTopModule: string): string {
  const detected = detectVhdlTopEntity(sourceText);
  return sanitizeIdentifier(detected ?? requestedTopModule, 'top');
}

function detectVhdlTopEntity(sourceText: string): string | null {
  const match = sourceText.match(/\bentity\s+([A-Za-z_][A-Za-z0-9_]*)\s+is\b/i);
  return match?.[1]?.trim() || null;
}

function xmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildVivadoSynthRunBlock(part: string): string[] {
  return [
    `    <Run Id="synth_1" Type="Ft3:Synth" SrcSet="sources_1" Part="${xmlAttr(part)}" ConstrsSet="constrs_1" Description="Vivado Synthesis Defaults" AutoIncrementalCheckpoint="true" WriteIncrSynthDcp="false" State="current" Dir="$PRUNDIR/synth_1" IncludeInArchive="true" IsChild="false" AutoIncrementalDir="$PSRCDIR/utils_1/imports/synth_1" AutoRQSDir="$PSRCDIR/utils_1/imports/synth_1" ParallelReportGen="true">`,
    '      <Strategy Version="1" Minor="2">',
    '        <StratHandle Name="Vivado Synthesis Defaults" Flow="Vivado Synthesis 2024">',
    '          <Desc>Vivado Synthesis Defaults</Desc>',
    '        </StratHandle>',
    '        <Step Id="synth_design"/>',
    '      </Strategy>',
    '      <GeneratedRun Dir="$PRUNDIR" File="gen_run.xml"/>',
    '      <ReportStrategy Name="Vivado Synthesis Default Reports" Flow="Vivado Synthesis 2024"/>',
    '      <Report Name="ROUTE_DESIGN.REPORT_METHODOLOGY" Enabled="1"/>',
    '      <RQSFiles/>',
    '    </Run>',
  ];
}

function buildVivadoImplRunBlock(part: string): string[] {
  return [
    `    <Run Id="impl_1" Type="Ft2:EntireDesign" Part="${xmlAttr(part)}" ConstrsSet="constrs_1" Description="Default settings for Implementation." AutoIncrementalCheckpoint="false" WriteIncrSynthDcp="false" State="current" Dir="$PRUNDIR/impl_1" SynthRun="synth_1" IncludeInArchive="true" IsChild="false" GenFullBitstream="true" AutoIncrementalDir="$PSRCDIR/utils_1/imports/impl_1" LaunchOptions="-jobs 4 " AutoRQSDir="$PSRCDIR/utils_1/imports/impl_1" ParallelReportGen="true">`,
    '      <Strategy Version="1" Minor="2">',
    '        <StratHandle Name="Vivado Implementation Defaults" Flow="Vivado Implementation 2024">',
    '          <Desc>Default settings for Implementation.</Desc>',
    '        </StratHandle>',
    '        <Step Id="init_design"/>',
    '        <Step Id="opt_design"/>',
    '        <Step Id="power_opt_design"/>',
    '        <Step Id="place_design"/>',
    '        <Step Id="post_place_power_opt_design"/>',
    '        <Step Id="phys_opt_design"/>',
    '        <Step Id="route_design"/>',
    '        <Step Id="post_route_phys_opt_design"/>',
    '        <Step Id="write_bitstream"/>',
    '      </Strategy>',
    '      <GeneratedRun Dir="$PRUNDIR" File="gen_run.xml"/>',
    '      <ReportStrategy Name="Vivado Implementation Default Reports" Flow="Vivado Implementation 2024"/>',
    '      <Report Name="ROUTE_DESIGN.REPORT_METHODOLOGY" Enabled="1"/>',
    '      <RQSFiles/>',
    '    </Run>',
  ];
}

function extractVhdlEntityPorts(sourceText: string): string[] {
  const match = sourceText.match(/\bentity\s+[A-Za-z_][A-Za-z0-9_]*\s+is[\s\S]*?\bport\s*\(/i);
  if (!match || typeof match.index !== 'number') return [];
  const openParenIndex = match.index + match[0].lastIndexOf('(');
  const portBlock = extractBalancedParenBlock(sourceText, openParenIndex);
  if (!portBlock) return [];
  return parsePortNameList(portBlock);
}

function extractXdcPorts(topXdc: string): string[] {
  return Array.from(
    new Set(
      [...topXdc.matchAll(/\[get_ports\s*\{([^}]+)\}\]/g)]
        .map((m) => (m[1] ?? '').trim())
        .filter((name) => name.length > 0)
    )
  );
}

function extractXprSourcesTopModule(xprText: string): string | null {
  const match = xprText.match(
    /<FileSet\s+Name="sources_1"[\s\S]*?<Option\s+Name="TopModule"\s+Val="([^"]+)"/i
  );
  return match?.[1]?.trim() ?? null;
}

function extractTclTopModule(vivadoImportTcl: string): string | null {
  const match = vivadoImportTcl.match(/set\s+top_module\s+"([^"]+)"/i);
  return match?.[1]?.trim() ?? null;
}

function extractTestbenchComponent(
  testbenchVhd: string
): { name: string; ports: string[] } | null {
  const match = testbenchVhd.match(/\bcomponent\s+([A-Za-z_][A-Za-z0-9_]*)\s+is[\s\S]*?\bport\s*\(/i);
  if (!match || typeof match.index !== 'number') return null;
  const openParenIndex = match.index + match[0].lastIndexOf('(');
  const portBlock = extractBalancedParenBlock(testbenchVhd, openParenIndex);
  if (!portBlock) return null;

  const nameMatch = match[0].match(/\bcomponent\s+([A-Za-z_][A-Za-z0-9_]*)\s+is/i);
  if (!nameMatch) return null;

  return {
    name: nameMatch[1].trim(),
    ports: parsePortNameList(portBlock),
  };
}

function extractTestbenchDutPortMap(
  testbenchVhd: string
): { instanceOf: string; portKeys: string[]; usesNamedAssociation: boolean } | null {
  const match = testbenchVhd.match(
    /\bdut\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*[\r\n\t ]+port\s+map\s*\(([^]*?)\)\s*;/i
  );
  if (!match) return null;
  const associations = match[2]
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const portKeys = Array.from(
    new Set(
      associations
        .map((entry) => (entry.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=>/)?.[1] ?? '').trim())
        .filter((name) => name.length > 0)
    )
  );
  const usesNamedAssociation = associations.some((entry) => entry.includes('=>'));
  return {
    instanceOf: match[1].trim(),
    portKeys,
    usesNamedAssociation,
  };
}

function parsePortNameList(portBlock: string): string[] {
  const withoutComments = portBlock
    .split('\n')
    .map((line) => line.replace(/--.*$/, '').trim())
    .join('\n');

  return Array.from(
    new Set(
      withoutComments
        .split(';')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .flatMap((entry) => {
          const left = entry.split(':')[0]?.trim() ?? '';
          if (left.length === 0) return [];
          return left
            .split(',')
            .map((name) => name.trim())
            .filter((name) => name.length > 0);
        })
    )
  );
}

function compareNameSets(
  leftNames: string[],
  rightNames: string[],
  leftLabel: string,
  rightLabel: string,
  issues: string[]
): void {
  const leftMap = new Map(leftNames.map((name) => [name.toLowerCase(), name]));
  const rightMap = new Map(rightNames.map((name) => [name.toLowerCase(), name]));

  for (const [normalized, original] of leftMap) {
    if (!rightMap.has(normalized)) {
      issues.push(`${leftLabel} contains "${original}" but ${rightLabel} does not.`);
    }
  }
  for (const [normalized, original] of rightMap) {
    if (!leftMap.has(normalized)) {
      issues.push(`${rightLabel} contains "${original}" but ${leftLabel} does not.`);
    }
  }
}

function assertSameIdentifier(
  left: string,
  right: string,
  leftLabel: string,
  rightLabel: string,
  issues: string[]
): void {
  if (left.trim().toLowerCase() === right.trim().toLowerCase()) return;
  issues.push(`${leftLabel} is "${left}" but ${rightLabel} is "${right}".`);
}

function extractBalancedParenBlock(sourceText: string, openParenIndex: number): string | null {
  if (openParenIndex < 0 || sourceText[openParenIndex] !== '(') return null;
  let depth = 1;
  let cursor = openParenIndex + 1;
  const parts: string[] = [];
  while (cursor < sourceText.length && depth > 0) {
    const ch = sourceText[cursor];
    if (ch === '(') {
      depth += 1;
      parts.push(ch);
      cursor += 1;
      continue;
    }
    if (ch === ')') {
      depth -= 1;
      if (depth > 0) {
        parts.push(ch);
      }
      cursor += 1;
      continue;
    }
    parts.push(ch);
    cursor += 1;
  }
  if (depth !== 0) return null;
  return parts.join('');
}
