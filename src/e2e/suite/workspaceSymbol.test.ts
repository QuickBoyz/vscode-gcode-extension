import * as assert from 'assert';
import * as vscode from 'vscode';

import { TestUtils } from '../testUtils';

suite('Workspace Symbol Tests', () => {
  TestUtils.setup();

  test('Should find subroutine definitions via workspace symbols', async () => {
    await TestUtils.createGCodeDocument('O100 SUB\nG0 X10\nO100 ENDSUB', 'ws-symbol-sub.nc');

    // Poll until the language server has indexed the document
    const symbols = await TestUtils.waitForCondition(
      async () =>
        vscode.commands.executeCommand<vscode.SymbolInformation[]>(
          'vscode.executeWorkspaceSymbolProvider',
          'O100'
        ),
      (result) => Array.isArray(result) && result.some((s) => s.name === 'O100')
    );

    assert.ok(Array.isArray(symbols), 'Should return array of symbols');
    const matching = symbols.filter((s) => s.name === 'O100');
    assert.ok(matching.length > 0, 'Should find O100 subroutine definition');
  });

  test('Should find variables via workspace symbols', async () => {
    await TestUtils.createGCodeDocument('#<feed> = 100\n#<speed> = 500', 'ws-symbol-var.nc');

    // Poll until the language server has indexed the document
    const symbols = await TestUtils.waitForCondition(
      async () =>
        vscode.commands.executeCommand<vscode.SymbolInformation[]>(
          'vscode.executeWorkspaceSymbolProvider',
          'feed'
        ),
      (result) => Array.isArray(result) && result.some((s) => s.name.includes('feed'))
    );

    assert.ok(Array.isArray(symbols), 'Should return array of symbols');
    const matching = symbols.filter((s) => s.name.includes('feed'));
    assert.ok(matching.length > 0, 'Should find feed variable');
  });

  test('Should return empty array for non-matching query', async () => {
    const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
      'vscode.executeWorkspaceSymbolProvider',
      'NONEXISTENT_SYMBOL_12345'
    );

    assert.ok(
      Array.isArray(symbols) || symbols === undefined,
      'Should return array or undefined for non-matching query'
    );
    if (Array.isArray(symbols)) {
      const matching = symbols.filter((s) => s.name.includes('NONEXISTENT_SYMBOL_12345'));
      assert.strictEqual(matching.length, 0, 'Should find no matching symbols');
    }
  });

  test('Should find symbols with partial match', async () => {
    await TestUtils.createGCodeDocument('O500 SUB\nG0 X10\nO500 ENDSUB', 'ws-symbol-partial.nc');

    // Poll until the language server has indexed the document
    const symbols = await TestUtils.waitForCondition(
      async () =>
        vscode.commands.executeCommand<vscode.SymbolInformation[]>(
          'vscode.executeWorkspaceSymbolProvider',
          'O5'
        ),
      (result) => Array.isArray(result) && result.some((s) => s.name.includes('O5'))
    );

    assert.ok(Array.isArray(symbols), 'Should return array of symbols');
    const matching = symbols.filter((s) => s.name.includes('O5'));
    assert.ok(matching.length > 0, 'Should find symbols matching partial query O5');
  });

  suiteTeardown(async () => {
    TestUtils.deleteTestFileByName('ws-symbol-sub.nc');
    TestUtils.deleteTestFileByName('ws-symbol-var.nc');
    TestUtils.deleteTestFileByName('ws-symbol-partial.nc');
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });
});
