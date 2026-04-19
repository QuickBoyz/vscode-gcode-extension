/**
 * E2E tests for per-folder dialect and indexing in a two-folder multi-root workspace.
 *
 * Runs against `src/e2e/fixtures-multiroot/multiroot.code-workspace` which
 * opens two folders:
 *
 *   folder-a  —  gcode.dialect = "fanuc"    — sub-fanuc.nc  contains O1001
 *   folder-b  —  gcode.dialect = "linuxcnc" — sub-linuxcnc.nc contains O2001 SUB/ENDSUB
 *
 * Verifies that the workspace indexing service reads per-folder dialect from
 * each folder's `.vscode/settings.json` and successfully indexes symbols from
 * both roots (#141).
 */
import * as assert from 'assert';
import * as vscode from 'vscode';

import { TestUtils } from '../testUtils';

async function findSymbol(
  query: string,
  predicate: (s: vscode.SymbolInformation) => boolean,
  timeout = 15000
): Promise<vscode.SymbolInformation[]> {
  return TestUtils.waitForCondition(
    () =>
      Promise.resolve(
        vscode.commands.executeCommand<vscode.SymbolInformation[]>(
          'vscode.executeWorkspaceSymbolProvider',
          query
        )
      ),
    (result) => Array.isArray(result) && result.some(predicate),
    timeout
  );
}

suite('Multi-root workspace: per-folder dialect indexing', () => {
  TestUtils.setup(30000);

  test('indexes symbols from folder-a (fanuc dialect)', async () => {
    const matches = await findSymbol('O1001', (s) => s.name === 'O1001');
    assert.ok(matches.length > 0, 'O1001 from folder-a (fanuc) should be indexed');
  });

  test('indexes symbols from folder-b (linuxcnc dialect)', async () => {
    const matches = await findSymbol('O2001', (s) => s.name === 'O2001');
    assert.ok(matches.length > 0, 'O2001 from folder-b (linuxcnc) should be indexed');
  });

  test('symbols from folder-a resolve to the folder-a path', async () => {
    const matches = await findSymbol('O1001', (s) => s.name === 'O1001');
    const folderASymbol = matches.find((s) => s.name === 'O1001');
    assert.ok(folderASymbol, 'O1001 should be found');
    assert.ok(
      folderASymbol.location.uri.fsPath.includes('folder-a'),
      `Expected symbol URI to be under folder-a, got: ${folderASymbol.location.uri.fsPath}`
    );
  });

  test('symbols from folder-b resolve to the folder-b path', async () => {
    const matches = await findSymbol('O2001', (s) => s.name === 'O2001');
    const folderBSymbol = matches.find((s) => s.name === 'O2001');
    assert.ok(folderBSymbol, 'O2001 should be found');
    assert.ok(
      folderBSymbol.location.uri.fsPath.includes('folder-b'),
      `Expected symbol URI to be under folder-b, got: ${folderBSymbol.location.uri.fsPath}`
    );
  });
});
