export const mvpFacts = {
  supportsSimMode: true,
  bundleSchemaVersion: 'v2',
  hasInspectorChecks: true,
  hasGradingReport: true,
  bootstrapCommand:
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "git clone https://github.com/swaggyp52/redbyte-ui-genesis.git; cd redbyte-ui-genesis; .\\\\scripts\\\\bootstrap.ps1"',
  bootstrapOverrideCommand:
    '$env:RB_GIT_REF="fpga-mvp-0.1.0"\\npowershell -NoProfile -ExecutionPolicy Bypass -File .\\\\scripts\\\\bootstrap.ps1',
  bridgeCommandHardware: 'pnpm --filter @redbyte/fpga-bridge dev',
  bridgeCommandSim: 'RB_FPGA_SIM=1 pnpm --filter @redbyte/fpga-bridge dev',
  smokeSimCommand:
    '$env:RB_FPGA_SIM="1"\\npowershell -NoProfile -ExecutionPolicy Bypass -File .\\\\scripts\\\\smoke_fpga.ps1',
};
