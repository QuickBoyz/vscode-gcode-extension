import { DialectType } from '../constants';
import { DialectRegistry } from '../dialects';
import { GCodeLexer } from './GCodeLexer';

/**
 * Factory for creating dialect-aware lexer instances.
 *
 * Delegates to the centralized DialectRegistry.
 */
export class LexerFactory {
  static create(dialect: DialectType = DialectType.LINUXCNC): GCodeLexer {
    return DialectRegistry.createLexer(dialect);
  }
}
