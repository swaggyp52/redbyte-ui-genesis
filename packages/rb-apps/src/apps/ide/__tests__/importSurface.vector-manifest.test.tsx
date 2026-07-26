// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import JSZip from 'jszip';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import { getIdeExampleById } from '../examplesCatalog';
import { ImportSurface } from '../surfaces/ImportSurface';
import { buildExportViewModel } from '../viewmodels/buildExportViewModel';

afterEach(() => {
  cleanup();
});

function buildCounterProject(): RBProject {
  const example = getIdeExampleById('two-bit-counter');
  if (!example) throw new Error('Missing two-bit-counter example fixture.');

  const pinById: Record<string, string> = {
    clk: 'CLK100MHZ',
    en: 'SW0',
    rst: 'SW1',
    q0: 'LD0',
    q1: 'LD1',
  };
  const toMappingEntry = (row: (typeof example.ioRows)[number]) => ({
    id: row.id,
    nodeId: row.nodeId,
    port: row.port,
    label: row.id === 'rst' ? 'RST' : row.label,
    pin: pinById[row.id] ?? row.pin,
  });

  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
    name: example.name,
    description: example.summary,
    circuit: structuredClone(example.circuit),
    ioMapping: {
      inputs: example.ioRows.filter((row) => row.direction === 'in').map(toMappingEntry),
      outputs: example.ioRows.filter((row) => row.direction === 'out').map(toMappingEntry),
    },
    vectors: structuredClone(example.vectors),
    fpga: {
      board: 'basys3',
      part: 'xc7a35tcpg236-1',
      top: 'top',
    },
    meta: {
      projectId: 'import-vector-counter-regression',
      projectKind: 'example',
      sourceExampleId: example.id,
    },
  };
}

function requireArtifact(
  viewModel: ReturnType<typeof buildExportViewModel>,
  path: string,
): string {
  const artifact = viewModel.artifacts.find((entry) => entry.path === path);
  if (!artifact?.content) throw new Error(`Missing ${path} export artifact.`);
  return artifact.content;
}

async function buildCounterManifestFile(): Promise<File> {
  const exported = buildExportViewModel(buildCounterProject());
  const manifestText = requireArtifact(exported, 'project.rbproj.json');
  const topVhd = requireArtifact(exported, 'top.vhd');
  const topXdc = requireArtifact(exported, 'top.xdc');

  expect(topVhd).toContain('SW : in  STD_LOGIC_VECTOR(1 downto 0)');
  expect(topVhd).toContain('LED : out STD_LOGIC_VECTOR(1 downto 0)');
  expect(topXdc).toContain('[get_ports {SW[1]}]');
  expect(topXdc).toContain('[get_ports {LED[1]}]');

  const zip = new JSZip();
  zip.file('counter/project.rbproj.json', manifestText);
  zip.file('counter/counter.srcs/sources_1/new/top.vhd', topVhd);
  zip.file('counter/counter.srcs/constrs_1/new/top.xdc', topXdc);
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  const file = new File([bytes], 'counter.zip', { type: 'application/zip' });
  Object.defineProperty(file, 'arrayBuffer', {
    configurable: true,
    value: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
  return file;
}

describe('ImportSurface trusted vector manifest recovery', () => {
  it('restores canonical projected ports through Review and Apply', async () => {
    const onImportProject = vi.fn();
    const view = render(<ImportSurface onImportProject={onImportProject} />);
    const file = await buildCounterManifestFile();

    fireEvent.change(view.getByTestId('ide-import-zip-input'), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-import-review-shell')).toBeTruthy();
    });
    expect(view.getByTestId('ide-import-zip-inspection').textContent).toContain('Manifest restore');

    const portTableText = view.getByTestId('ide-import-ports-table').textContent ?? '';
    expect(portTableText).toContain('SW[1]');
    expect(portTableText).toContain('SW[0]');
    expect(portTableText).toContain('LED[1]');
    expect(portTableText).toContain('LED[0]');
    for (const [portName, pin] of [
      ['SW[1]', 'V16'],
      ['SW[0]', 'V17'],
      ['LED[1]', 'E19'],
      ['LED[0]', 'U16'],
    ]) {
      expect((view.getByLabelText(`import-map-${portName}`) as HTMLInputElement).value).toBe(pin);
    }
    expect(view.queryByTestId('ide-import-blocking-errors')).toBeNull();

    const reviewReplacement = view.getByTestId('ide-import-replace-project') as HTMLButtonElement;
    expect(reviewReplacement.disabled).toBe(false);
    fireEvent.click(reviewReplacement);

    await waitFor(() => {
      expect(view.getByTestId('ide-import-commit-preview')).toBeTruthy();
    });
    expect(view.getByTestId('ide-import-commit-preview').textContent).toContain('5/5 mapped');
    const confirmReplacement = view.getByTestId('ide-import-apply-confirm') as HTMLButtonElement;
    expect(confirmReplacement.disabled).toBe(false);
    fireEvent.click(confirmReplacement);

    await waitFor(() => {
      expect(onImportProject).toHaveBeenCalledTimes(1);
    });
    expect(onImportProject.mock.calls[0][0]).toMatchObject({
      name: '2-Bit Up Counter (Basys3)',
      fpga: { part: 'xc7a35tcpg236-1' },
      meta: { projectId: 'import-vector-counter-regression' },
    });
  });
});
