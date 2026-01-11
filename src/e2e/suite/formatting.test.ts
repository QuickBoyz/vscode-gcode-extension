import * as assert from 'assert';
import * as vscode from 'vscode';

import { TestUtils } from '../testUtils';

suite('Document Formatting Tests', () => {
  TestUtils.setup();

  test('Should format a simple G-code document', async () => {
    const document = await TestUtils.createGCodeDocument('G1X10Y20F100'),
      edits = await vscode.commands.executeCommand<vscode.TextEdit[] | undefined>(
        'vscode.executeFormatDocumentProvider',
        document.uri,
        {
          insertSpaces: true,
          tabSize: 2,
        }
      );

    assert.ok(edits, 'Formatting should return edits');
    assert.ok(edits.length > 0, 'Should have at least one edit');

    // Apply the edits
    const edit = new vscode.WorkspaceEdit();
    edits.forEach((e) => edit.replace(document.uri, e.range, e.newText));
    await vscode.workspace.applyEdit(edit);

    const formattedText = document.getText();
    assert.ok(formattedText.includes('G01'), 'Should format G1 to G01');
    assert.ok(formattedText.includes('X10.0'), 'Should format X10 to X10.0');
  });

  test('Should respect prettyPrintCommands setting', async () => {
    await TestUtils.updateConfiguration('formatter.prettyPrintCommands', true);

    const document = await TestUtils.createGCodeDocument('G1 X10 M3'),
      edits = await vscode.commands.executeCommand<vscode.TextEdit[] | undefined>(
        'vscode.executeFormatDocumentProvider',
        document.uri
      );

    assert.ok(edits, 'Formatting should return edits');
    const edit = new vscode.WorkspaceEdit();
    edits.forEach((e) => edit.replace(document.uri, e.range, e.newText));
    await vscode.workspace.applyEdit(edit);

    const formattedText = document.getText();
    assert.ok(formattedText.includes('G01'), 'Should format G1 to G01 when enabled');
    assert.ok(formattedText.includes('M03'), 'Should format M3 to M03 when enabled');
  });

  test('Should respect prettyPrintNumbers setting', async () => {
    await TestUtils.updateConfiguration('formatter.prettyPrintNumbers', true);

    const document = await TestUtils.createGCodeDocument('G1 X10 Y20'),
      edits = await vscode.commands.executeCommand<vscode.TextEdit[] | undefined>(
        'vscode.executeFormatDocumentProvider',
        document.uri
      );

    assert.ok(edits, 'Formatting should return edits');
    const edit = new vscode.WorkspaceEdit();
    edits.forEach((e) => edit.replace(document.uri, e.range, e.newText));
    await vscode.workspace.applyEdit(edit);

    const formattedText = document.getText();
    assert.ok(formattedText.includes('X10.0'), 'Should format X10 to X10.0 when enabled');
    assert.ok(formattedText.includes('Y20.0'), 'Should format Y20 to Y20.0 when enabled');
  });

  test('Should respect indent setting', async () => {
    await TestUtils.updateConfiguration('formatter.indent', true);

    const document = await TestUtils.createGCodeDocument('WHILE [#1 LT 100] DO\nG1 X10\nEND'),
      edits = await vscode.commands.executeCommand<vscode.TextEdit[] | undefined>(
        'vscode.executeFormatDocumentProvider',
        document.uri
      );

    assert.ok(edits, 'Formatting should return edits');
    const edit = new vscode.WorkspaceEdit();
    edits.forEach((e) => edit.replace(document.uri, e.range, e.newText));
    await vscode.workspace.applyEdit(edit);

    const formattedText = document.getText(),
      lines = formattedText.split('\n'),
      g1Line = lines.find((l) => l.includes('G1') || l.includes('G01'));
    assert.ok(g1Line, 'Should find G1 line');
    assert.ok(g1Line.startsWith('  ') || g1Line.startsWith('\t'), 'G1 line should be indented');
  });

  test('Should handle empty documents', async () => {
    const document = await TestUtils.createGCodeDocument(''),
      edits = await vscode.commands.executeCommand<vscode.TextEdit[] | undefined>(
        'vscode.executeFormatDocumentProvider',
        document.uri
      );

    // Empty documents might return undefined or empty array
    assert.ok(
      edits === undefined || Array.isArray(edits),
      'Should handle empty document gracefully'
    );
  });

  test.skip('Format command should work', async () => {
    const document = await TestUtils.createGCodeDocument('G1X10Y20');
    await vscode.window.showTextDocument(document);

    // Execute the format command
    await vscode.commands.executeCommand('gcode.formatDocument');

    const formattedText = document.getText();
    assert.ok(formattedText.length > 0, 'Document should be formatted');
  });

  suite('Range Formatting Tests', () => {
    test('Should format selected range', async () => {
      const document = await TestUtils.createGCodeDocument('G0 X0\nG1X10Y20\nM30');
      await vscode.window.showTextDocument(document);

      const range = new vscode.Range(new vscode.Position(1, 0), new vscode.Position(1, 10)),
        edits = await vscode.commands.executeCommand<vscode.TextEdit[] | undefined>(
          'vscode.executeFormatRangeProvider',
          document.uri,
          range
        );

      assert.ok(edits, 'Range formatting should return edits');
      assert.ok(edits.length > 0, 'Should have at least one edit');
    });
  });

  suiteTeardown(async () => {
    await TestUtils.resetConfiguration();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });
});
