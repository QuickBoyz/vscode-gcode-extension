import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VariableDefinitions } from '../../config/types';
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
const VALID_VARIABLE_KEY_PATTERN = /^(#?\d+|#<[a-zA-Z_][a-zA-Z0-9_]*>|[a-zA-Z_][a-zA-Z0-9_]*)$/;

// ---------------------------------------------------------------------------
// Foldable section
// ---------------------------------------------------------------------------

interface VariableSectionProps {
  /** The section title displayed in the summary. */
  readonly title: string;
  /** The count badge value. Hidden when zero. */
  readonly count: number;
  /** Section content rendered below the summary. */
  readonly children: React.ReactNode;
}

/** Collapsible section using a native `<details>` element. */
function VariableSection({ title, count, children }: VariableSectionProps) {
  return (
    <details className="variable-section">
      <summary className="variable-section-toggle">
        <span>{title}</span>
        {count > 0 && <span className="variable-count">{count}</span>}
      </summary>
      {children}
    </details>
  );
}

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
    if (Number.isFinite(parsed)) {
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
      <li className="variable-row variable-row-editing">
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
      </li>
    );
  }

  return (
    <li
      className={`variable-row ${hasOverride ? 'variable-override-row' : 'variable-referenced-row'}`}
    >
      <span className="variable-key" title={variableKey}>
        {variableKey}
      </span>
      <span className="variable-referenced-value">{value !== null ? value : 'unset'}</span>
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
    </li>
  );
}

// ---------------------------------------------------------------------------
// Variable list
// ---------------------------------------------------------------------------

/** Common shape for entries rendered in a VariableList. */
interface VariableListEntry {
  readonly key: string;
  readonly value: number | null;
}

interface VariableListProps {
  /** The entries to render. */
  readonly entries: readonly VariableListEntry[];
  /** Current variable overrides, used to determine override status per entry. */
  readonly overrides: Readonly<Record<string, number>>;
  /** Called when the user saves an edited value. */
  readonly onSave: (key: string, value: number) => void;
  /** Called when the user removes an override. */
  readonly onRemove: (key: string) => void;
  /** When true, all entries are treated as overrides. Defaults to checking `overrides`. */
  readonly allOverrides?: boolean;
}

/** Renders a `<ul>` of editable variable rows. */
function VariableList({ entries, overrides, onSave, onRemove, allOverrides }: VariableListProps) {
  return (
    <ul className="variable-list">
      {entries.map((entry) => {
        const hasOverride = allOverrides ?? entry.key in overrides;
        return (
          <EditableVariableRow
            key={entry.key}
            variableKey={entry.key}
            value={entry.value}
            hasOverride={hasOverride}
            onSave={onSave}
            onRemove={hasOverride ? onRemove : undefined}
          />
        );
      })}
    </ul>
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
  overrides,
  onOverridesChange,
  referencedVariables,
  settingsVariables,
}: VariablePanelProps) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [keyError, setKeyError] = useState('');
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
    if (!Number.isFinite(parsed)) return;

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
    <details className="variable-panel">
      <summary className="variable-panel-toggle">
        <span>Variables</span>
        {totalCount > 0 && <span className="variable-count">{totalCount}</span>}
      </summary>

      <div className="variable-panel-content">
        <VariableSection title="Overrides" count={entries.length}>
          <div className="variable-row variable-add-row">
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
          {entries.length > 0 && (
            <>
              <VariableList
                entries={entries}
                overrides={overrides}
                onSave={handleSaveOverride}
                onRemove={handleRemoveOverride}
                allOverrides={true}
              />
              <button className="variable-clear-all" type="button" onClick={handleClearAll}>
                Clear All
              </button>
            </>
          )}
        </VariableSection>

        {settingsEntries.length > 0 && (
          <VariableSection title="From settings" count={settingsEntries.length}>
            <VariableList
              entries={settingsEntries}
              overrides={overrides}
              onSave={handleSaveOverride}
              onRemove={handleRemoveOverride}
            />
          </VariableSection>
        )}

        {referencedVariables.length > 0 && (
          <VariableSection title="Referenced in program" count={referencedVariables.length}>
            <VariableList
              entries={referencedVariables}
              overrides={overrides}
              onSave={handleSaveOverride}
              onRemove={handleRemoveOverride}
            />
          </VariableSection>
        )}
      </div>
    </details>
  );
}
