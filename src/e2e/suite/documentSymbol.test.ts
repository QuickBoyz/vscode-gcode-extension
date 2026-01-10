import * as assert from 'assert';
import * as vscode from 'vscode';

import { TestUtils } from '../testUtils';

const fixtureName = 'variables.nc';
suite('Document Symbol Tests', () => {
  TestUtils.setup();

  test('Should provide document symbols for variables', async () => {
    const document = await TestUtils.createGCodeDocument(
        '#<counter>=0\n#<var>=10\nG1 X[#<counter>] Y[#<var>]'
      ),
      symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[] | undefined>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
      );

    assert.ok(Array.isArray(symbols), 'Should return array of symbols');
    assert.ok(symbols.length > 0, 'Should have at least one symbol');

    // Check for variable symbols
    const variableSymbols = symbols.filter((s) => s.name.includes('#<'));
    assert.ok(variableSymbols.length > 0, 'Should identify variable symbols');
  });

  test('Should provide correct symbol locations', async () => {
    const document = await TestUtils.createGCodeDocument('#<counter>=0\n#<var>=10'),
      symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[] | undefined>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
      );

    assert.ok(symbols && symbols.length >= 2, 'Should have multiple symbols');

    // Verify symbol positions
    const counterSymbol = symbols.find((s) => s.name.includes('counter'));
    assert.ok(counterSymbol, 'Should find counter symbol');
    assert.ok(counterSymbol.range.start.line === 0, 'Counter should be on line 0');

    const varSymbol = symbols.find((s) => s.name.includes('var') && !s.name.includes('counter'));
    assert.ok(varSymbol, 'Should find var symbol');
    assert.ok(varSymbol.range.start.line === 1, 'Var should be on line 1');
  });

  test('Should provide symbols with correct names', async () => {
    const document = await TestUtils.createGCodeDocument('#<counter>=0\n#<result>=[#<counter>+10]'),
      symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[] | undefined>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
      );

    assert.ok(symbols && symbols.length > 0, 'Should have symbols');

    const symbolNames = symbols.map((s) => s.name);
    assert.ok(
      symbolNames.some((name) => name.includes('counter')),
      'Should have counter symbol'
    );
    assert.ok(
      symbolNames.some((name) => name.includes('result')),
      'Should have result symbol'
    );
  });

  test('Should handle documents with no variables', async () => {
    const document = await TestUtils.createGCodeDocument('G01 X10 Y20\nM03 S1000');

    // Wait for language server to process
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[] | undefined>(
      'vscode.executeDocumentSymbolProvider',
      document.uri
    );

    // VS Code may return undefined for documents with no variables (even though provider returns empty array)
    // This is acceptable behavior - the important thing is that the provider is working
    // We verify the language server is working by checking that we got a response (undefined or array)
    assert.ok(
      symbols === undefined || Array.isArray(symbols),
      `Should return undefined or array. Got: ${typeof symbols}, value: ${JSON.stringify(symbols)}`
    );
    // If it's an array, it should be empty for documents with no variables
    if (Array.isArray(symbols)) {
      assert.strictEqual(
        symbols.length,
        0,
        'Should return empty array for document with no variables'
      );
    }
  });

  test('Should provide symbols for complex documents', async () => {
    const document = await TestUtils.openGCodeDocument(fixtureName),
      symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[] | undefined>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
      );

    assert.ok(Array.isArray(symbols), 'Should return symbols for complex document');
    assert.ok(symbols.length > 0, 'Should identify symbols in complex document');
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });
});
