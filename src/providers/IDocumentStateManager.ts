/**
 * Narrow interface exposing the {@link DocumentStateManager} surface
 * consumed by LSP providers and provider-adjacent services.
 *
 * Kept intentionally minimal — server-only concerns (cache invalidation,
 * content change application, document removal) are deliberately excluded
 * because providers should not touch them. Expanding this interface should
 * require a real provider-side consumer, not speculative future use.
 */

import { TextDocument } from 'vscode-languageserver-textdocument';

import { DialectType } from '../constants';
import { ProgramNode } from '../parser/nodes';
import { AnalysisOptions, AnalysisResults } from './AnalysisResults';
import { DocumentState, GCodeSettings } from './DocumentStateManager';
import { IDataProvider } from './IDataProvider';

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
