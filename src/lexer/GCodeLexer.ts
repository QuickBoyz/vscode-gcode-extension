import { DialectType } from '../constants';
import { GCodeScanner } from './GCodeScanner';
import { LexerToken } from './LexerToken';

/**
 * G-code Lexer
 *
 * Tokenizes G-code input using GCodeScanner (hand-written character scanner).
 * Returns LexerToken[] including whitespace tokens.
 * The TokenStream handles whitespace skipping for the parser.
 */
export class GCodeLexer {
  private scanner: GCodeScanner;

  constructor(dialect: DialectType = DialectType.LINUXCNC) {
    this.scanner = new GCodeScanner(dialect);
  }

  /**
   * Tokenize G-code input into LexerToken array.
   * All tokens are included, including whitespace.
   */
  tokenize(input: string): LexerToken[] {
    return this.scanner.tokenize(input);
  }
}
