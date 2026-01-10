import * as assert from 'assert';
import * as vscode from 'vscode';

import { TestUtils } from '../testUtils';

suite('Document Highlight Tests', () => {
  TestUtils.setup();

  test('Should highlight all occurrences of variable', async function () {
    const document = await TestUtils.createGCodeDocument(
      '#<counter>=0\nG1 X[#<counter>]\n#<counter>=[#<counter>+1]'
    );
    await vscode.window.showTextDocument(document);

    // Position at variable name
    const position = new vscode.Position(0, 2),
      highlights = await vscode.commands.executeCommand<vscode.DocumentHighlight[] | undefined>(
        'vscode.executeDocumentHighlights',
        document.uri,
        position
      );

    assert.ok(highlights, 'Should return highlights');
    assert.ok(highlights.length > 1, 'Should highlight multiple occurrences');

    // Verify all highlights are for the same variable
    const text = document.getText();
    highlights.forEach((highlight) => {
      const highlightedText = text.substring(
        document.offsetAt(highlight.range.start),
        document.offsetAt(highlight.range.end)
      );
      assert.ok(highlightedText.includes('#<counter>'), 'Should highlight variable name');
    });
  });

  test('Should highlight variable in expressions', async function () {
    const document = await TestUtils.createGCodeDocument('#<var>=10\nG1 X[#<var>] Y[#<var>*2]');
    await vscode.window.showTextDocument(document);

    const position = new vscode.Position(0, 2),
      highlights = await vscode.commands.executeCommand<vscode.DocumentHighlight[] | undefined>(
        'vscode.executeDocumentHighlights',
        document.uri,
        position
      );

    assert.ok(highlights, 'Should return highlights');
    assert.ok(highlights.length >= 2, 'Should highlight variable in multiple expressions');
  });

  test('Should not highlight at non-variable position', async function () {
    const document = await TestUtils.createGCodeDocument('G01 X10 Y20');
    await vscode.window.showTextDocument(document);

    // Wait for language server to process
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const position = new vscode.Position(0, 3), // Position at '1' in 'G01'
      highlights = await vscode.commands.executeCommand<
        vscode.DocumentHighlight[] | undefined | null
      >('vscode.executeDocumentHighlights', document.uri, position);

    // Should return undefined, null, or empty array for non-variable positions
    // If it returns an array, verify it doesn't highlight variable-related content
    if (Array.isArray(highlights) && highlights.length > 0) {
      // Check that highlights don't contain variable syntax
      const text = document.getText(),
        hasVariableHighlight = highlights.some((highlight) => {
          const highlightedText = text.substring(
            document.offsetAt(highlight.range.start),
            document.offsetAt(highlight.range.end)
          );
          return highlightedText.includes('#') || highlightedText.includes('<');
        });

      assert.ok(
        !hasVariableHighlight,
        'Should not highlight variable syntax at non-variable position'
      );
    } else {
      // Should return null, undefined, or empty array
      assert.ok(
        highlights === null ||
          highlights === undefined ||
          (Array.isArray(highlights) && highlights.length === 0),
        'Should not highlight at non-variable position'
      );
    }
  });

  test('Should highlight different variable types', async function () {
    const document = await TestUtils.createGCodeDocument('#1=10\n#<var>=20\nG1 X[#1] Y[#<var>]');
    await vscode.window.showTextDocument(document);

    // Test highlighting #1
    const position1 = new vscode.Position(0, 1),
      highlights1 = await vscode.commands.executeCommand<vscode.DocumentHighlight[] | undefined>(
        'vscode.executeDocumentHighlights',
        document.uri,
        position1
      );

    assert.ok(highlights1 && highlights1.length >= 2, 'Should highlight #1 variable');

    // Test highlighting #<var>
    const position2 = new vscode.Position(1, 2),
      highlights2 = await vscode.commands.executeCommand<vscode.DocumentHighlight[] | undefined>(
        'vscode.executeDocumentHighlights',
        document.uri,
        position2
      );

    assert.ok(highlights2 && highlights2.length >= 2, 'Should highlight #<var> variable');
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });
});
