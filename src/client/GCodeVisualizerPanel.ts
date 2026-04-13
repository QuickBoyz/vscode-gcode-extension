/**
 * GCodeVisualizerPanel
 *
 * Manages the VS Code WebviewPanel that shows the 3D tool-path visualization.
 *
 * Usage
 *   GCodeVisualizerPanel.createOrShow(context, pathData, settings);
 *
 * Only one panel is open at a time.  If the panel already exists it is
 * revealed and its content is updated.
 */
import * as fs from 'fs';
import * as path from 'path';

import * as vscode from 'vscode';

import { ClientConfigProvider } from '../config/client-config-provider/ClientConfigProvider';
import { tokenizeSourceLines, TokenSpan } from '../visualizer/sourceTokenizer';
import {
  PathBounds,
  ReferencedVariable,
  ToolPathData,
  VariableDefinitions,
  VisualizerConfig,
  VisualizerPhase,
} from '../visualizer/types';
import { generateNonce } from './nonce';

/**
 * Message types sent from the extension to the webview.
 */
type ExtensionToWebviewMessage =
  | {
      type: 'update';
      segments: ToolPathData['segments'];
      bounds: PathBounds;
      settings: VisualizerConfig;
      sourceTokens: readonly TokenSpan[][];
      referencedVariables: readonly ReferencedVariable[];
      settingsVariables: readonly ReferencedVariable[];
    }
  | { type: 'updateSettings'; settings: VisualizerConfig }
  | { type: 'error'; message: string }
  | {
      type: 'loading';
      phase: VisualizerPhase;
      filename: string | null;
    };

/**
 * Message types received from the webview.
 */
type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'settingsChange'; settings?: VisualizerConfig }
  | { type: 'variablesChange'; variables?: VariableDefinitions }
  | { type: 'navigateToLine'; line: number };

/**
 * Callback invoked when the panel is disposed (closed).
 */
type DisposeCallback = () => void;

/**
 * Callback invoked when the webview requests navigation to a source line.
 */
type NavigateCallback = (line: number) => void;

/**
 * Singleton panel wrapper for the 3D visualizer.
 */
export class GCodeVisualizerPanel {
  private static instance: GCodeVisualizerPanel | undefined;
  private static disposeCallbacks: DisposeCallback[] = [];
  private static navigateCallbacks: NavigateCallback[] = [];

  private readonly panel: vscode.WebviewPanel;
  private readonly configProvider: ClientConfigProvider;
  private disposables: vscode.Disposable[] = [];

  /**
   * Queue of messages to send once the webview signals `ready`. A queue
   * (instead of a single slot) is needed so an early `loading` message can
   * be preserved even if an `update` follows while the webview is still
   * booting.
   */
  private pendingMessages: ExtensionToWebviewMessage[] = [];
  private webviewReady = false;
  /** Filename of the document currently being loaded, for error context. */
  private currentFilename: string | null = null;

  private constructor(panel: vscode.WebviewPanel, configProvider: ClientConfigProvider) {
    this.panel = panel;
    this.configProvider = configProvider;

    panel.onDidDispose(() => this.dispose(), null, this.disposables);

    panel.webview.onDidReceiveMessage(
      (msg: WebviewToExtensionMessage) => this.handleMessage(msg),
      null,
      this.disposables
    );
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Opens (or reveals) the visualizer panel immediately and puts it into
   * a loading state for the given file. Call this *before* starting the
   * parse so the user sees "Parsing G-code… <filename>" within one frame,
   * rather than nothing for the length of the parse.
   *
   * Subsequent calls to {@link showProgress}, {@link createOrShow}, or
   * {@link showError} will take the panel through the rest of its states.
   */
  static createOrShowLoading(
    context: vscode.ExtensionContext,
    configProvider: ClientConfigProvider,
    filename: string | null
  ): void {
    const instance = GCodeVisualizerPanel.ensureInstance(context, configProvider);
    instance.currentFilename = filename;
    instance.panel.reveal(undefined, true);
    instance.enqueue({
      type: 'loading',
      phase: VisualizerPhase.PARSING,
      filename,
    });
  }

  /**
   * Updates the loading overlay with a new phase while a parse is in
   * flight. Safe to call before the webview has posted `ready` — the
   * message is queued along with any earlier loading message.
   */
  static showProgress(phase: VisualizerPhase): void {
    const instance = GCodeVisualizerPanel.instance;
    if (!instance) return;
    instance.enqueue({
      type: 'loading',
      phase,
      filename: instance.currentFilename,
    });
  }

  /**
   * Creates the panel (if not already open) or reveals it, then sends the
   * given path data and settings to the webview for rendering.
   */
  static createOrShow(
    context: vscode.ExtensionContext,
    pathData: ToolPathData,
    settings: VisualizerConfig,
    sourceText: string,
    configProvider: ClientConfigProvider,
    settingsVariables: VariableDefinitions = {}
  ): void {
    const instance = GCodeVisualizerPanel.ensureInstance(context, configProvider);
    instance.panel.reveal(undefined, true);
    instance.update(pathData, settings, sourceText, settingsVariables);
  }

  /**
   * Ensures the singleton panel exists and returns it. Creates the panel
   * (and wires up the webview content) on first use.
   */
  private static ensureInstance(
    context: vscode.ExtensionContext,
    configProvider: ClientConfigProvider
  ): GCodeVisualizerPanel {
    if (GCodeVisualizerPanel.instance) {
      return GCodeVisualizerPanel.instance;
    }

    const extensionUri = context.extensionUri;
    const webviewDistUri = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');

    const panel = vscode.window.createWebviewPanel(
      'gcodeVisualizer',
      'G-Code 3D Visualizer',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [webviewDistUri],
      }
    );

    const instance = new GCodeVisualizerPanel(panel, configProvider);
    GCodeVisualizerPanel.instance = instance;
    instance.initContent(extensionUri);
    return instance;
  }

  /**
   * Pushes updated path data and settings to an already-open panel.
   * Does nothing when the panel is not visible.
   */
  static refresh(
    pathData: ToolPathData,
    settings: VisualizerConfig,
    sourceText: string,
    settingsVariables: VariableDefinitions = {}
  ): void {
    GCodeVisualizerPanel.instance?.update(pathData, settings, sourceText, settingsVariables);
  }

  /**
   * Sends an error message to the webview for display.
   * Does nothing when the panel is not visible.
   */
  static showError(message: string): void {
    GCodeVisualizerPanel.instance?.enqueue({ type: 'error', message });
  }

  /**
   * Shows a loading overlay in the webview while parsing is in progress.
   * Does nothing when the panel is not visible.
   *
   * @param filename  Optional file label shown under the spinner; falls
   *                  back to the currently tracked filename.
   */
  static showLoading(filename?: string | null): void {
    const instance = GCodeVisualizerPanel.instance;
    if (!instance) return;
    if (filename !== undefined) {
      instance.currentFilename = filename;
    }
    instance.enqueue({
      type: 'loading',
      phase: VisualizerPhase.PARSING,
      filename: instance.currentFilename,
    });
  }

  /**
   * Sends updated settings to the webview without refreshing path data.
   * Used for bidirectional sync when the user changes VS Code settings.
   * Does nothing when the panel is not visible.
   */
  static updateSettings(settings: VisualizerConfig): void {
    if (GCodeVisualizerPanel.instance) {
      const message: ExtensionToWebviewMessage = { type: 'updateSettings', settings };
      GCodeVisualizerPanel.instance.panel.webview.postMessage(message);
    }
  }

  /**
   * Returns true when the singleton panel is currently open.
   */
  static get isOpen(): boolean {
    return GCodeVisualizerPanel.instance !== undefined;
  }

  /**
   * Registers a callback that fires when the panel is disposed (closed).
   * Returns a {@link vscode.Disposable} that removes the callback.
   */
  static onDidDispose(callback: DisposeCallback): vscode.Disposable {
    GCodeVisualizerPanel.disposeCallbacks.push(callback);
    return {
      dispose: () => {
        const index = GCodeVisualizerPanel.disposeCallbacks.indexOf(callback);
        if (index !== -1) {
          GCodeVisualizerPanel.disposeCallbacks.splice(index, 1);
        }
      },
    };
  }

  /**
   * Registers a callback that fires when the webview requests navigation
   * to a source line. Returns a {@link vscode.Disposable} that removes the callback.
   */
  static onNavigateToLine(callback: NavigateCallback): vscode.Disposable {
    GCodeVisualizerPanel.navigateCallbacks.push(callback);
    return {
      dispose: () => {
        const index = GCodeVisualizerPanel.navigateCallbacks.indexOf(callback);
        if (index !== -1) {
          GCodeVisualizerPanel.navigateCallbacks.splice(index, 1);
        }
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private initContent(extensionUri: vscode.Uri): void {
    const webview = this.panel.webview;
    const webviewDistPath = path.join(extensionUri.fsPath, 'dist', 'webview');

    // Build webview-safe URIs for static assets
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'renderer.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'styles.css')
    );

    const nonce = generateNonce();

    // Read the HTML template and replace placeholders
    const htmlPath = path.join(webviewDistPath, 'index.html');
    const rawHtml = fs.readFileSync(htmlPath, 'utf-8');

    webview.html = rawHtml
      .replace(/\{\{nonce\}\}/g, nonce)
      .replace(/\{\{scriptUri\}\}/g, scriptUri.toString())
      .replace(/\{\{styleUri\}\}/g, styleUri.toString())
      .replace(/\{\{cspSource\}\}/g, webview.cspSource);
  }

  private buildUpdateMessage(
    pathData: ToolPathData,
    settings: VisualizerConfig,
    sourceText: string,
    settingsVariables: VariableDefinitions = {}
  ): ExtensionToWebviewMessage {
    return {
      type: 'update',
      segments: pathData.segments,
      bounds: pathData.bounds,
      settings,
      sourceTokens: tokenizeSourceLines(sourceText.split(/\r?\n/)),
      referencedVariables: pathData.referencedVariables,
      settingsVariables: Object.entries(settingsVariables).map(([key, value]) => ({ key, value })),
    };
  }

  private update(
    pathData: ToolPathData,
    settings: VisualizerConfig,
    sourceText: string,
    settingsVariables: VariableDefinitions = {}
  ): void {
    const msg = this.buildUpdateMessage(pathData, settings, sourceText, settingsVariables);
    this.enqueue(msg);
  }

  /**
   * Queue a message for delivery to the webview. If the webview has not
   * yet posted `ready`, the message is held until it does; otherwise it
   * is posted immediately. A successful `update` clears any earlier
   * pending `loading` — the panel is about to paint real data.
   */
  private enqueue(msg: ExtensionToWebviewMessage): void {
    if (!this.webviewReady) {
      if (msg.type === 'update') {
        // An update supersedes any pending loading/error.
        this.pendingMessages = this.pendingMessages.filter(
          (m) => m.type !== 'loading' && m.type !== 'error'
        );
      }
      this.pendingMessages.push(msg);
      return;
    }
    this.panel.webview.postMessage(msg);
  }

  private handleMessage(msg: WebviewToExtensionMessage): void {
    if (msg.type === 'ready') {
      this.webviewReady = true;
      const queue = this.pendingMessages;
      this.pendingMessages = [];
      for (const pending of queue) {
        this.panel.webview.postMessage(pending);
      }
      return;
    }

    if (msg.type === 'navigateToLine') {
      for (const callback of GCodeVisualizerPanel.navigateCallbacks) {
        callback(msg.line);
      }
      return;
    }

    if (msg.type === 'settingsChange') {
      void this.configProvider.updateConfig({ visualizer: msg.settings });
    }

    if (msg.type === 'variablesChange') {
      void this.configProvider.updateConfig({ variables: msg.variables });
    }
  }

  private dispose(): void {
    GCodeVisualizerPanel.instance = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];

    // Notify all registered dispose callbacks
    const callbacks = [...GCodeVisualizerPanel.disposeCallbacks];
    GCodeVisualizerPanel.disposeCallbacks = [];
    GCodeVisualizerPanel.navigateCallbacks = [];
    for (const callback of callbacks) {
      callback();
    }
  }
}
