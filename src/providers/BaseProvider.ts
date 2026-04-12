/**
 * Base Provider
 *
 * Abstract base class for all LSP providers.
 * Provides shared access to document state, analysis, and dialect-specific data.
 */
import { TextDocument } from 'vscode-languageserver-textdocument';

import { DialectType } from '../constants';
import { AnalysisOptions, AnalysisResults } from './AnalysisResults';
import { DocumentState, GCodeSettings } from './DocumentStateManager';
import { IDataProvider } from './IDataProvider';
import { IDocumentStateManager } from './IDocumentStateManager';

/**
 * Abstract base provider class
 *
 * All LSP providers should extend this class to gain access to:
 * - Document state (AST, parser, lexer)
 * - Analysis results (variables, labels, errors)
 * - Dialect-specific data providers
 */
export abstract class BaseProvider {
  constructor(protected readonly documentStateManager: IDocumentStateManager) {}

  /**
   * Get or parse document state for a given text document
   *
   * @param document - The text document
   * @param settings - G-code settings (formatter, dialect)
   * @returns Cached or freshly parsed document state
   */
  protected getDocumentState(document: TextDocument, settings: GCodeSettings): DocumentState {
    return this.documentStateManager.getOrParseDocumentFromTextDocument(document, settings);
  }

  /**
   * Get analysis results for a given text document
   *
   * @param document - The text document
   * @param settings - G-code settings (formatter, dialect)
   * @param options - Analysis options (e.g., includeTokens)
   * @returns Analysis results (variables, labels, errors, tokens)
   */
  protected getAnalysis(
    document: TextDocument,
    settings: GCodeSettings,
    options?: AnalysisOptions
  ): AnalysisResults {
    return this.documentStateManager.getAnalysisFromTextDocument(document, settings, options);
  }

  /**
   * Get dialect-specific data provider
   *
   * @param dialect - Optional dialect type (defaults to settings dialect or LinuxCNC)
   * @returns Data provider for the specified dialect
   */
  protected getDataProvider(dialect?: DialectType): IDataProvider {
    return this.documentStateManager.getDataProvider(dialect);
  }
}
