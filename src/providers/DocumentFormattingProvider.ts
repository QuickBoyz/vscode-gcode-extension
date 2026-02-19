import { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';

import { FormatterSettings } from '../formatter/types';
import { FormatterService } from './FormatterService';
import { DialectType } from '../constants';
import { Range } from '../parser/nodes';

/**
 * Document Formatting Provider
 *
 * Handles both full document and range formatting requests.
 * Consolidates formatting functionality into a single provider.
 */
export class DocumentFormattingProvider {
  constructor(private formatter: FormatterService) {}

  /**
   * Format entire document or a specific range
   *
   * @param document - Text document to format
   * @param settings - Formatter settings
   * @param dialect - Optional dialect type
   * @param range - Optional range to format (if omitted, formats entire document)
   * @returns Array of text edits
   */
  provide(
    document: TextDocument,
    settings: FormatterSettings,
    dialect?: DialectType,
    range?: Range
  ): TextEdit[] {
    return this.formatter.formatAsTextEdits(document, range ?? null, settings, dialect);
  }

  /**
   * Format entire document
   *
   * @param document - Text document to format
   * @param settings - Formatter settings
   * @param dialect - Optional dialect type
   * @returns Array of text edits
   */
  provideDocument(
    document: TextDocument,
    settings: FormatterSettings,
    dialect?: DialectType
  ): TextEdit[] {
    return this.provide(document, settings, dialect);
  }

  /**
   * Format specific range within document
   *
   * @param document - Text document to format
   * @param range - Range to format
   * @param settings - Formatter settings
   * @param dialect - Optional dialect type
   * @returns Array of text edits
   */
  provideRange(
    document: TextDocument,
    range: Range,
    settings: FormatterSettings,
    dialect?: DialectType
  ): TextEdit[] {
    return this.provide(document, settings, dialect, range);
  }
}
