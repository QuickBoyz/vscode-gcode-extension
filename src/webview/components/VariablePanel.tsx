import React, { useCallback, useRef, useState } from 'react';
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
}

/** Debounce delay in milliseconds for posting override changes. */
const OVERRIDE_DEBOUNCE_MS = 400;

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
}: VariablePanelProps) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const entries: VariableEntry[] = Object.entries(overrides).map(([key, value]) => ({
    key,
    value,
  }));

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
      const updated = { ...overrides };
      delete (updated as Record<string, number>)[key];
      onOverridesChange(updated);
      postOverrides(updated);
    },
    [overrides, onOverridesChange, postOverrides]
  );

  const handleAdd = useCallback(() => {
    const trimmedKey = newKey.trim();
    if (!trimmedKey) return;

    const parsed = parseFloat(newValue);
    if (isNaN(parsed)) return;

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

  return (
    <div className={`variable-panel ${isOpen ? 'open' : ''}`}>
      <button className="variable-panel-toggle" type="button" onClick={onToggle}>
        <span className="toggle-icon">{isOpen ? '\u25BC' : '\u25B6'}</span>
        <span>Variables</span>
        {entries.length > 0 && <span className="variable-count">{entries.length}</span>}
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
              className="variable-key-input"
              placeholder="#100 or #<name>"
              value={newKey}
              onChange={(event) => setNewKey(event.target.value)}
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

          {entries.length > 0 && (
            <button className="variable-clear-all" type="button" onClick={handleClearAll}>
              Clear All
            </button>
          )}
        </div>
      )}
    </div>
  );
}
