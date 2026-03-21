/**
 * Command Provider
 *
 * Centralized command registration and management for the G-Code extension.
 * New commands should be added here to keep extension.ts clean.
 */
import * as vscode from 'vscode';

import { GCODE_LANGUAGE_ID } from '../constants';
import { DEFAULT_VISUALIZER_SETTINGS, VisualizerSettings } from '../visualizer/types';
import { GCodeVisualizerPanel } from './GCodeVisualizerPanel';
import { VisualizerService } from './VisualizerService';

/**
 * Command Provider
 *
 * Manages all extension commands in a centralized location.
 */
export class CommandProvider {
  private commands: vscode.Disposable[] = [];
  private readonly visualizerService = new VisualizerService();

  /**
   * Register all commands
   */
  registerCommands(context: vscode.ExtensionContext): void {
    this.commands.push(this.registerFormatDocumentCommand());
    this.commands.push(this.registerOpenVisualizerCommand(context));

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
   * Register the command that opens (or refreshes) the 3D visualizer panel.
   */
  private registerOpenVisualizerCommand(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.commands.registerCommand('gcode.openVisualizer', (): void => {
      const editor = vscode.window.activeTextEditor;

      if (!editor || editor.document.languageId !== GCODE_LANGUAGE_ID) {
        vscode.window.showWarningMessage(
          'Open a G-Code file first, then run "G-Code: Open 3D Visualizer".'
        );
        return;
      }

      const pathData = this.visualizerService.extractToolPath(editor.document.getText());
      const settings = this.readVisualizerSettings();

      GCodeVisualizerPanel.createOrShow(context, pathData, settings);
    });
  }

  /**
   * Reads visualizer colour/thickness settings from VS Code configuration,
   * falling back to {@link DEFAULT_VISUALIZER_SETTINGS} when a key is absent.
   */
  private readVisualizerSettings(): VisualizerSettings {
    const config = vscode.workspace.getConfiguration('gcode');
    return {
      rapidColor: config.get<string>(
        'visualizer.rapidColor',
        DEFAULT_VISUALIZER_SETTINGS.rapidColor
      ),
      feedColor: config.get<string>('visualizer.feedColor', DEFAULT_VISUALIZER_SETTINGS.feedColor),
      arcColor: config.get<string>('visualizer.arcColor', DEFAULT_VISUALIZER_SETTINGS.arcColor),
      lineThickness: config.get<number>(
        'visualizer.lineThickness',
        DEFAULT_VISUALIZER_SETTINGS.lineThickness
      ),
    };
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
