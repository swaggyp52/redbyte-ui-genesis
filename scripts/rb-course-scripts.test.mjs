import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const read = (relativePath) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/\r\n/g, "\n");

const assertFile = (relativePath) => {
  const absolutePath = path.join(repoRoot, relativePath);
  assert.equal(statSync(absolutePath).isFile(), true, `${relativePath} should exist`);
  return read(relativePath);
};

const assertIncludes = (content, needle, label) => {
  assert.ok(content.includes(needle), `${label} should include ${needle}`);
};

const assertNotIncludes = (content, needle, label) => {
  assert.ok(!content.includes(needle), `${label} should not include ${needle}`);
};

const assertPowerShellSafety = (relativePath, content) => {
  assertIncludes(content, "Set-StrictMode -Version", relativePath);
  assertIncludes(content, '$ErrorActionPreference = "Stop"', relativePath);
  assert.ok(!/(^|[^p])\bnpm\s+install\b/i.test(content), `${relativePath} should not run npm install`);
  assertNotIncludes(content.toLowerCase(), "c:\\users\\conno", relativePath);
  assertNotIncludes(content.toLowerCase(), "remove-item -recurse -force $reporoot", relativePath);
};

const packageJson = JSON.parse(read("package.json"));
assert.equal(
  packageJson.scripts["rb:course-scripts:test"],
  "node scripts/rb-course-scripts.test.mjs",
  "package.json should expose rb:course-scripts:test",
);

assertIncludes(read(".gitignore"), ".redbyte/course/", ".gitignore");

const requiredScripts = [
  "scripts/course/windows/common.ps1",
  "scripts/course/windows/setup.ps1",
  "scripts/course/windows/launch.ps1",
  "scripts/course/windows/doctor.ps1",
  "scripts/course/windows/update.ps1",
  "scripts/course/windows/reset.ps1",
];

const scriptContents = new Map();
for (const relativePath of requiredScripts) {
  const content = assertFile(relativePath);
  scriptContents.set(relativePath, content);
  assertPowerShellSafety(relativePath, content);
}

const setup = scriptContents.get("scripts/course/windows/setup.ps1");
assertIncludes(setup, "pnpm install --frozen-lockfile", "setup.ps1");
assertIncludes(setup, "corepack", "setup.ps1");
assertIncludes(setup, "20.19.0", "setup.ps1");
assertIncludes(setup, "10.24.0", "setup.ps1");
assertIncludes(setup, "Vivado is not required", "setup.ps1");

const launch = scriptContents.get("scripts/course/windows/launch.ps1");
assertIncludes(launch, "Start-RedByte.ps1", "launch.ps1");
assertIncludes(launch, ".redbyte/course/logs", "launch.ps1");
assertIncludes(launch, "-Port", "launch.ps1");
assertIncludes(launch, "-SmokeTest", "launch.ps1");
if (launch.includes("Start-Process")) {
  assertIncludes(launch, "-WindowStyle Hidden", "launch.ps1 Start-Process usage");
}

const doctor = scriptContents.get("scripts/course/windows/doctor.ps1");
assertIncludes(doctor, "pnpm start:smoke", "doctor.ps1");
assertIncludes(doctor, "pnpm -s rb:site:start:test", "doctor.ps1");
assertIncludes(doctor, "Vivado", "doctor.ps1");
assertIncludes(doctor, "Basys3", "doctor.ps1");
assertIncludes(doctor, "Git", "doctor.ps1");

const update = scriptContents.get("scripts/course/windows/update.ps1");
assertIncludes(update, "git status --porcelain", "update.ps1");
assertIncludes(update, "git pull --ff-only origin main", "update.ps1");
assertIncludes(update, "pnpm install --frozen-lockfile", "update.ps1");
assertIncludes(update, "zip distribution", "update.ps1");

const reset = scriptContents.get("scripts/course/windows/reset.ps1");
assertIncludes(reset, "Assert-SafeCourseCleanupPath", "reset.ps1");
assertIncludes(reset, "-DryRun", "reset.ps1");
assertIncludes(reset, "-ConfirmReset", "reset.ps1");
assertIncludes(reset, "student project exports", "reset.ps1");
assertNotIncludes(reset, "Remove-Item -Path *", "reset.ps1");
assertNotIncludes(reset, "Remove-Item -LiteralPath $RepoRoot", "reset.ps1");

for (const name of ["setup", "launch", "doctor"]) {
  const wrapperPath = `${name}.ps1`;
  const wrapper = assertFile(wrapperPath);
  assertPowerShellSafety(wrapperPath, wrapper);
  assertIncludes(wrapper, `scripts/course/windows/${name}.ps1`, wrapperPath);
  const lineCount = wrapper.trim().split("\n").length;
  assert.ok(lineCount <= 40, `${wrapperPath} should remain a short root wrapper`);
}

const quickstart = assertFile("docs/course/windows-quickstart.md");
for (const name of ["setup.ps1", "launch.ps1", "doctor.ps1", "update.ps1", "reset.ps1"]) {
  assertIncludes(quickstart, name, "docs/course/windows-quickstart.md");
}
assertIncludes(quickstart, "Vivado is optional for normal app launch", "docs/course/windows-quickstart.md");
assertIncludes(quickstart, "E0", "docs/course/windows-quickstart.md");
assertIncludes(quickstart, "E1", "docs/course/windows-quickstart.md");
assertIncludes(quickstart, "E2", "docs/course/windows-quickstart.md");
assertIncludes(quickstart, "E3", "docs/course/windows-quickstart.md");

console.log("course Windows scripts contract ok");
