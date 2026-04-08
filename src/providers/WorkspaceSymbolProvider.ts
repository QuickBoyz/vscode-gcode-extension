/**
 * Workspace Symbol Provider
 *
 * Implements the LSP workspace symbol handler. Queries the
 * WorkspaceSymbolIndex and returns SymbolInformation results
 * for the workspace symbol search (Ctrl+T).
 */
import { SymbolInformation } from 'vscode-languageserver/node';

import { DEFAULT_MAX_RESULTS, WorkspaceSymbolIndex } from './WorkspaceSymbolIndex';

/**
 * Provider for LSP `workspace/symbol` requests.
 *
 * Delegates to a WorkspaceSymbolIndex for the actual symbol lookup
 * and converts results to the LSP SymbolInformation format.
 */
export class WorkspaceSymbolProvider {
  constructor(private readonly index: WorkspaceSymbolIndex) {}

  /**
   * Provide workspace symbols matching the given query.
   *
   * @param query      - The search query from the user
   * @param maxResults - Maximum number of results to return
   * @returns Array of SymbolInformation for matching symbols
   */
  provideWorkspaceSymbols(
    query: string,
    maxResults: number = DEFAULT_MAX_RESULTS
  ): SymbolInformation[] {
    const matches = this.index.search(query, maxResults);
    return matches.map((symbol) =>
      SymbolInformation.create(symbol.name, symbol.kind, symbol.range, symbol.fileUri)
    );
  }
}
