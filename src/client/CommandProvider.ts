/**
 * Command Provider
 *
 * Centralized command registration and management for the G-Code extension.
 * New commands should be added here to keep extension.ts clean.
 */
import * as path from 'path';

import * as vscode from 'vscode';

import { GCODE_LANGUAGE_ID } from '../constants';
import { DEFAULT_VISUALIZER_SETTINGS, VisualizerSettings } from '../visualizer/types';
import { GCodeVisualizerPanel } from './GCodeVisualizerPanel';
import { WorkerClient } from './WorkerClient';

/** Debounce delay in milliseconds for document change events. */
const DOCUMENT_CHANGE_DEBOUNCE_MS = 500;

/**
 * Command Provider
 *
 * Manages all extension commands in a centralized location.
 */
export class CommandProvider {
  private commands: vscode.Disposable[] = [];
  private workerClient: WorkerClient | undefined;

  /** Active document-change listener (disposed when the visualizer panel closes). */
  private documentChangeListener: vscode.Disposable | undefined;

  /** Dispose callback registration for panel lifecycle. */
  private panelDisposeRegistration: vscode.Disposable | undefined;

  /** Handle for the debounce timer. */
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

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
   *
   * Accepts an optional `uri` parameter so the command can be invoked from
   * the file-explorer context menu (which passes the selected file's URI).
   */
  private registerOpenVisualizerCommand(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.commands.registerCommand(
      'gcode.openVisualizer',
      async (uri?: vscode.Uri): Promise<void> => {
        const documentText = await this.resolveDocumentText(uri);
        if (documentText === null) {
          vscode.window.showWarningMessage(
            'Open a G-Code file first, then run "G-Code: Open 3D Visualizer".'
          );
          return;
        }

        const workerClient = this.ensureWorkerClient(context);

        const result = await workerClient.parse(documentText);
        const settings = this.readVisualizerSettings();

        if (!result.success) {
          vscode.window.showErrorMessage(`G-Code visualizer error: ${result.errorMessage}`);
          return;
        }

        GCodeVisualizerPanel.createOrShow(context, result.data, settings);
        this.startDocumentChangeListener();
      }
    );
  }

  /**
   * Creates the {@link WorkerClient} lazily on first use, passing
   * the path to the compiled worker script.
   *
   * @returns The existing or newly created WorkerClient
   */
  private ensureWorkerClient(context: vscode.ExtensionContext): WorkerClient {
    if (this.workerClient) {
      return this.workerClient;
    }
    const workerScriptPath = context.asAbsolutePath(
      path.join('dist', 'visualizer', 'visualizerWorker.js')
    );
    this.workerClient = new WorkerClient(workerScriptPath);
    return this.workerClient;
  }

  /**
   * Resolves the G-code text content from a URI (explorer context menu)
   * or the active text editor. Returns null if no valid G-code source is found.
   */
  private async resolveDocumentText(uri?: vscode.Uri): Promise<string | null> {
    if (uri) {
      const document = await vscode.workspace.openTextDocument(uri);
      return document.getText();
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== GCODE_LANGUAGE_ID) {
      return null;
    }
    return editor.document.getText();
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
      showGrid: config.get<boolean>('visualizer.showGrid', DEFAULT_VISUALIZER_SETTINGS.showGrid),
      gridSpacing: config.get<number>(
        'visualizer.gridSpacing',
        DEFAULT_VISUALIZER_SETTINGS.gridSpacing
      ),
    };
  }

  // ---------------------------------------------------------------------------
  // Live-update listener
  // ---------------------------------------------------------------------------

  /**
   * Starts listening for document changes on G-code files.
   * When the active G-code document changes, the visualizer panel is
   * refreshed after a short debounce delay.
   *
   * Idempotent: does nothing if a listener is already active.
   */
  private startDocumentChangeListener(): void {
    if (this.documentChangeListener) {
      return;
    }

    this.documentChangeListener = vscode.workspace.onDidChangeTextDocument(
      (event: vscode.TextDocumentChangeEvent) => {
        this.handleDocumentChange(event);
      }
    );

    this.panelDisposeRegistration = GCodeVisualizerPanel.onDidDispose(() => {
      this.stopDocumentChangeListener();
    });
  }

  /**
   * Stops the document change listener and clears any pending debounce timer.
   */
  private stopDocumentChangeListener(): void {
    this.clearDebounceTimer();

    if (this.documentChangeListener) {
      this.documentChangeListener.dispose();
      this.documentChangeListener = undefined;
    }

    if (this.panelDisposeRegistration) {
      this.panelDisposeRegistration.dispose();
      this.panelDisposeRegistration = undefined;
    }

    this.disposeWorkerClient();
  }

  /**
   * Handles a document change event. Only processes G-code documents
   * while the visualizer panel is open.
   */
  private handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    if (event.document.languageId !== GCODE_LANGUAGE_ID) {
      return;
    }

    if (!GCodeVisualizerPanel.isOpen) {
      return;
    }

    this.clearDebounceTimer();
    this.debounceTimer = setTimeout(() => {
      void this.refreshVisualizerFromDocument(event.document);
    }, DOCUMENT_CHANGE_DEBOUNCE_MS);
  }

  /**
   * Re-extracts tool path data from the given document and pushes it
   * to the visualizer panel, or shows an error if extraction fails.
   */
  private async refreshVisualizerFromDocument(document: vscode.TextDocument): Promise<void> {
    if (!this.workerClient) {
      return;
    }

    GCodeVisualizerPanel.showLoading();

    try {
      const result = await this.workerClient.parse(document.getText());
      const settings = this.readVisualizerSettings();

      if (result.success) {
        GCodeVisualizerPanel.refresh(result.data, settings);
      } else {
        GCodeVisualizerPanel.showError(result.errorMessage);
      }
    } catch {
      console.warn(
        'Failed to refresh visualizer from document change. ' +
          'This may occur in unsupported environments (e.g. Electron without nodeIntegration).'
      );
      GCodeVisualizerPanel.showError('Failed to refresh visualizer due to an internal error.');
    }
  }

  /**
   * Clears any active debounce timer.
   */
  private clearDebounceTimer(): void {
    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }

  /**
   * Dispose all registered commands, the document change listener,
   * and the worker client.
   */
  dispose(): void {
    this.stopDocumentChangeListener();
    this.disposeWorkerClient();
    this.commands.forEach((cmd) => {
      cmd.dispose();
    });
    this.commands = [];
  }

  /**
   * Disposes the worker client if it exists.
   */
  private disposeWorkerClient(): void {
    if (this.workerClient) {
      this.workerClient.dispose();
      this.workerClient = undefined;
    }
  }
}
