import { DialectType } from '../constants';
import { GCodeScanner, TokenizeOptions } from './GCodeScanner';
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
   *
   * @param input   - Raw G-code text (or a region of it)
   * @param options - Optional position offsets for incremental tokenization
   */
  tokenize(input: string, options?: TokenizeOptions): LexerToken[] {
    return this.scanner.tokenize(input, options);
  }
}
