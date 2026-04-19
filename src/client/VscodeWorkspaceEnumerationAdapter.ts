/**
 * VSCode adapter that satisfies {@link WorkspaceFileEnumeratorDeps} by
 * delegating to `vscode.workspace` and the `LanguageClient`. Extracted from
 * `extension.ts` so the adapter layer stays free of inline callbacks and
 * can be swapped for a test double.
 */
import type {
  ProgressToken,
  WorkDoneProgressBegin,
  WorkDoneProgressEnd,
} from 'vscode-languageserver-protocol';
import * as vscode from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';
import { WorkDoneProgress } from 'vscode-languageserver-protocol';

import type {
  ExcludeSettings,
  UriLike,
  WorkspaceFileEnumeratorDeps,
} from './WorkspaceFileEnumerator';

/**
 * The adapter is constructed before `client.start()` returns, so the
 * language client is injected lazily via a getter. Calling `reportProgress`
 * before the client is available is a programmer error and is surfaced
 * explicitly rather than silently dropped.
 */
export type LanguageClientAccessor = () => LanguageClient | undefined;

export class VscodeWorkspaceEnumerationAdapter implements WorkspaceFileEnumeratorDeps {
  private readonly getClient: LanguageClientAccessor;

  public constructor(getClient: LanguageClientAccessor) {
    this.getClient = getClient;
  }

  public findFiles(
    include: string,
    exclude: string | undefined,
    folderUri: string
  ): Thenable<readonly UriLike[]> {
    if (folderUri) {
      const pattern = new vscode.RelativePattern(vscode.Uri.parse(folderUri), include);
      return vscode.workspace.findFiles(pattern, exclude ?? null);
    }
    return vscode.workspace.findFiles(include, exclude ?? null);
  }

  public getExcludes(folderUri: string): ExcludeSettings {
    const scope = folderUri ? vscode.Uri.parse(folderUri) : undefined;
    const config = vscode.workspace.getConfiguration(undefined, scope);
    return {
      filesExclude: config.get<Record<string, unknown>>('files.exclude') ?? {},
      searchExclude: config.get<Record<string, unknown>>('search.exclude') ?? {},
    };
  }

  public reportProgress(
    token: ProgressToken,
    value: WorkDoneProgressBegin | WorkDoneProgressEnd
  ): void {
    const client = this.getClient();
    if (!client) return;
    void client.sendProgress(WorkDoneProgress.type, token, value);
  }
}
