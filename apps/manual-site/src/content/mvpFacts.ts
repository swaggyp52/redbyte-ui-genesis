export const mvpFacts = {
  supportsSimMode: true,
  bundleSchemaVersion: 'v2',
  hasInspectorChecks: true,
  hasGradingReport: true,
  bootstrapCommand: 'iwr -useb https://redbyteapps.dev/bootstrap.ps1 | iex',
  bridgeCommandHardware: 'pnpm --filter @redbyte/fpga-bridge dev',
  bridgeCommandSim: 'RB_FPGA_SIM=1 pnpm --filter @redbyte/fpga-bridge dev',
  smokeSimCommand:
    '$env:RB_FPGA_SIM="1"\\npowershell -NoProfile -ExecutionPolicy Bypass -File .\\\\scripts\\\\smoke_fpga.ps1',
};
