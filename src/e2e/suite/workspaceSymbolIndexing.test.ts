/**
 * E2E tests for the workspace-wide symbol indexing pipeline.
 *
 * These tests verify that the language server discovers and tracks G-code
 * files on disk without the user opening them — exercising
 * `WorkspaceIndexingService` end-to-end via the real LSP file watcher
 * registered through `workspace/didChangeWatchedFiles`.
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { TestUtils } from '../testUtils';

const FIXTURE_PREFIX = 'ws-fs-watch-';

function fixtureName(suffix: string): string {
  return `${FIXTURE_PREFIX}${suffix}`;
}

async function findSymbolsByName(
  query: string,
  predicate: (symbol: vscode.SymbolInformation) => boolean
): Promise<vscode.SymbolInformation[]> {
  const symbols = await TestUtils.waitForCondition(
    async () =>
      vscode.commands.executeCommand<vscode.SymbolInformation[]>(
        'vscode.executeWorkspaceSymbolProvider',
        query
      ),
    (result) => Array.isArray(result) && result.some(predicate)
  );
  return symbols.filter(predicate);
}

async function waitForAbsence(
  query: string,
  predicate: (symbol: vscode.SymbolInformation) => boolean,
  timeout = 10000
): Promise<void> {
  await TestUtils.waitForCondition(
    async () =>
      vscode.commands.executeCommand<vscode.SymbolInformation[]>(
        'vscode.executeWorkspaceSymbolProvider',
        query
      ),
    (result) => Array.isArray(result) && !result.some(predicate),
    timeout
  );
}

suite('Workspace Symbol Indexing (file watcher)', () => {
  TestUtils.setup();

  test('Indexes a file written to disk without opening an editor', async () => {
    const filename = fixtureName('created.nc');
    const workspacePath = TestUtils.getWorkspaceFolderPath();
    const filePath = path.join(workspacePath, filename);
    fs.writeFileSync(filePath, 'O701 SUB\nG0 X10\nO701 ENDSUB\n', 'utf8');

    try {
      const matches = await findSymbolsByName('O701', (s) => s.name === 'O701');
      assert.ok(matches.length > 0, 'Should index O701 from a file that was never opened');
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  test('Re-indexes a file when it changes on disk', async () => {
    const filename = fixtureName('changed.nc');
    const workspacePath = TestUtils.getWorkspaceFolderPath();
    const filePath = path.join(workspacePath, filename);
    fs.writeFileSync(filePath, 'O702 SUB\nO702 ENDSUB\n', 'utf8');

    try {
      await findSymbolsByName('O702', (s) => s.name === 'O702');

      fs.writeFileSync(filePath, 'O702 SUB\nO702 ENDSUB\nO703 SUB\nO703 ENDSUB\n', 'utf8');

      const matches = await findSymbolsByName('O703', (s) => s.name === 'O703');
      assert.ok(matches.length > 0, 'Should pick up symbols added by external edit');
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  test('Removes symbols when a file is deleted via vscode.workspace.fs', async () => {
    const filename = fixtureName('deleted.nc');
    const workspacePath = TestUtils.getWorkspaceFolderPath();
    const filePath = path.join(workspacePath, filename);
    const fileUri = vscode.Uri.file(filePath);
    fs.writeFileSync(filePath, 'O704 SUB\nO704 ENDSUB\n', 'utf8');

    try {
      await findSymbolsByName('O704', (s) => s.name === 'O704');

      await vscode.workspace.fs.delete(fileUri);

      await waitForAbsence('O704', (s) => s.name === 'O704');
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  test('Updates the index when a file is renamed', async () => {
    const oldName = fixtureName('rename-old.nc');
    const newName = fixtureName('rename-new.nc');
    const workspacePath = TestUtils.getWorkspaceFolderPath();
    const oldPath = path.join(workspacePath, oldName);
    const newPath = path.join(workspacePath, newName);
    fs.writeFileSync(oldPath, 'O705 SUB\nO705 ENDSUB\n', 'utf8');

    try {
      const initial = await findSymbolsByName('O705', (s) => s.name === 'O705');
      const oldUri = initial[0].location.uri.toString();

      await vscode.workspace.fs.rename(vscode.Uri.file(oldPath), vscode.Uri.file(newPath));

      const after = await TestUtils.waitForCondition(
        async () =>
          vscode.commands.executeCommand<vscode.SymbolInformation[]>(
            'vscode.executeWorkspaceSymbolProvider',
            'O705'
          ),
        (result) =>
          Array.isArray(result) &&
          result.some((s) => s.name === 'O705' && s.location.uri.toString() !== oldUri)
      );

      const newUriHits = after.filter(
        (s) => s.name === 'O705' && s.location.uri.fsPath === newPath
      );
      assert.ok(newUriHits.length > 0, 'Renamed file should be indexed under its new URI');
    } finally {
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
    }
  });

  suiteTeardown(() => {
    const workspacePath = TestUtils.getWorkspaceFolderPath();
    for (const entry of fs.readdirSync(workspacePath)) {
      if (entry.startsWith(FIXTURE_PREFIX)) {
        try {
          fs.unlinkSync(path.join(workspacePath, entry));
        } catch {
          // best-effort cleanup
        }
      }
    }
  });
});
