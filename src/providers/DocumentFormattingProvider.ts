import { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';

import { FormatterService } from './FormatterService';
import { DialectType } from '../constants';
import { Range } from '../parser/nodes';
import { FormatterConfig } from '../formatter/types';

/**
 * Document Formatting Provider
 *
 * Handles both full document and range formatting requests.
 *
 * Note: The formatter deliberately parses with LinuxCNC dialect (superset of
 * all keywords) regardless of the document's configured dialect. Only the
 * formatter output is dialect-specific. This means we cannot reuse the
 * dialect-specific cached AST from DocumentStateManager here.
 */
export class DocumentFormattingProvider {
  constructor(private formatter: FormatterService) {}

  /**
   * Format entire document or a specific range.
   *
   * Uses FormatterService.formatDocument which always parses with
   * LinuxCNC (superset), then formats with the specified dialect.
   */
  provide(
    document: TextDocument,
    settings: FormatterConfig,
    dialect?: DialectType,
    range?: Range
  ): TextEdit[] {
    return this.formatter.formatAsTextEdits(document, range ?? null, settings, dialect);
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
}
