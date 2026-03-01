# surface-import agent

## Domain Ownership
This agent owns the Import surface of the RedByte IDE — importing HDL, XDC constraint files, project JSON files, and submission bundles.

## Primary Files
- `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx` — main import surface
- `packages/rb-apps/src/export/projectFormat.ts` — `decodeRBProject()`, `RBProject` schema
- `packages/rb-apps/src/export/parseIdeSubmission.ts` — parses submission bundles (`.rbsub.zip`)
- `packages/rb-apps/src/apps/ide/surfaces/SubmissionViewerSurface.tsx` — displays parsed submission

## ImportSurface Props
```typescript
interface ImportSurfaceProps {
  onImportProject: (project: RBProject) => void;
  projectIoRows: ProjectIoRow[];
  onApplySuggestions: (items: Array<{ rowId: string; pin: string }>) => void;
  onGoToProject: () => void;
  onGoToVerify: () => void;
  onImportSubmission: (submission: ParsedIdeSubmission) => void;
}
```

## Import Modes / Tabs
ImportSurface has multiple input modes:

### 1. Project File Import
- Accepts `.rbproj.json` files
- Parsed with `decodeRBProject(rawText)`
- Calls `onImportProject(project)`
- Drag-and-drop or file picker

### 2. BASYS3 Pin Import / XDC Tab
- Paste XDC constraint text
- Auto-generates pin suggestions by matching signal names to ioRows
- Calls `onApplySuggestions([{ rowId, pin }])`

### 3. HDL Tab
- Paste VHDL/Verilog text for reference
- `stripHdlComments(hdlText)` removes comment lines
- Extracts entity/module port names for signal suggestion

### 4. Submission Bundle Import
- Accepts `.rbsub.zip` files
- Parsed with `parseIdeSubmission(bytes)`
- Returns `ParsedIdeSubmission` which is displayed in `SubmissionViewerSurface`

## RBProject Schema
```typescript
interface RBProject {
  kind: 'rb-project';
  version: 1;
  name: string;
  description?: string;
  circuit: { nodes: CircuitNode[]; connections: CircuitConnection[] };
  hdl: { top: string; sources: Array<{ path: string; language: string; text: string }> };
  fpga: { board: 'basys3'; top: string; constraints: { type: 'xdc'; text: string } };
  ioMapping: { inputs: IoMappingEntry[]; outputs: IoMappingEntry[] };
  vectors: TestVector[];
  customComponents?: CompositeNodeDef[];
  meta?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

## ParsedIdeSubmission
```typescript
interface ParsedIdeSubmission {
  project: RBProject;
  verifyRuns: RuntimeVerifyRun[];
  studentName?: string;
  submittedAt: string;
  appCommitSha?: string;
}
```

## Pin Autocomplete Logic
When user pastes XDC text:
1. Parse lines matching `set_property PACKAGE_PIN <pin> [get_ports <signal>]`
2. For each parsed signal, fuzzy-match against `projectIoRows` by label/id/port
3. Generate `[{ rowId, pin }]` suggestions
4. Show preview table — user can confirm before applying with `onApplySuggestions`

## Common Tasks
- **Fix project file import parsing**: Edit `decodeRBProject` in `projectFormat.ts`
- **Fix XDC pin extraction**: Edit pin parsing regex in ImportSurface.tsx
- **Add new import format**: Add new tab + handler in ImportSurface.tsx
- **Fix submission bundle parsing**: Edit `parseIdeSubmission.ts`
- **Debug auto-suggestion mismatch**: Trace signal name normalization in ImportSurface pin matching logic
