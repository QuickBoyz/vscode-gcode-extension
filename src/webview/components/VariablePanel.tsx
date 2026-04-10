import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VariableDefinitions } from '../../visualizer/VariableResolutionService';
import { ReferencedVariable } from '../../visualizer/types';
import vscode from '../vscodeApi';

/** A single variable entry displayed in the panel. */
interface VariableEntry {
  /** The raw key as typed by the user (e.g. "#100" or "#<tool_diameter>"). */
  readonly key: string;
  /** The current numeric value (override or default). */
  readonly value: number;
}

interface VariablePanelProps {
  /** Whether the panel is expanded. */
  readonly isOpen: boolean;
  /** Toggle the panel open/closed. */
  readonly onToggle: () => void;
  /** Current variable overrides (key -> value). */
  readonly overrides: Readonly<Record<string, number>>;
  /** Called when overrides change. */
  readonly onOverridesChange: (overrides: Readonly<Record<string, number>>) => void;
  /** Variables referenced in the current G-code program. */
  readonly referencedVariables: readonly ReferencedVariable[];
  /** Variables defined in VS Code settings (`gcode.variables`). */
  readonly settingsVariables: VariableDefinitions;
}

/** Debounce delay in milliseconds for posting override changes. */
const OVERRIDE_DEBOUNCE_MS = 400;

/**
 * Pattern matching recognized G-code variable key formats:
 * - `#nnn` or `nnn` — numeric variable
 * - `#<name>` — named variable with angle brackets
 * - `name` — bare named variable (letters, digits, underscores)
 */
const VALID_VARIABLE_KEY_PATTERN =
  /^(#?\d+|#<[a-zA-Z_][a-zA-Z0-9_]*>|[a-zA-Z_][a-zA-Z0-9_]*)$/;

// ---------------------------------------------------------------------------
// Inline-editable variable row
// ---------------------------------------------------------------------------

interface EditableVariableRowProps {
  /** The variable key to display. */
  readonly variableKey: string;
  /** The current value (from settings, program, or override). */
  readonly value: number | null;
  /** Whether this variable already has a runtime override. */
  readonly hasOverride: boolean;
  /** Called when the user saves an edited value. */
  readonly onSave: (key: string, value: number) => void;
  /** Called when the user removes the override for this variable. */
  readonly onRemove?: (key: string) => void;
}

function EditableVariableRow({
  variableKey,
  value,
  hasOverride,
  onSave,
  onRemove,
}: EditableVariableRowProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    setEditValue(value !== null ? String(value) : '0');
    setEditing(true);
  }, [value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleSave = useCallback(() => {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed)) {
      onSave(variableKey, parsed);
    }
    setEditing(false);
  }, [editValue, variableKey, onSave]);

  const handleCancel = useCallback(() => {
    setEditing(false);
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        handleSave();
      } else if (event.key === 'Escape') {
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

  if (editing) {
    return (
      <div className="variable-row variable-row-editing">
        <span className="variable-key" title={variableKey}>
          {variableKey}
        </span>
        <input
          ref={inputRef}
          type="number"
          className="variable-value-input"
          value={editValue}
          step="any"
          onChange={(event) => setEditValue(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="variable-action-btn variable-save-btn"
          type="button"
          title="Save"
          onClick={handleSave}
        >
          {'\u2713'}
        </button>
        <button
          className="variable-action-btn variable-cancel-btn"
          type="button"
          title="Cancel"
          onClick={handleCancel}
        >
          {'\u2715'}
        </button>
      </div>
    );
  }

  return (
    <div className={`variable-row ${hasOverride ? 'variable-override-row' : 'variable-referenced-row'}`}>
      <span className="variable-key" title={variableKey}>
        {variableKey}
      </span>
      <span className="variable-referenced-value">
        {value !== null ? value : 'unset'}
      </span>
      <button
        className="variable-action-btn variable-edit-btn"
        type="button"
        title="Edit value"
        onClick={startEdit}
      >
        {'\u270E'}
      </button>
      {hasOverride && onRemove && (
        <button
          className="variable-action-btn variable-remove-btn"
          type="button"
          title="Remove override"
          onClick={() => onRemove(variableKey)}
        >
          {'\u2715'}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

/**
 * Collapsible panel for viewing and overriding G-code variables.
 *
 * Users can edit any variable value inline. Edits create runtime overrides
 * that are debounced and sent to the extension host via postMessage,
 * triggering a tool-path re-extraction.
 */
export function VariablePanel({
  isOpen,
  onToggle,
  overrides,
  onOverridesChange,
  referencedVariables,
  settingsVariables,
}: VariablePanelProps) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [keyError, setKeyError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [referencedOpen, setReferencedOpen] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the debounce timer on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const entries: VariableEntry[] = useMemo(
    () => Object.entries(overrides).map(([key, value]) => ({ key, value })),
    [overrides]
  );

  const settingsEntries: VariableEntry[] = useMemo(
    () => Object.entries(settingsVariables).map(([key, value]) => ({ key, value })),
    [settingsVariables]
  );

  const postOverrides = useCallback((updated: Readonly<Record<string, number>>) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      vscode.postMessage({ type: 'variableOverrides', overrides: updated });
      debounceRef.current = null;
    }, OVERRIDE_DEBOUNCE_MS);
  }, []);

  const handleSaveOverride = useCallback(
    (key: string, value: number) => {
      const updated = { ...overrides, [key]: value };
      onOverridesChange(updated);
      postOverrides(updated);
    },
    [overrides, onOverridesChange, postOverrides]
  );

  const handleRemoveOverride = useCallback(
    (key: string) => {
      const updated = Object.fromEntries(Object.entries(overrides).filter(([k]) => k !== key));
      onOverridesChange(updated);
      postOverrides(updated);
    },
    [overrides, onOverridesChange, postOverrides]
  );

  const handleAdd = useCallback(() => {
    const trimmedKey = newKey.trim();
    if (!trimmedKey) return;

    if (!VALID_VARIABLE_KEY_PATTERN.test(trimmedKey)) {
      setKeyError('Invalid variable key. Use #nnn, #<name>, or name.');
      return;
    }

    const parsed = parseFloat(newValue);
    if (isNaN(parsed)) return;

    setKeyError('');
    handleSaveOverride(trimmedKey, parsed);
    setNewKey('');
    setNewValue('');
  }, [newKey, newValue, handleSaveOverride]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        handleAdd();
      }
    },
    [handleAdd]
  );

  const handleClearAll = useCallback(() => {
    onOverridesChange({});
    postOverrides({});
  }, [onOverridesChange, postOverrides]);

  const totalCount = useMemo(
    () =>
      new Set([
        ...entries.map((e) => e.key),
        ...settingsEntries.map((e) => e.key),
        ...referencedVariables.map((v) => v.key),
      ]).size,
    [entries, settingsEntries, referencedVariables]
  );

  return (
    <div className={`variable-panel ${isOpen ? 'open' : ''}`}>
      <button className="variable-panel-toggle" type="button" onClick={onToggle}>
        <span className="toggle-icon">{isOpen ? '\u25BC' : '\u25B6'}</span>
        <span>Variables</span>
        {totalCount > 0 && <span className="variable-count">{totalCount}</span>}
      </button>

      {isOpen && (
        <div className="variable-panel-content">
          {entries.length > 0 && (
            <>
              <div className="variable-list">
                {entries.map((entry) => (
                  <EditableVariableRow
                    key={entry.key}
                    variableKey={entry.key}
                    value={entry.value}
                    hasOverride={true}
                    onSave={handleSaveOverride}
                    onRemove={handleRemoveOverride}
                  />
                ))}
              </div>
              <button className="variable-clear-all" type="button" onClick={handleClearAll}>
                Clear All
              </button>
            </>
          )}

          <div className="variable-add-row">
            <input
              type="text"
              className={`variable-key-input${keyError ? ' variable-key-invalid' : ''}`}
              placeholder="#100 or #<name>"
              value={newKey}
              onChange={(event) => {
                setNewKey(event.target.value);
                if (keyError) setKeyError('');
              }}
              onKeyDown={handleKeyDown}
            />
            <input
              type="number"
              className="variable-value-input"
              placeholder="Value"
              step="any"
              value={newValue}
              onChange={(event) => setNewValue(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="variable-add" type="button" title="Add variable" onClick={handleAdd}>
              +
            </button>
          </div>

          {keyError && <div className="variable-key-error">{keyError}</div>}

          {settingsEntries.length > 0 && (
            <div className="variable-referenced-section">
              <button
                className="variable-section-toggle"
                type="button"
                onClick={() => setSettingsOpen((prev) => !prev)}
              >
                <span className="toggle-icon">{settingsOpen ? '\u25BC' : '\u25B6'}</span>
                <span>From settings</span>
                <span className="variable-count">{settingsEntries.length}</span>
              </button>
              {settingsOpen && (
                <div className="variable-list">
                  {settingsEntries.map((entry) => (
                    <EditableVariableRow
                      key={entry.key}
                      variableKey={entry.key}
                      value={entry.value}
                      hasOverride={entry.key in overrides}
                      onSave={handleSaveOverride}
                      onRemove={entry.key in overrides ? handleRemoveOverride : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {referencedVariables.length > 0 && (
            <div className="variable-referenced-section">
              <button
                className="variable-section-toggle"
                type="button"
                onClick={() => setReferencedOpen((prev) => !prev)}
              >
                <span className="toggle-icon">{referencedOpen ? '\u25BC' : '\u25B6'}</span>
                <span>Referenced in program</span>
                <span className="variable-count">{referencedVariables.length}</span>
              </button>
              {referencedOpen && (
                <div className="variable-list">
                  {referencedVariables.map((variable) => (
                    <EditableVariableRow
                      key={variable.key}
                      variableKey={variable.key}
                      value={variable.value}
                      hasOverride={variable.key in overrides}
                      onSave={handleSaveOverride}
                      onRemove={variable.key in overrides ? handleRemoveOverride : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
