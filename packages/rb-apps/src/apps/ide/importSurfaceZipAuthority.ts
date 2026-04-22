import type { ZipImportInspection } from './zipImport';

export type ZipImportAuthorityTone = 'success' | 'info' | 'warn' | 'error';

export interface ZipImportAuthorityModel {
  tone: ZipImportAuthorityTone;
  title: string;
  isManifest: boolean;
  /**
   * Single classroom-facing paragraph (HTML escaped by caller / plain text in React).
   */
  classroom: string;
  /** Key facts for the bullet list. */
  facts: Array<{ k: 'top' | 'xdc' | 'ignored' | 'next'; text: string }>;
}

/**
 * One authoritative “what RedByte did with this ZIP” story for the Import surface.
 * Kept pure for unit tests and repo gates (no React).
 */
export function getZipImportAuthorityModel(zi: ZipImportInspection): ZipImportAuthorityModel {
  if (zi.importMode === 'manifest') {
    const mpath = zi.manifestPath ?? 'project.rbproj.json';
    return {
      tone: 'success',
      title: 'What RedByte is using (authoritative)',
      isManifest: true,
      classroom:
        'This is a RedByte project export. RedByte read the embedded manifest as the one source of truth. ' +
        'Loose HDL, XDC, and Vivado helper files in the ZIP were not used to build the active project — treat them as reference only unless you re-export from RedByte.',
      facts: [
        { k: 'top', text: `Manifest: ${mpath} (project bundle)` },
        {
          k: 'ignored',
          text: `Other files in the ZIP: ${zi.ignoredFiles.length} not loaded as sources (list below)`,
        },
        {
          k: 'next',
          text:
            'After pins look right: Review Import, then Confirm Replace Project — your canvas is not replaced until you confirm.',
        },
      ],
    };
  }

  const compiler = zi.status.compiler;
  const level = zi.reconstructionLevel;
  const ignoredN = zi.ignoredFiles.length;

  let title = 'What RedByte loaded';
  let tone: ZipImportAuthorityTone = 'info';
  let classroom =
    'RedByte selected a top HDL file and (when present) a constraint file. The lists below are the full truth of what was used vs ignored.';

  if (compiler === 'blocked') {
    title = 'Import blocked for class use';
    tone = 'error';
    classroom =
      'RedByte cannot build a class-safe, gate-level schematic from this source yet (unsupported or behavioral HDL, or a compile error). Fix the HDL, pick another top file if offered, or use a supported structural example.';
  } else if (level === 'empty') {
    title = 'Nothing to run yet';
    tone = 'warn';
    classroom =
      'No gates were reconstructed — the schematic would stay empty. Check that your top module is structural and that entity/port syntax is valid.';
  } else if (level === 'ports-only') {
    title = 'Ports only — wire logic in Design';
    tone = 'warn';
    classroom =
      'RedByte kept your port list (and any mapped pins) but did not recover internal gates. In class, open Design and build the logic on the canvas, or re-import from a full RedByte export that includes a manifest.';
  } else {
    // full
    if (zi.isImportRunnable) {
      title = 'Ready: gate-level schematic rebuilt';
      tone = 'success';
      classroom =
        'RedByte rebuilt structural / combinational logic into gates and connections. This is the usual “runnable in RedByte” path for supported Vivado sources.';
    } else {
      title = 'Review diagnostics';
      tone = 'warn';
      classroom =
        'HDL was parsed, but RedByte is not ready to treat this as a clean runnable import. Check diagnostics and port mapping before replacing your project.';
    }
  }

  const xdcFact =
    zi.detectedXdcPath != null
      ? zi.detectedXdcPath
      : 'none selected — board pins are guessed until constraints are added or parsed';

  return {
    tone,
    title,
    isManifest: false,
    classroom,
    facts: [
      { k: 'top', text: `Top HDL: ${zi.detectedTopPath} (${zi.detectedTopLanguage.toUpperCase()})` },
      { k: 'xdc', text: `Constraints (XDC): ${xdcFact}` },
      {
        k: 'ignored',
        text: `Ignored in this ZIP: ${ignoredN} file${ignoredN === 1 ? '' : 's'} (see list below) — not loaded as project sources`,
      },
      {
        k: 'next',
        text:
          'Your current project is unchanged until Review Import, then Confirm Replace Project.',
      },
    ],
  };
}
