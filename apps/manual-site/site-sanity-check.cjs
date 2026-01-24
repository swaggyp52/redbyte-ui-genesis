const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');
const srcRoot = path.join(__dirname, 'src');

const files = {
  app: path.join(srcRoot, 'App.tsx'),
  header: path.join(srcRoot, 'components', 'layout', 'Header.tsx'),
  footer: path.join(srcRoot, 'components', 'layout', 'Footer.tsx'),
  manual: path.join(srcRoot, 'pages', 'Manual.tsx'),
  mvpFacts: path.join(srcRoot, 'content', 'mvpFacts.ts'),
  studentLabApp: path.join(repoRoot, 'packages', 'rb-apps', 'src', 'apps', 'StudentLabApp.tsx'),
  fileSystemContract: path.join(repoRoot, 'docs', 'FILE_SYSTEM_CONTRACT.md'),
  exportSchema: path.join(repoRoot, 'docs', 'STUDENT_EXPORT_SCHEMA.md'),
};

const read = (filePath) => fs.readFileSync(filePath, 'utf8');

const appContent = read(files.app);
const headerContent = read(files.header);
const footerContent = read(files.footer);
const manualContent = read(files.manual);
const mvpFactsContent = read(files.mvpFacts);
const studentLabContent = read(files.studentLabApp);
const fsContractContent = read(files.fileSystemContract);
const exportSchemaContent = read(files.exportSchema);

const routeRegex = /<Route\s+path=["']([^"']+)["']/g;
const routes = new Set();
let match;
while ((match = routeRegex.exec(appContent))) {
  routes.add(match[1]);
}

const linkRegex = /(to|href)=["']([^"']+)["']/g;
const links = [];
for (const content of [headerContent, footerContent]) {
  while ((match = linkRegex.exec(content))) {
    links.push(match[2]);
  }
}

const errors = [];
const internalLinks = links.filter((href) => href.startsWith('/'));
for (const link of internalLinks) {
  const basePath = link.split('#')[0] || '/';
  if (!routes.has(basePath)) {
    errors.push(`Missing route for link: ${link}`);
  }
}

const anchorId = 'student-export-schema';
const anchorRegex = new RegExp(`id=["']${anchorId}["']`);
if (!anchorRegex.test(manualContent)) {
  errors.push(`Missing manual anchor: #${anchorId}`);
}

const schemaMatch = /bundleSchemaVersion:\s*['"]([^'"]+)['"]/.exec(mvpFactsContent);
if (!schemaMatch) {
  errors.push('Missing bundleSchemaVersion in mvpFacts.ts');
} else if (!exportSchemaContent.includes(`"schema_version": "${schemaMatch[1]}"`)) {
  errors.push(`Export schema does not mention schema_version "${schemaMatch[1]}"`);
}

const commandMatch = /bridgeCommandHardware:\s*['"]([^'"]+)['"]/.exec(mvpFactsContent);
const simMatch = /bridgeCommandSim:\s*['"]([^'"]+)['"]/.exec(mvpFactsContent);
if (!commandMatch || !simMatch) {
  errors.push('Missing bridge command entries in mvpFacts.ts');
} else {
  if (!studentLabContent.includes(commandMatch[1])) {
    errors.push('Hardware bridge command does not match StudentLabApp instructions');
  }
  if (!studentLabContent.includes(simMatch[1])) {
    errors.push('SIM bridge command does not match StudentLabApp instructions');
  }
}

if (!fsContractContent.includes('file-v2-')) {
  errors.push('FILE_SYSTEM_CONTRACT.md missing file-v2- id requirement');
}

const appRoots = path.join(repoRoot, 'packages', 'rb-apps', 'src', 'apps');
const appFiles = fs.readdirSync(appRoots).filter((file) => file.endsWith('.tsx'));
const appContents = appFiles.map((file) => read(path.join(appRoots, file)));
const requiredAppIds = ['logic-playground', 'ece-lab', 'submission-inspector'];
for (const id of requiredAppIds) {
  const idRegex = new RegExp(`id:\\s*['"]${id}['"]`);
  if (!appContents.some((content) => idRegex.test(content))) {
    errors.push(`Missing required app id in rb-apps: ${id}`);
  }
}

if (errors.length > 0) {
  console.error('Manual site sanity check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Manual site sanity check passed.');
