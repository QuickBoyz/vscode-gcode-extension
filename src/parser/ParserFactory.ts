import { DialectType } from '../constants';
import { DialectRegistry } from '../dialects';
import { LexerToken } from '../lexer/LexerToken';
import { BaseParser } from './BaseParser';

/**
 * Factory for creating dialect-specific parser instances.
 *
 * Delegates to the centralized DialectRegistry.
 */
export class ParserFactory {
  static create(
    dialect: DialectType = DialectType.LINUXCNC,
    tokens: readonly LexerToken[],
    inputText?: string
  ): BaseParser {
    return DialectRegistry.createParser(dialect, tokens, inputText);
  }
}
