/**
 * Shared LSP wire types for the `workspace/gcodeListIndexFiles` request.
 *
 * Server→client request: the server asks the client to enumerate the
 * workspace using its native facilities (`vscode.workspace.findFiles`)
 * so that user-configured `files.exclude` / `search.exclude` are honored.
 *
 * This module is intentionally VSCode-free — it imports only from
 * `vscode-languageserver-protocol` so that it can be loaded by both the
 * language server (no VSCode runtime) and the VSCode client.
 */
import { ProgressToken, RequestType } from 'vscode-languageserver-protocol';

export interface GCodeListIndexFilesParams {
  /** Workspace folder paths the server wants enumerated. Empty array = entire workspace.
   *  Note: the current client implementation does not use this field for scoping —
   *  it always enumerates the whole workspace via `vscode.workspace.findFiles`. */
  readonly folders: readonly string[];

  /** Server-allocated WorkDoneProgress token for the "Finding files…" phase. */
  readonly workDoneToken?: ProgressToken;

  /**
   * Monotonic scan generation. Echoed back so the server can detect stale
   * responses arriving after a newer scan was started.
   */
  readonly scanGeneration: number;

  /** Include glob the server wants matched (e.g. `**\/*.{nc,gcode,...}`). */
  readonly includeGlob: string;
}

export interface GCodeListIndexFilesResult {
  /** Flat list of file URIs found. Order is not significant. */
  readonly files: readonly string[];

  /** Echoed scan generation. */
  readonly scanGeneration: number;

  /** True if the client truncated results (e.g. hit an internal cap). */
  readonly truncated: boolean;
}

export const GCodeListIndexFilesRequest = new RequestType<
  GCodeListIndexFilesParams,
  GCodeListIndexFilesResult,
  void
>('workspace/gcodeListIndexFiles');

/**
 * Capability descriptor advertised by the client in
 * `initializationOptions.experimental.gcode.listIndexFiles`. The server reads
 * this in `onInitialize` to decide whether to use the client enumeration path
 * or the legacy fallback walker.
 */
export interface GCodeListIndexFilesCapability {
  readonly version: number;
}

export const GCODE_LIST_INDEX_FILES_CAPABILITY_KEY = 'gcode.listIndexFiles' as const;

export const GCODE_LIST_INDEX_FILES_CAPABILITY_VERSION = 1 as const;
