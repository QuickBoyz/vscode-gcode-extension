/**
 * Command Provider
 *
 * Centralized command registration and management for the G-Code extension.
 * New commands should be added here to keep extension.ts clean.
 */
import * as path from 'path';

import * as vscode from 'vscode';

import { ClientConfigProvider } from '../config/client-config-provider/ClientConfigProvider';
import { GCODE_LANGUAGE_ID } from '../constants';
import { VisualizerConfig, VisualizerErrorKind, VisualizerPhase } from '../visualizer/types';
import { GCodeVisualizerPanel } from './GCodeVisualizerPanel';
import { SupersededParseError, WorkerClient } from './WorkerClient';

/** Debounce delay in milliseconds for document change events. */
const DOCUMENT_CHANGE_DEBOUNCE_MS = 500;

/**
 * Command Provider
 *
 * Manages all extension commands in a centralized location.
 */
export class CommandProvider {
  private readonly configProvider: ClientConfigProvider;
  private commands: vscode.Disposable[] = [];
  private workerClient: WorkerClient | undefined;

  /** Active document-change listener (disposed when the visualizer panel closes). */
  private documentChangeListener: vscode.Disposable | undefined;

  /** Active VS Code configuration-change listener (disposed with the panel). */
  private configChangeListener: vscode.Disposable | undefined;

  /** Dispose callback registration for panel lifecycle. */
  private panelDisposeRegistration: vscode.Disposable | undefined;

  /** Handle for the debounce timer. */
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  /** URI of the document that was open when the visualizer was launched. */
  private activeDocumentUri: vscode.Uri | undefined;

  /** Navigation callback registration (disposed with the panel). */
  private navigationRegistration: vscode.Disposable | undefined;

  constructor(configProvider: ClientConfigProvider) {
    this.configProvider = configProvider;
  }

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
        const resolved = await this.resolveDocument(uri);
        if (resolved === null) {
          vscode.window.showWarningMessage(
            'Open a G-Code file first, then run "G-Code: Open 3D Visualizer".'
          );
          return;
        }

        // Track the source document URI for navigation
        this.activeDocumentUri = resolved.uri;
        const filename = resolved.uri ? path.basename(resolved.uri.fsPath) : null;

        // Open the panel immediately so the user sees the loading state
        // within the first frame — before the (potentially multi-second)
        // parse starts. The register calls go next so panel-close cleanup
        // is wired up even if the parse later fails.
        GCodeVisualizerPanel.createOrShowLoading(context, this.configProvider, filename);
        this.registerNavigationCallback();
        this.startDocumentChangeListener();

        const workerClient = this.ensureWorkerClient(context);
        const config = await this.configProvider.getConfig();

        let result;
        try {
          result = await workerClient.parse(
            resolved.text,
            config.dialect,
            undefined,
            config.variables,
            (update) => GCodeVisualizerPanel.showProgress(update)
          );
        } catch (error: unknown) {
          // A superseded parse means the user triggered a newer request
          // that is already in flight — swallow it silently so the
          // overlay isn't replaced by a misleading "Failed to parse"
          // message between the two live parses.
          if (error instanceof SupersededParseError) {
            return;
          }
          const message =
            error instanceof Error ? error.message : 'The visualizer worker failed unexpectedly.';
          GCodeVisualizerPanel.showError(
            `Failed to parse G-code: ${message}`,
            VisualizerErrorKind.WORKER_CRASH
          );
          return;
        }

        const settings: VisualizerConfig = config.visualizer;

        if (!result.success) {
          GCodeVisualizerPanel.showError(
            result.errorMessage,
            VisualizerErrorKind.PARSE_FAILURE,
            result.range
          );
          return;
        }

        GCodeVisualizerPanel.showProgress({ phase: VisualizerPhase.RENDERING });
        GCodeVisualizerPanel.createOrShow(
          context,
          result.data,
          settings,
          resolved.text,
          this.configProvider,
          config.variables
        );
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
   * Resolves the G-code source from a URI (explorer context menu) or the
   * active text editor. Returns null if no valid G-code source is found.
   */
  private async resolveDocument(
    uri?: vscode.Uri
  ): Promise<{ readonly uri: vscode.Uri; readonly text: string } | null> {
    if (uri) {
      const document = await vscode.workspace.openTextDocument(uri);
      return { uri, text: document.getText() };
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== GCODE_LANGUAGE_ID) {
      return null;
    }
    return { uri: editor.document.uri, text: editor.document.getText() };
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

    this.configChangeListener = vscode.workspace.onDidChangeConfiguration(
      (event: vscode.ConfigurationChangeEvent) => {
        if (event.affectsConfiguration('gcode.visualizer')) {
          this.configProvider.invalidate();
          void this.configProvider.getConfig().then((config) => {
            GCodeVisualizerPanel.updateSettings(config.visualizer);
          });
        }

        // When gcode.variables changes, re-extract the tool path with updated variables.
        if (event.affectsConfiguration('gcode.variables')) {
          this.configProvider.invalidate();
          void this.refreshVisualizerWithCurrentDocument();
        }
      }
    );

    this.panelDisposeRegistration = GCodeVisualizerPanel.onDidDispose(() => {
      this.stopDocumentChangeListener();
    });
  }

  /**
   * Registers a callback to handle source line navigation requests
   * from the webview. Idempotent: does nothing if already registered.
   */
  private registerNavigationCallback(): void {
    if (this.navigationRegistration) {
      return;
    }
    this.navigationRegistration = GCodeVisualizerPanel.onNavigateToLine((line) => {
      void this.navigateToSourceLine(line);
    });
  }

  /**
   * Opens (or reveals) the source document and scrolls to the given line.
   */
  private async navigateToSourceLine(line: number): Promise<void> {
    if (!this.activeDocumentUri) {
      return;
    }

    try {
      const document = await vscode.workspace.openTextDocument(this.activeDocumentUri);
      const editor = await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false,
      });

      const range = new vscode.Range(line, 0, line, 0);
      editor.selection = new vscode.Selection(range.start, range.start);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } catch {
      vscode.window.showErrorMessage(
        'Could not open the source file. It may have been moved or deleted.'
      );
    }
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

    if (this.configChangeListener) {
      this.configChangeListener.dispose();
      this.configChangeListener = undefined;
    }

    if (this.navigationRegistration) {
      this.navigationRegistration.dispose();
      this.navigationRegistration = undefined;
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

    const filename = path.basename(document.uri.fsPath);
    GCodeVisualizerPanel.showLoading(filename);

    try {
      const sourceText = document.getText();
      const config = await this.configProvider.getConfig();
      const result = await this.workerClient.parse(
        sourceText,
        config.dialect,
        undefined,
        config.variables,
        (update) => GCodeVisualizerPanel.showProgress(update)
      );
      const settings: VisualizerConfig = config.visualizer;

      if (result.success) {
        GCodeVisualizerPanel.showProgress({ phase: VisualizerPhase.RENDERING });
        GCodeVisualizerPanel.refresh(result.data, settings, sourceText, config.variables);
      } else {
        GCodeVisualizerPanel.showError(
          result.errorMessage,
          VisualizerErrorKind.PARSE_FAILURE,
          result.range
        );
      }
    } catch (error: unknown) {
      if (error instanceof SupersededParseError) {
        return;
      }
      vscode.window.showErrorMessage(
        'Failed to refresh visualizer from document change. ' +
          'This may occur in unsupported environments (e.g. Electron without nodeIntegration).'
      );
      GCodeVisualizerPanel.showError(
        'Failed to refresh visualizer due to an internal error.',
        VisualizerErrorKind.WORKER_CRASH
      );
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
   * Refreshes the visualizer by finding the current G-code document
   * (either the tracked active document or the active text editor)
   * and re-extracting the tool path.
   */
  private async refreshVisualizerWithCurrentDocument(): Promise<void> {
    if (!this.workerClient || !GCodeVisualizerPanel.isOpen) {
      return;
    }

    const uri = this.activeDocumentUri ?? vscode.window.activeTextEditor?.document.uri;
    if (!uri) {
      return;
    }

    try {
      const document = await vscode.workspace.openTextDocument(uri);
      await this.refreshVisualizerFromDocument(document);
    } catch {
      // Document may have been closed or moved.
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
