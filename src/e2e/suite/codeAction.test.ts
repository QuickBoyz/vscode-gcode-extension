/**
 * Code Action Provider E2E Tests
 *
 * Integration tests for quick-fix code actions in VS Code Extension Development Host.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

import { TestUtils } from '../testUtils';

suite('Code Action E2E Tests', () => {
  TestUtils.setup();

  test('Should provide "Insert ENDIF" code action for missing ENDIF', async () => {
    await TestUtils.withTestDocument(
      'IF [#1 EQ 1] THEN\nG0 X10',
      async (document) => {
        const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(1, 6));
        const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
          'vscode.executeCodeActionProvider',
          document.uri,
          range
        );

        assert.ok(codeActions && codeActions.length > 0, 'Expected code actions');
        const endifAction = codeActions.find((a) => a.title === 'Insert ENDIF');
        assert.ok(endifAction, 'Expected "Insert ENDIF" code action');
        assert.strictEqual(endifAction.kind?.value, vscode.CodeActionKind.QuickFix.value);
      },
      'codeaction-endif.nc'
    );
  });

  test('Should provide "Insert ENDWHILE" code action for missing ENDWHILE', async () => {
    await TestUtils.withTestDocument(
      'WHILE [#1 LT 10] DO\nG0 X10',
      async (document) => {
        const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(1, 6));
        const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
          'vscode.executeCodeActionProvider',
          document.uri,
          range
        );

        assert.ok(codeActions && codeActions.length > 0, 'Expected code actions');
        const endwhileAction = codeActions.find((a) => a.title === 'Insert ENDWHILE');
        assert.ok(endwhileAction, 'Expected "Insert ENDWHILE" code action');
      },
      'codeaction-endwhile.nc'
    );
  });

  test('Should provide "Insert F100" code action for missing feed rate', async () => {
    await TestUtils.withTestDocument(
      'G01 X10',
      async (document) => {
        const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 7));
        const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
          'vscode.executeCodeActionProvider',
          document.uri,
          range
        );

        assert.ok(codeActions && codeActions.length > 0, 'Expected code actions');
        const feedAction = codeActions.find((a) => a.title === 'Insert F100');
        assert.ok(feedAction, 'Expected "Insert F100" code action');
      },
      'codeaction-feedrate.nc'
    );
  });

  test('Should apply ENDIF code action and insert ENDIF keyword', async () => {
    await TestUtils.withTestDocument(
      'IF [#1 EQ 1] THEN\nG0 X10',
      async (document) => {
        const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(1, 6));
        const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
          'vscode.executeCodeActionProvider',
          document.uri,
          range
        );

        assert.ok(codeActions && codeActions.length > 0, 'Expected code actions');
        const endifAction = codeActions.find((a) => a.title === 'Insert ENDIF');
        assert.ok(endifAction, 'Expected "Insert ENDIF" code action');
        assert.ok(endifAction.edit, 'Expected edit on code action');

        await vscode.workspace.applyEdit(endifAction.edit);
        const newText = document.getText();
        assert.ok(newText.includes('ENDIF'), 'Document should contain ENDIF after applying action');
      },
      'codeaction-apply-endif.nc'
    );
  });

  test('Should not provide code actions when there are no errors', async () => {
    await TestUtils.withTestDocument(
      'G0 X10 Y20',
      async (document) => {
        const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 10));
        const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
          'vscode.executeCodeActionProvider',
          document.uri,
          range
        );

        // Either no actions or empty array
        const quickFixes = (codeActions ?? []).filter(
          (a) => a.kind?.value === vscode.CodeActionKind.QuickFix.value
        );
        assert.strictEqual(quickFixes.length, 0, 'Expected no quick-fix code actions');
      },
      'codeaction-noerrors.nc'
    );
  });
});
