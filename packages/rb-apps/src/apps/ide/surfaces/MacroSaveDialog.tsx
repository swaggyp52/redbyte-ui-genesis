import React, { useEffect, useMemo, useState } from 'react';
import {
  IdeButton,
  IdeCallout,
  IdeModal,
} from '../components/IdePrimitives';
import type { MacroBoundaryAnalysis } from '../macros/MacroLibrary';

export interface MacroSaveDialogProps {
  isOpen: boolean;
  analysis: MacroBoundaryAnalysis | null;
  defaultName?: string;
  onClose: () => void;
  onSave: (input: {
    name: string;
    description?: string;
    selectedInputIds: string[];
    selectedOutputIds: string[];
  }) => void;
}

export const MacroSaveDialog: React.FC<MacroSaveDialogProps> = ({
  isOpen,
  analysis,
  defaultName = 'My Macro',
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [selectedInputIds, setSelectedInputIds] = useState<string[]>([]);
  const [selectedOutputIds, setSelectedOutputIds] = useState<string[]>([]);

  const inputIds = useMemo(() => analysis?.inputs.map((entry) => entry.id) ?? [], [analysis]);
  const outputIds = useMemo(() => analysis?.outputs.map((entry) => entry.id) ?? [], [analysis]);

  useEffect(() => {
    if (!isOpen) return;
    setName(defaultName);
    setDescription('');
    setSelectedInputIds(inputIds);
    setSelectedOutputIds(outputIds);
  }, [defaultName, inputIds, isOpen, outputIds]);

  if (!isOpen || !analysis) {
    return null;
  }

  const hasErrors = analysis.errors.length > 0;
  const canSave =
    !hasErrors &&
    name.trim().length > 0 &&
    selectedInputIds.length > 0 &&
    selectedOutputIds.length > 0;

  const body = (
    <div className="ide-macro-save-grid">
      <label className="ide-macro-save-field">
        <span>Name</span>
        <input
          type="text"
          className="ide-text-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          data-testid="ide-macro-save-name"
          placeholder="AND_Cluster"
        />
      </label>

      <label className="ide-macro-save-field">
        <span>Description</span>
        <textarea
          className="ide-text-input ide-macro-save-textarea"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          data-testid="ide-macro-save-description"
          placeholder="Student notes about what this block does"
        />
      </label>

      {hasErrors ? (
        <IdeCallout tone="warn" testId="ide-macro-save-errors">
          {analysis.errors.join(' ')}
        </IdeCallout>
      ) : null}

      <section className="ide-macro-save-section">
        <h4>Detected Inputs</h4>
        <div className="ide-macro-save-port-list">
          {analysis.inputs.map((entry) => {
            const checked = selectedInputIds.includes(entry.id);
            return (
              <label key={entry.id} className="ide-macro-save-port-item">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setSelectedInputIds((previous) =>
                      checked
                        ? previous.filter((value) => value !== entry.id)
                        : [...previous, entry.id]
                    );
                  }}
                  data-testid={`ide-macro-save-input-${entry.id}`}
                />
                <span className="ide-macro-save-port-label">{entry.label}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="ide-macro-save-section">
        <h4>Detected Outputs</h4>
        <div className="ide-macro-save-port-list">
          {analysis.outputs.map((entry) => {
            const checked = selectedOutputIds.includes(entry.id);
            return (
              <label key={entry.id} className="ide-macro-save-port-item">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setSelectedOutputIds((previous) =>
                      checked
                        ? previous.filter((value) => value !== entry.id)
                        : [...previous, entry.id]
                    );
                  }}
                  data-testid={`ide-macro-save-output-${entry.id}`}
                />
                <span className="ide-macro-save-port-label">{entry.label}</span>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );

  const actions = (
    <>
      <IdeButton tone="ghost" onClick={onClose} testId="ide-macro-save-cancel">
        Cancel
      </IdeButton>
      <IdeButton
        tone="primary"
        onClick={() =>
          onSave({
            name: name.trim(),
            description: description.trim() || undefined,
            selectedInputIds,
            selectedOutputIds,
          })
        }
        disabled={!canSave}
        testId="ide-macro-save-confirm"
      >
        Save Macro
      </IdeButton>
    </>
  );

  return (
    <IdeModal
      title="Save as Macro"
      body={body}
      actions={actions}
      onClose={onClose}
      testId="ide-macro-save-dialog"
    />
  );
};