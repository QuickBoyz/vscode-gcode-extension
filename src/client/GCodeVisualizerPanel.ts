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
import * as vscode from 'vscode';

import { PathBounds, ToolPathData, VisualizerSettings } from '../visualizer/types';
import { buildWebviewHtml, generateNonce } from './webviewTemplate';

/**
 * Message types sent from the extension to the webview.
 */
type ExtensionToWebviewMessage =
  | {
      type: 'update';
      segments: ToolPathData['segments'];
      bounds: PathBounds;
      settings: VisualizerSettings;
    }
  | { type: 'updateSettings'; settings: VisualizerSettings }
  | { type: 'error'; message: string };

/**
 * Message types received from the webview.
 */
interface SettingsChangeMessage {
  type: 'settingsChange';
  settings: VisualizerSettings;
}

/**
 * Callback invoked when the panel is disposed (closed).
 */
type DisposeCallback = () => void;

/**
 * Singleton panel wrapper for the 3D visualizer.
 */
export class GCodeVisualizerPanel {
  private static instance: GCodeVisualizerPanel | undefined;
  private static disposeCallbacks: DisposeCallback[] = [];

  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;

    panel.onDidDispose(() => this.dispose(), null, this.disposables);

    panel.webview.onDidReceiveMessage(
      (msg: SettingsChangeMessage) => this.handleMessage(msg),
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
    settings: VisualizerSettings
  ): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (GCodeVisualizerPanel.instance) {
      GCodeVisualizerPanel.instance.panel.reveal(column);
      GCodeVisualizerPanel.instance.update(pathData, settings);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'gcodeVisualizer',
      'G-Code 3D Visualizer',
      column ?? vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    const instance = new GCodeVisualizerPanel(panel);
    GCodeVisualizerPanel.instance = instance;
    instance.initContent(settings);
    instance.update(pathData, settings);
  }

  /**
   * Pushes updated path data and settings to an already-open panel.
   * Does nothing when the panel is not visible.
   */
  static refresh(pathData: ToolPathData, settings: VisualizerSettings): void {
    GCodeVisualizerPanel.instance?.update(pathData, settings);
  }

  /**
   * Sends an error message to the webview for display.
   * Does nothing when the panel is not visible.
   */
  static showError(message: string): void {
    GCodeVisualizerPanel.instance?.sendError(message);
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

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private initContent(settings: VisualizerSettings): void {
    const nonce = generateNonce();
    this.panel.webview.html = buildWebviewHtml(nonce, settings);
  }

  private update(pathData: ToolPathData, settings: VisualizerSettings): void {
    const msg: ExtensionToWebviewMessage = {
      type: 'update',
      segments: pathData.segments,
      bounds: pathData.bounds,
      settings,
    };
    this.panel.webview.postMessage(msg);
  }

  private sendError(message: string): void {
    const msg: ExtensionToWebviewMessage = {
      type: 'error',
      message,
    };
    this.panel.webview.postMessage(msg);
  }

  private handleMessage(msg: SettingsChangeMessage): void {
    if (msg.type !== 'settingsChange') return;

    // Persist the user's colour / thickness choices to workspace settings.
    const config = vscode.workspace.getConfiguration('gcode');
    config.update('visualizer.rapidColor', msg.settings.rapidColor, true);
    config.update('visualizer.feedColor', msg.settings.feedColor, true);
    config.update('visualizer.arcColor', msg.settings.arcColor, true);
    config.update('visualizer.lineThickness', msg.settings.lineThickness, true);
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
    for (const callback of callbacks) {
      callback();
    }
  }
}
