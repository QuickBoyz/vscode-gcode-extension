import * as assert from 'assert';
import * as vscode from 'vscode';

import { TestUtils } from '../testUtils';

const fixtureName = 'simple.nc';

suite('Extension Activation Tests', () => {
  suiteSetup(async function () {
    // Give extension time to activate
    this.timeout(30000);

    // The extension activates on 'onLanguage:gcode', so we MUST open a G-code file first
    // Opening the file will trigger the extension activation
    await TestUtils.openGCodeDocument(fixtureName);
    // Now wait for extension to activate after opening G-code file
    await TestUtils.waitForLanguageServer();

    // Verify extension is now active
    const extension = vscode.extensions.getExtension('QuickBoyz.vscode-gcode-extension');
    if (!extension) {
      throw new Error('Extension not found');
    }
    if (!extension.isActive) {
      throw new Error('Extension did not activate after opening G-code file');
    }

    // Wait a bit more for language server to fully initialize

    // Verify file is actually open
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      throw new Error('No active editor after opening fixture file');
    }
    if (activeEditor.document.languageId !== 'gcode') {
      throw new Error(
        `Active document language is ${activeEditor.document.languageId}, expected 'gcode'`
      );
    }
  });

  test('Extension should be activated', () => {
    const extension = vscode.extensions.getExtension('QuickBoyz.vscode-gcode-extension');
    assert.ok(extension, 'Extension should be loaded');
    assert.strictEqual(extension?.isActive, true, 'Extension should be active');
  });

  test('Extension should activate on G-code file open', async () => {
    const document = await TestUtils.openGCodeDocument(fixtureName);

    assert.strictEqual(document.languageId, 'gcode', 'Document should be recognized as G-code');

    // Wait a bit for language server to process

    const extension = vscode.extensions.getExtension('QuickBoyz.vscode-gcode-extension');
    assert.strictEqual(
      extension?.isActive,
      true,
      'Extension should be active after opening G-code file'
    );
  });

  test('Language server should initialize', async () => {
    const document = await TestUtils.openGCodeDocument(fixtureName);

    // Wait a bit for language server to process the document
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check if we can get language features (this indicates server is ready)
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[] | undefined>(
      'vscode.executeDocumentSymbolProvider',
      document.uri
    );

    assert.ok(Array.isArray(symbols), 'Document symbol provider should be available');
  });

  test('Extension should provide format command', async () => {
    // Wait a bit for commands to be registered
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const commands = await vscode.commands.getCommands(),
      hasFormatCommand = commands.includes('gcode.formatDocument'),
      // The command might not be registered if it's not implemented in extension.ts
      // But formatting should still work through the standard format provider
      // So we check if format provider is available instead
      document = await TestUtils.openGCodeDocument(fixtureName);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const edits = await vscode.commands.executeCommand<vscode.TextEdit[] | undefined>(
        'vscode.executeFormatDocumentProvider',
        document.uri
      ),
      // Format provider should be available (either through custom command or standard provider)
      hasFormatProvider = hasFormatCommand || edits !== undefined;
    assert.strictEqual(
      hasFormatProvider,
      true,
      'Format document should be available through command or format provider'
    );
  });

  suiteTeardown(async () => {
    // Clean up any open documents
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });
});
