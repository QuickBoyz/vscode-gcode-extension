/**
 * WorkspaceFileEnumerator — handles the server-initiated
 * `workspace/gcodeListIndexFiles` request on the client side.
 *
 * Reads the user's `files.exclude` and `search.exclude` settings **per
 * workspace folder**, merges them, calls `vscode.workspace.findFiles`
 * scoped to that folder, and returns the union of all results to the
 * server. This gives each folder in a multi-root workspace its own
 * exclude configuration. Optionally emits two-phase WorkDone progress
 * under a server-allocated token so the same progress UI element can
 * morph into the subsequent server-side indexing phase.
 *
 * Dependencies (vscode + the language client) are injected via the
 * constructor so the class can be unit-tested without a VSCode runtime.
 */
import {
  ProgressToken,
  WorkDoneProgressBegin,
  WorkDoneProgressEnd,
} from 'vscode-languageserver-protocol';

import { GCodeListIndexFilesParams, GCodeListIndexFilesResult } from '../lsp/gcodeListIndexFiles';
import { ExcludeGlobBuilder } from './ExcludeGlobBuilder';

export interface UriLike {
  toString(): string;
}

export interface ExcludeSettings {
  readonly filesExclude: Record<string, unknown>;
  readonly searchExclude: Record<string, unknown>;
}

export interface WorkspaceFileEnumeratorDeps {
  /**
   * Enumerate G-code files within the given workspace folder.
   *
   * `folderUri` is the `file://` URI of the workspace folder (as sent in
   * `GCodeListIndexFilesParams.folders`). When `folderUri` is an empty
   * string the implementation should fall back to a whole-workspace search
   * (backward-compatible path for callers that send no folders).
   */
  readonly findFiles: (
    include: string,
    exclude: string | undefined,
    folderUri: string
  ) => Thenable<readonly UriLike[]>;
  /**
   * Read the effective `files.exclude` / `search.exclude` configuration
   * for the given workspace folder URI. Implementations should use
   * `vscode.workspace.getConfiguration(undefined, vscode.Uri.parse(folderUri))`
   * to get folder-scoped settings in multi-root workspaces. When
   * `folderUri` is an empty string, fall back to workspace-level config.
   */
  readonly getExcludes: (folderUri: string) => ExcludeSettings;
  readonly reportProgress: (
    token: ProgressToken,
    value: WorkDoneProgressBegin | WorkDoneProgressEnd
  ) => void;
}

const PROGRESS_BEGIN_TITLE = 'Finding G-code files';

export class WorkspaceFileEnumerator {
  private readonly deps: WorkspaceFileEnumeratorDeps;

  public constructor(deps: WorkspaceFileEnumeratorDeps) {
    this.deps = deps;
  }

  public async handle(params: GCodeListIndexFilesParams): Promise<GCodeListIndexFilesResult> {
    const token = params.workDoneToken;

    if (token !== undefined) {
      this.deps.reportProgress(token, { kind: 'begin', title: PROGRESS_BEGIN_TITLE });
    }

    try {
      // When the server sends folder URIs, enumerate each folder
      // independently with that folder's exclude settings. This gives
      // each workspace folder in a multi-root workspace its own
      // files.exclude / search.exclude configuration.
      //
      // Fall back to a single whole-workspace search when no folders are
      // provided (non-VSCode clients / legacy callers).
      const folders = params.folders.length > 0 ? params.folders : [''];
      const allFiles: string[] = [];

      for (const folderUri of folders) {
        const excludeGlob = ExcludeGlobBuilder.build(this.deps.getExcludes(folderUri));
        const uris = await this.deps.findFiles(params.includeGlob, excludeGlob, folderUri);
        for (const uri of uris) {
          allFiles.push(uri.toString());
        }
      }

      return {
        files: allFiles,
        scanGeneration: params.scanGeneration,
        truncated: false,
      };
    } finally {
      if (token !== undefined) {
        this.deps.reportProgress(token, { kind: 'end' });
      }
    }
  }
}
