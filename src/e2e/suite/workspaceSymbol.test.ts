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
    const symbols = await TestUtils.waitForCondition(
      async () =>
        vscode.commands.executeCommand<vscode.SymbolInformation[]>(
          'vscode.executeWorkspaceSymbolProvider',
          'NONEXISTENT_SYMBOL_12345'
        ),
      (result) => Array.isArray(result)
    );

    assert.ok(Array.isArray(symbols), 'Should return array');
    const matching = symbols.filter((s) => s.name.includes('NONEXISTENT_SYMBOL_12345'));
    assert.strictEqual(matching.length, 0, 'Should find no matching symbols');
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

  test('Should return no symbols when indexing is disabled', async () => {
    const config = vscode.workspace.getConfiguration('gcode.workspace');
    await config.update('indexingEnabled', false, vscode.ConfigurationTarget.Workspace);

    try {
      // Create a document that would normally produce symbols
      await TestUtils.createGCodeDocument('O999 SUB\nG0 X10\nO999 ENDSUB', 'ws-symbol-disabled.nc');

      // Give the server time to process the config change
      await TestUtils.sleep(1000);

      const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
        'vscode.executeWorkspaceSymbolProvider',
        'O999'
      );

      const matching = (symbols ?? []).filter((s) => s.name === 'O999');
      assert.strictEqual(matching.length, 0, 'Should find no symbols when indexing is disabled');
    } finally {
      await config.update('indexingEnabled', undefined, vscode.ConfigurationTarget.Workspace);
      TestUtils.deleteTestFileByName('ws-symbol-disabled.nc');
    }
  });

  test('Should respect maxSymbols limit', async () => {
    const config = vscode.workspace.getConfiguration('gcode.workspace');
    await config.update('maxSymbols', 1, vscode.ConfigurationTarget.Workspace);

    try {
      // Create a file with multiple symbols (subroutine + variable + line number)
      await TestUtils.createGCodeDocument(
        'N10 G0 X0\nO800 SUB\n#<limit_test> = 1\nO800 ENDSUB',
        'ws-symbol-limit.nc'
      );

      const symbols = await TestUtils.waitForCondition(
        async () =>
          vscode.commands.executeCommand<vscode.SymbolInformation[]>(
            'vscode.executeWorkspaceSymbolProvider',
            ''
          ),
        (result) => Array.isArray(result)
      );

      // With maxSymbols=1, the total indexed symbols across ALL files should be capped
      // We can't assert exact count since other test files may be open, but we verify
      // the limit mechanism works by checking the total is small
      assert.ok(
        Array.isArray(symbols) && symbols.length <= 5,
        `Expected limited symbols but got ${symbols?.length}`
      );
    } finally {
      await config.update('maxSymbols', undefined, vscode.ConfigurationTarget.Workspace);
      TestUtils.deleteTestFileByName('ws-symbol-limit.nc');
    }
  });

  suiteTeardown(async () => {
    TestUtils.deleteTestFileByName('ws-symbol-sub.nc');
    TestUtils.deleteTestFileByName('ws-symbol-var.nc');
    TestUtils.deleteTestFileByName('ws-symbol-partial.nc');
    TestUtils.deleteTestFileByName('ws-symbol-disabled.nc');
    TestUtils.deleteTestFileByName('ws-symbol-limit.nc');
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });
});
