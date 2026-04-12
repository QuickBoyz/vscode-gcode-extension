import { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';

import { FormatterService } from './FormatterService';
import { GCodeSettings } from './DocumentStateManager';
import { IDocumentStateManager } from './IDocumentStateManager';
import { DialectType } from '../constants';
import { ProgramNode, Range } from '../parser/nodes';
import { FormatterConfig } from '../formatter/types';

/**
 * Document Formatting Provider
 *
 * Handles both full document and range formatting requests.
 * When a DocumentStateManager is available, reuses the cached AST
 * parsed with the user's selected dialect to avoid redundant parsing.
 */
export class DocumentFormattingProvider {
  constructor(
    private formatter: FormatterService,
    private stateManager?: IDocumentStateManager
  ) {}

  /**
   * Format entire document or a specific range.
   *
   * If a DocumentStateManager is available and the document has a cached AST,
   * reuses it instead of re-parsing. Falls back to parsing from scratch
   * when no cached AST is available.
   */
  provide(
    document: TextDocument,
    settings: FormatterConfig,
    dialect?: DialectType,
    range?: Range
  ): TextEdit[] {
    const program = this.getCachedProgram(document, settings, dialect);
    return this.formatter.formatAsTextEdits(document, range ?? null, settings, dialect, program);
  }

  /**
   * Format entire document
   */
  provideDocument(
    document: TextDocument,
    settings: FormatterConfig,
    dialect?: DialectType
  ): TextEdit[] {
    return this.provide(document, settings, dialect);
  }

  /**
   * Format specific range within document
   */
  provideRange(
    document: TextDocument,
    range: Range,
    settings: FormatterConfig,
    dialect?: DialectType
  ): TextEdit[] {
    return this.provide(document, settings, dialect, range);
  }

  /**
   * Try to get the cached AST from DocumentStateManager.
   * Returns undefined if no state manager or no cached state.
   */
  private getCachedProgram(
    document: TextDocument,
    settings: FormatterConfig,
    dialect?: DialectType
  ): ProgramNode | undefined {
    if (!this.stateManager) return undefined;

    const gcodeSettings: GCodeSettings = { formatter: settings, dialect };
    const state = this.stateManager.getOrParseDocumentFromTextDocument(document, gcodeSettings);
    return state.ast;
  }
}
