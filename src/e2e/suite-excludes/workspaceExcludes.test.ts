/**
 * E2E tests for workspace symbol indexing with `files.exclude` and
 * `search.exclude` honored via the client-side enumeration introduced in #138.
 *
 * Runs in its own labelled `@vscode/test-cli` launch ('workspace-excludes')
 * against `src/e2e/fixtures-workspace-excludes/`, whose `.vscode/settings.json`
 * declares the relevant excludes at the workspace root. Tests assert that
 * symbols from `src/` files are indexed and symbols from excluded `build/` and
 * `cache/` directories are not.
 *
 * Scope: 4 scenarios. Architecture §8 Q4 chose eventual-consistency over
 * per-event watcher filtering, so the originally-listed "watcher event for
 * excluded path is ignored" case is intentionally omitted — that footgun is
 * documented in README and the workspace-symbol architecture solution doc.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { TestUtils } from '../testUtils';

const ACTIVATION_FILE = 'src/main.nc';

const INCLUDED_SYMBOLS = ['O1001', 'O1002'] as const;
const EXCLUDED_SYMBOLS = ['O9001', 'O9002'] as const;

// Canonical contents of `.vscode/settings.json`. The tests mutate workspace
// settings via `config.update(ConfigurationTarget.Workspace)`, which VSCode
// persists to this file on disk — so every test run would otherwise leave a
// dirty fixture in the tree. `suiteTeardown` restores this exact content to
// keep the fixture reproducible across consecutive runs (3-pass flake check).
const CANONICAL_SETTINGS_JSON = `{
  "gcode.workspace.indexingEnabled": true,
  "files.exclude": {
    "**/build": true
  },
  "search.exclude": {
    "**/cache": true
  }
}
`;

function settingsFilePath(): string {
  return path.join(TestUtils.getWorkspaceFolderPath(), '.vscode', 'settings.json');
}

function restoreCanonicalSettings(): void {
  fs.writeFileSync(settingsFilePath(), CANONICAL_SETTINGS_JSON, 'utf8');
}

async function queryWorkspaceSymbols(query: string): Promise<vscode.SymbolInformation[]> {
  const result = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
    'vscode.executeWorkspaceSymbolProvider',
    query
  );
  return Array.isArray(result) ? result : [];
}

async function waitForSymbol(name: string, timeout = 15000): Promise<vscode.SymbolInformation[]> {
  return TestUtils.waitForCondition(
    () => queryWorkspaceSymbols(name),
    (symbols) => symbols.some((s) => s.name === name),
    timeout
  );
}

async function waitForSymbolAbsence(name: string, timeout = 15000): Promise<void> {
  await TestUtils.waitForCondition(
    () => queryWorkspaceSymbols(name),
    (symbols) => !symbols.some((s) => s.name === name),
    timeout
  );
}

function symbolNames(symbols: readonly vscode.SymbolInformation[]): string[] {
  return symbols.map((s) => s.name);
}

suite('Workspace symbol indexing — files.exclude / search.exclude', () => {
  // Custom suiteSetup: TestUtils.setup() hard-codes 'simple.nc', which doesn't
  // exist in this fixture. Mirror its behaviour against src/main.nc instead,
  // and defensively restore the canonical settings.json in case a prior run
  // left it dirty.
  suiteSetup(async function () {
    this.timeout(30000);
    restoreCanonicalSettings();
    await TestUtils.openGCodeDocument(ACTIVATION_FILE);
    await TestUtils.waitForLanguageServer(30000);
    // Wait for the cold-workspace bulk scan to populate the index with at
    // least one indexed symbol from the included src/ tree. This is the
    // positive proof that the scan completed before any absence assertion.
    await waitForSymbol(INCLUDED_SYMBOLS[0]);
    await waitForSymbol(INCLUDED_SYMBOLS[1]);
  });

  suiteTeardown(() => {
    // VSCode's ConfigurationTarget.Workspace updates are persisted to the
    // fixture's .vscode/settings.json. Restore the canonical contents so the
    // working tree is clean after the run (required for the 3-consecutive-
    // pass flake check and for git hygiene).
    restoreCanonicalSettings();
  });

  test('respects files.exclude (build/ omitted from index)', async () => {
    const matches = await queryWorkspaceSymbols(EXCLUDED_SYMBOLS[0]);
    const hits = matches.filter((s) => s.name === EXCLUDED_SYMBOLS[0]);
    assert.strictEqual(
      hits.length,
      0,
      `Expected no symbols named ${EXCLUDED_SYMBOLS[0]} from excluded build/, found: ${
        symbolNames(hits).join(', ') || '(none)'
      }`
    );
  });

  test('respects search.exclude (cache/ omitted from index)', async () => {
    const matches = await queryWorkspaceSymbols(EXCLUDED_SYMBOLS[1]);
    const hits = matches.filter((s) => s.name === EXCLUDED_SYMBOLS[1]);
    assert.strictEqual(
      hits.length,
      0,
      `Expected no symbols named ${EXCLUDED_SYMBOLS[1]} from excluded cache/, found: ${
        symbolNames(hits).join(', ') || '(none)'
      }`
    );
  });

  test('union of both excludes — included files present, excluded files absent', async () => {
    for (const included of INCLUDED_SYMBOLS) {
      const matches = await queryWorkspaceSymbols(included);
      const hits = matches.filter((s) => s.name === included);
      assert.ok(
        hits.length > 0,
        `Expected included symbol ${included} to be indexed, but no match was found`
      );
      // Sanity-check the URI lives under the src/ subtree.
      const uri = hits[0].location.uri.toString();
      assert.ok(
        uri.includes('/src/'),
        `Included symbol ${included} should resolve to a file under src/, got ${uri}`
      );
    }
    for (const excluded of EXCLUDED_SYMBOLS) {
      const matches = await queryWorkspaceSymbols(excluded);
      const hits = matches.filter((s) => s.name === excluded);
      assert.strictEqual(
        hits.length,
        0,
        `Expected excluded symbol ${excluded} to be absent, found URIs: ${hits
          .map((h) => h.location.uri.toString())
          .join(', ')}`
      );
    }
  });

  test('re-enable triggers exclude-aware rescan', async () => {
    const config = vscode.workspace.getConfiguration('gcode');

    // Disable indexing — server clears the index and cancels any in-flight scan.
    await config.update('workspace.indexingEnabled', false, vscode.ConfigurationTarget.Workspace);
    await waitForSymbolAbsence(INCLUDED_SYMBOLS[0]);

    // Re-enable indexing — server should rescan via the client enumerator,
    // honouring the same files.exclude / search.exclude as the cold scan.
    await config.update('workspace.indexingEnabled', true, vscode.ConfigurationTarget.Workspace);
    await waitForSymbol(INCLUDED_SYMBOLS[0]);
    await waitForSymbol(INCLUDED_SYMBOLS[1]);

    // Excludes must still be honoured on the rescan path.
    for (const excluded of EXCLUDED_SYMBOLS) {
      const matches = await queryWorkspaceSymbols(excluded);
      const hits = matches.filter((s) => s.name === excluded);
      assert.strictEqual(
        hits.length,
        0,
        `After re-enable rescan, ${excluded} should still be excluded, found URIs: ${hits
          .map((h) => h.location.uri.toString())
          .join(', ')}`
      );
    }
    // suiteTeardown restores .vscode/settings.json to canonical state, which
    // re-asserts `indexingEnabled: true`. No per-test cleanup needed.
  });
});
