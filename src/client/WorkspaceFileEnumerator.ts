/**
 * WorkspaceFileEnumerator — handles the server-initiated
 * `workspace/gcodeListIndexFiles` request on the client side.
 *
 * Reads the user's `files.exclude` and `search.exclude` settings, merges
 * them, calls `vscode.workspace.findFiles`, and returns the resulting URIs
 * to the server. Optionally emits two-phase WorkDone progress under a
 * server-allocated token so the same progress UI element can morph into
 * the subsequent server-side indexing phase.
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

export interface UriLike {
  toString(): string;
}

export interface ExcludeSettings {
  readonly filesExclude: Record<string, boolean>;
  readonly searchExclude: Record<string, boolean>;
}

export interface WorkspaceFileEnumeratorDeps {
  readonly findFiles: (
    include: string,
    exclude: string | undefined
  ) => Thenable<readonly UriLike[]>;
  readonly getExcludes: () => ExcludeSettings;
  readonly reportProgress: (
    token: ProgressToken,
    value: WorkDoneProgressBegin | WorkDoneProgressEnd
  ) => void;
}

const PROGRESS_BEGIN_TITLE = 'Finding G-code files…';

export class WorkspaceFileEnumerator {
  private readonly deps: WorkspaceFileEnumeratorDeps;

  public constructor(deps: WorkspaceFileEnumeratorDeps) {
    this.deps = deps;
  }

  public async handle(params: GCodeListIndexFilesParams): Promise<GCodeListIndexFilesResult> {
    const excludeGlob = this.buildExcludeGlob(this.deps.getExcludes());
    const token = params.workDoneToken;

    if (token !== undefined) {
      this.deps.reportProgress(token, { kind: 'begin', title: PROGRESS_BEGIN_TITLE });
    }

    try {
      const uris = await this.deps.findFiles(params.includeGlob, excludeGlob);
      return {
        files: uris.map((u) => u.toString()),
        scanGeneration: params.scanGeneration,
        truncated: false,
      };
    } finally {
      if (token !== undefined) {
        this.deps.reportProgress(token, { kind: 'end' });
      }
    }
  }

  private buildExcludeGlob(settings: ExcludeSettings): string | undefined {
    const patterns = new Set<string>();
    for (const [pattern, enabled] of Object.entries(settings.filesExclude)) {
      if (enabled) {
        patterns.add(pattern);
      }
    }
    for (const [pattern, enabled] of Object.entries(settings.searchExclude)) {
      if (enabled) {
        patterns.add(pattern);
      }
    }

    if (patterns.size === 0) {
      return undefined;
    }
    if (patterns.size === 1) {
      return patterns.values().next().value;
    }
    return `{${Array.from(patterns).join(',')}}`;
  }
}
