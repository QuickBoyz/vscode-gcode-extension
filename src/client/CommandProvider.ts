/**
 * Command Provider
 *
 * Centralized command registration and management for the G-Code extension.
 * New commands should be added here to keep extension.ts clean.
 */
import * as vscode from 'vscode';
import { GCODE_LANGUAGE_ID } from '../constants';

/**
 * Command Provider
 *
 * Manages all extension commands in a centralized location.
 */
export class CommandProvider {
  private commands: vscode.Disposable[] = [];

  /**
   * Register all commands
   */
  registerCommands(context: vscode.ExtensionContext): void {
    this.commands.push(this.registerFormatDocumentCommand());

    // Add all commands to subscriptions for proper cleanup
    this.commands.forEach((cmd) => context.subscriptions.push(cmd));
  }

  /**
   * Register the format document command
   */
  private registerFormatDocumentCommand(): vscode.Disposable {
    return vscode.commands.registerCommand('gcode.formatDocument', async (): Promise<void> => {
      const editor = vscode.window.activeTextEditor;

      if (!editor || editor.document.languageId !== GCODE_LANGUAGE_ID) {
        vscode.window.showWarningMessage('No active G-Code document to format');
        return;
      }

      // Use VS Code's built-in format document command
      await vscode.commands.executeCommand('editor.action.formatDocument');
      return;
    });
  }

  /**
   * Dispose all registered commands
   */
  dispose(): void {
    this.commands.forEach((cmd) => {
      cmd.dispose();
    });
    this.commands = [];
  }
}
