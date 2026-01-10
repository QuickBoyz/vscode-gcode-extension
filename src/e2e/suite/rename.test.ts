import * as assert from "assert";
import * as vscode from "vscode";
import { TestUtils } from "../testUtils";

suite("Rename Provider Tests", () => {
  TestUtils.setup();

  test("Should prepare rename for variable", async function () {
    const document = await TestUtils.createGCodeDocument(
      "#<counter>=0\nG1 X[#<counter>]\n#<counter>=[#<counter>+1]"
    );
    await vscode.window.showTextDocument(document);

    // Wait for language server to process the document
    await TestUtils.waitForLanguageServer();
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Position at the variable name - position 5 is in the middle of "#<counter>"
    const position = new vscode.Position(0, 5);

    const prepareResult = await vscode.commands.executeCommand<
      | { range: vscode.Range; placeholder: string }
      | vscode.Range
      | null
      | undefined
    >("vscode.prepareRename", document.uri, position);

    assert.ok(prepareResult, "Prepare rename should return result");
    // Handle both Range and { range: Range; placeholder: string } formats
    const range =
      prepareResult instanceof vscode.Range
        ? prepareResult
        : (
            prepareResult as {
              range: vscode.Range;
              placeholder: string;
            }
          )?.range;
    assert.ok(range, "Should return range for variable");
  });

  test("Should rename variable and update all occurrences", async function () {
    const document = await TestUtils.createGCodeDocument(
      "#<counter>=0\nG1 X[#<counter>]\n#<counter>=[#<counter>+1]"
    );
    await vscode.window.showTextDocument(document);

    // Wait for language server to process the document
    await TestUtils.waitForLanguageServer();
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Position at the variable name - position 5 is in the middle of "#<counter>"
    const position = new vscode.Position(0, 5);
    // New name should be just the variable name part, not the full format
    const newName = "newName";

    // Execute rename
    const workspaceEdit = await vscode.commands.executeCommand<
      vscode.WorkspaceEdit | undefined
    >(
      "vscode.executeDocumentRenameProvider",
      document.uri,
      position,
      newName
    );

    assert.ok(workspaceEdit, "Rename should return workspace edit");
    assert.ok(
      workspaceEdit!.has(document.uri),
      "Should have edits for the document"
    );

    const edits = workspaceEdit!.get(document.uri);
    assert.ok(
      edits && edits.length > 1,
      "Should have multiple edits for all occurrences"
    );

    // Apply the edits
    await vscode.workspace.applyEdit(workspaceEdit!);

    // Verify all occurrences were renamed
    const text = document.getText();
    const occurrences = (text.match(/#<newName>/g) || []).length;
    assert.ok(occurrences === 4, "Should have renamed occurrences");
  });

  test("Should reject rename at invalid position", async function () {
    const document = await TestUtils.createGCodeDocument("G01 X10 Y20");
    await vscode.window.showTextDocument(document);

    // Wait for language server to process the document
    await TestUtils.waitForLanguageServer();
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Position at non-variable location
    const position = new vscode.Position(0, 3); // Position at '1' in 'G01'

    try {
      const prepareResult = await vscode.commands.executeCommand<
        | { range: vscode.Range; placeholder: string }
        | vscode.Range
        | null
      >("vscode.prepareRename", document.uri, position);

      // Should return null for invalid position
      assert.strictEqual(
        prepareResult,
        null,
        "Should reject rename at invalid position"
      );
    } catch (error: any) {
      // VS Code may throw an error instead of returning null
      assert.ok(
        error &&
          (error.message.includes("can't be renamed") ||
            error.message.includes("No result")),
        `Should reject rename at invalid position. Error: ${error?.message}`
      );
    }
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand(
      "workbench.action.closeAllEditors"
    );
  });
});
