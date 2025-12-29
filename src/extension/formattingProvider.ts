import * as vscode from "vscode";
import { GCodeParser } from "../parser";
import { GCodeFormatter } from "../formatter";
import { FormatterOptions } from "../formatter/types";

/**
 * G-code document formatting provider for VS Code
 */
export class GCodeFormattingProvider
  implements vscode.DocumentFormattingEditProvider
{
  private parser: GCodeParser;

  constructor() {
    this.parser = new GCodeParser();
  }

  /**
   * Get formatter options from VS Code configuration
   */
  private getFormatterOptions(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions
  ): FormatterOptions {
    const config = vscode.workspace.getConfiguration(
      "gcode",
      document.uri
    );

    return {
      addLineNumbers: config.get<boolean>(
        "formatter.addLineNumbers",
        false
      ),
      lineNumberStart: config.get<number>(
        "formatter.lineNumberStart",
        10
      ),
      lineNumberIncrement: config.get<number>(
        "formatter.lineNumberIncrement",
        10
      ),
      prettyPrintCommands: config.get<boolean>(
        "formatter.prettyPrintCommands",
        true
      ),
      prettyPrintNumbers: config.get<boolean>(
        "formatter.prettyPrintNumbers",
        true
      ),
      // Use VS Code's editor settings for indentation
      indentSize: options.tabSize,
      useTabs: !options.insertSpaces,
      // New formatting options
      indent: config.get<boolean>("formatter.indent", true),
      compactOutput: config.get<boolean>(
        "formatter.compactOutput",
        false
      ),
    };
  }

  /**
   * Provide formatting edits for the entire document
   */
  public provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    _token: vscode.CancellationToken
  ): vscode.TextEdit[] | null {
    try {
      const text = document.getText();

      // Skip empty documents
      if (!text.trim()) {
        return null;
      }

      // Parse the G-code
      const ast = this.parser.parseGcode(text);

      // Get formatter options
      const formatterOptions = this.getFormatterOptions(
        document,
        options
      );

      // Format the AST
      const formatter = new GCodeFormatter(formatterOptions);
      const formattedText = formatter.format(ast);

      // Return a single edit replacing the entire document
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(text.length)
      );

      return [vscode.TextEdit.replace(fullRange, formattedText)];
    } catch (error) {
      // Show error message to user
      const message =
        error instanceof Error
          ? error.message
          : "Unknown formatting error";
      vscode.window.showErrorMessage(
        `G-code formatting failed: ${message}`
      );
      return null;
    }
  }
}

/**
 * G-code range formatting provider for VS Code
 */
export class GCodeRangeFormattingProvider
  implements vscode.DocumentRangeFormattingEditProvider
{
  private documentFormatter: GCodeFormattingProvider;

  constructor() {
    this.documentFormatter = new GCodeFormattingProvider();
  }

  /**
   * Provide formatting edits for a range
   * Note: Since G-code is line-based and we need full context for proper formatting,
   * we format the entire document when range formatting is requested
   */
  public provideDocumentRangeFormattingEdits(
    document: vscode.TextDocument,
    _range: vscode.Range,
    options: vscode.FormattingOptions,
    token: vscode.CancellationToken
  ): vscode.TextEdit[] | null {
    // For simplicity and correctness (especially with line numbers),
    // format the entire document
    return this.documentFormatter.provideDocumentFormattingEdits(
      document,
      options,
      token
    );
  }
}
