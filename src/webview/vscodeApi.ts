/**
 * Module-level singleton for the VS Code webview API.
 *
 * `acquireVsCodeApi()` can only be called once per webview session.
 * This module calls it at load time and re-exports the resulting object
 * so every hook/component can import it without coordination.
 */

interface VSCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeApi;

const vscode: VSCodeApi = acquireVsCodeApi();
export default vscode;
