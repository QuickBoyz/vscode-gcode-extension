import * as vscode from "vscode";
import {
  GCodeFormattingProvider,
  GCodeRangeFormattingProvider,
} from "./formattingProvider";

const GCODE_LANGUAGE_ID = "gcode";

/**
 * This method is called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log("G-code extension is now active");

  // Register document formatting provider
  const documentFormattingProvider = new GCodeFormattingProvider();
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      GCODE_LANGUAGE_ID,
      documentFormattingProvider
    )
  );

  // Register range formatting provider
  const rangeFormattingProvider = new GCodeRangeFormattingProvider();
  context.subscriptions.push(
    vscode.languages.registerDocumentRangeFormattingEditProvider(
      GCODE_LANGUAGE_ID,
      rangeFormattingProvider
    )
  );

  // Register format document command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "gcode.formatDocument",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (
          editor &&
          editor.document.languageId === GCODE_LANGUAGE_ID
        ) {
          await vscode.commands.executeCommand(
            "editor.action.formatDocument"
          );
        } else {
          vscode.window.showWarningMessage(
            "Please open a G-code file to format"
          );
        }
      }
    )
  );
}

/**
 * This method is called when the extension is deactivated
 */
export function deactivate(): void {
  // Cleanup if needed
}
