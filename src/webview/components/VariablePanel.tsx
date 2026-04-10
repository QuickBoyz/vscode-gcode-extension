import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /^(#?\d+|#?<[a-zA-Z_][a-zA-Z0-9_]*>|[a-zA-Z_][a-zA-Z0-9_]*)$/;

/**
 * Collapsible panel for viewing and overriding G-code variables.
 *
 * Users can add new variables, edit values, and remove overrides.
 * Changes are debounced and sent to the extension host via postMessage,
 * which triggers a tool-path re-extraction.
 */
export function VariablePanel({
  isOpen,
  onToggle,
  overrides,
  onOverridesChange,
  referencedVariables,
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

  const postOverrides = useCallback((updated: Readonly<Record<string, number>>) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      vscode.postMessage({ type: 'variableOverrides', overrides: updated });
      debounceRef.current = null;
    }, OVERRIDE_DEBOUNCE_MS);
  }, []);

  const handleValueChange = useCallback(
    (key: string, valueText: string) => {
      const parsed = parseFloat(valueText);
      if (isNaN(parsed)) return;

      const updated = { ...overrides, [key]: parsed };
      onOverridesChange(updated);
      postOverrides(updated);
    },
    [overrides, onOverridesChange, postOverrides]
  );

  const handleRemove = useCallback(
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
    const updated = { ...overrides, [trimmedKey]: parsed };
    onOverridesChange(updated);
    postOverrides(updated);
    setNewKey('');
    setNewValue('');
  }, [newKey, newValue, overrides, onOverridesChange, postOverrides]);

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

  const handleOverrideFromReferenced = useCallback(
    (key: string, value: number | null) => {
      const updated = { ...overrides, [key]: value ?? 0 };
      onOverridesChange(updated);
      postOverrides(updated);
    },
    [overrides, onOverridesChange, postOverrides]
  );

  return (
    <div className={`variable-panel ${isOpen ? 'open' : ''}`}>
      <button className="variable-panel-toggle" type="button" onClick={onToggle}>
        <span className="toggle-icon">{isOpen ? '\u25BC' : '\u25B6'}</span>
        <span>Variables</span>
        {(entries.length > 0 || referencedVariables.length > 0) && (
          <span className="variable-count">
            {new Set([...entries.map(e => e.key), ...referencedVariables.map(v => v.key)]).size}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="variable-panel-content">
          {entries.length === 0 && (
            <div className="variable-empty">No variable overrides defined.</div>
          )}

          {entries.length > 0 && (
            <div className="variable-list">
              {entries.map((entry) => (
                <div key={entry.key} className="variable-row">
                  <span className="variable-key" title={entry.key}>
                    {entry.key}
                  </span>
                  <input
                    type="number"
                    className="variable-value-input"
                    value={entry.value}
                    step="any"
                    onChange={(event) => handleValueChange(entry.key, event.target.value)}
                  />
                  <button
                    className="variable-remove"
                    type="button"
                    title="Remove override"
                    onClick={() => handleRemove(entry.key)}
                  >
                    {'\u2715'}
                  </button>
                </div>
              ))}
            </div>
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

          {entries.length > 0 && (
            <button className="variable-clear-all" type="button" onClick={handleClearAll}>
              Clear All
            </button>
          )}

          {referencedVariables.length > 0 && (
            <div className="variable-referenced-section">
              <div className="variable-referenced-header">Referenced in program</div>
              <div className="variable-list">
                {referencedVariables.map((variable) => (
                  <div key={variable.key} className="variable-row variable-referenced-row">
                    <span className="variable-key" title={variable.key}>
                      {variable.key}
                    </span>
                    <span className="variable-referenced-value">
                      {variable.value !== null ? variable.value : 'unset'}
                    </span>
                    {!(variable.key in overrides) && (
                      <button
                        className="variable-override-btn"
                        type="button"
                        title="Override this variable"
                        onClick={() => handleOverrideFromReferenced(variable.key, variable.value)}
                      >
                        {'\u270E'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
