import { DialectType } from '../constants';
import { GCodeLexer } from './GCodeLexer';

/**
 * Factory for creating dialect-aware lexer instances.
 *
 * Encapsulates lexer construction so callers do not need to know
 * about the dialect → keyword table wiring.
 */
export class LexerFactory {
  static create(dialect: DialectType = DialectType.LINUXCNC): GCodeLexer {
    return new GCodeLexer(dialect);
  }
}
