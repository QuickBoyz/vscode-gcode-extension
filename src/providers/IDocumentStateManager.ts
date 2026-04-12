/**
 * Narrow interface exposing the {@link DocumentStateManager} surface
 * consumed by LSP providers and provider-adjacent services.
 *
 * Kept intentionally minimal — server-only concerns (cache invalidation,
 * content change application, document removal) are deliberately excluded
 * because providers should not touch them. Expanding this interface should
 * require a real provider-side consumer, not speculative future use.
 */

import type { TextDocument } from 'vscode-languageserver-textdocument';

import type { DialectType } from '../constants';
import type { ProgramNode } from '../parser/nodes';
import type { AnalysisOptions, AnalysisResults } from './AnalysisResults';
import type { DocumentState, GCodeSettings } from './DocumentStateManager';
import type { IDataProvider } from './IDataProvider';

export interface IDocumentStateManager {
  /**
   * Get (or parse) cached document state for a text document.
   */
  getOrParseDocumentFromTextDocument(
    document: TextDocument,
    settings: GCodeSettings
  ): DocumentState;

  /**
   * Get (or compute) analysis results for a text document.
   */
  getAnalysisFromTextDocument(
    document: TextDocument,
    settings: GCodeSettings,
    options?: AnalysisOptions
  ): AnalysisResults;

  /**
   * Run AST-level analysis on a pre-parsed program without touching the cache.
   */
  analyzeAst(ast: ProgramNode, options?: AnalysisOptions): AnalysisResults;

  /**
   * Get the dialect-specific data provider.
   */
  getDataProvider(dialect?: DialectType): IDataProvider;
}
