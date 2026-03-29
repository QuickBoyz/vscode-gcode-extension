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
import { GCodeLexer } from '../lexer/GCodeLexer';
import { TokenType } from '../parser/nodes/tokens';
import { PathBounds, ToolPathData, VisualizerConfig } from '../visualizer/types';
import { generateNonce } from './nonce';

/**
 * A lightweight token span for the webview to render syntax-highlighted
 * source lines. Only carries the text and a token type string.
 */
export interface TokenSpan {
  readonly text: string;
  readonly type: string;
}

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
    }
  | { type: 'updateSettings'; settings: VisualizerConfig }
  | { type: 'error'; message: string }
  | { type: 'loading' };

/**
 * Message types received from the webview.
 */
type WebviewToExtensionMessage =
  | { type: 'settingsChange'; settings: VisualizerConfig }
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
   * Creates the panel (if not already open) or reveals it, then sends the
   * given path data and settings to the webview for rendering.
   */
  static createOrShow(
    context: vscode.ExtensionContext,
    pathData: ToolPathData,
    settings: VisualizerConfig,
    sourceText: string,
    configProvider: ClientConfigProvider
  ): void {
    if (GCodeVisualizerPanel.instance) {
      GCodeVisualizerPanel.instance.panel.reveal();
      GCodeVisualizerPanel.instance.update(pathData, settings, sourceText);
      return;
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
    instance.update(pathData, settings, sourceText);
  }

  /**
   * Pushes updated path data and settings to an already-open panel.
   * Does nothing when the panel is not visible.
   */
  static refresh(pathData: ToolPathData, settings: VisualizerConfig, sourceText: string): void {
    GCodeVisualizerPanel.instance?.update(pathData, settings, sourceText);
  }

  /**
   * Sends an error message to the webview for display.
   * Does nothing when the panel is not visible.
   */
  static showError(message: string): void {
    GCodeVisualizerPanel.instance?.sendError(message);
  }

  /**
   * Shows a loading overlay in the webview while parsing is in progress.
   * Does nothing when the panel is not visible.
   */
  static showLoading(): void {
    GCodeVisualizerPanel.instance?.sendLoading();
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

  private update(pathData: ToolPathData, settings: VisualizerConfig, sourceText: string): void {
    const msg: ExtensionToWebviewMessage = {
      type: 'update',
      segments: pathData.segments,
      bounds: pathData.bounds,
      settings,
      sourceTokens: GCodeVisualizerPanel.tokenizeLines(sourceText.split(/\r?\n/)),
    };
    this.panel.webview.postMessage(msg);
  }

  /**
   * Tokenizes each source line using the G-code lexer and returns
   * lightweight token spans for syntax highlighting in the webview.
   * Whitespace between tokens is preserved as 'ws' spans so the
   * rendered output matches the original line exactly.
   */
  private static tokenizeLines(lines: readonly string[]): TokenSpan[][] {
    const lexer = new GCodeLexer();
    return lines.map((line) => {
      try {
        const tokens = lexer.tokenize(line);
        const spans: TokenSpan[] = [];
        let cursor = 0;

        for (const token of tokens) {
          if (token.type === TokenType.NL) continue;
          const offset = token.getOffset();
          // Fill gap with whitespace
          if (offset > cursor) {
            spans.push({ text: line.slice(cursor, offset), type: 'ws' });
          }
          spans.push({ text: token.value, type: token.type });
          cursor = offset + token.value.length;
        }

        // Trailing whitespace
        if (cursor < line.length) {
          spans.push({ text: line.slice(cursor), type: 'ws' });
        }

        return spans;
      } catch {
        return [{ text: line, type: 'plain' }];
      }
    });
  }

  private sendError(message: string): void {
    const msg: ExtensionToWebviewMessage = {
      type: 'error',
      message,
    };
    this.panel.webview.postMessage(msg);
  }

  private sendLoading(): void {
    const msg: ExtensionToWebviewMessage = { type: 'loading' };
    this.panel.webview.postMessage(msg);
  }

  private handleMessage(msg: WebviewToExtensionMessage): void {
    if (msg.type === 'navigateToLine') {
      for (const callback of GCodeVisualizerPanel.navigateCallbacks) {
        callback(msg.line);
      }
      return;
    }

    if (msg.type !== 'settingsChange') return;

    // Persist visualizer settings via the config provider.
    void this.configProvider.updateConfig({ visualizer: msg.settings });
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
