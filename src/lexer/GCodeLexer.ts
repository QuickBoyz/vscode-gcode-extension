import { Token } from '../parser/nodes/tokens';
import { GCodeScanner } from './GCodeScanner';
import { TokenCategory } from './TokenCategory';
import { toLegacyToken } from './tokenMapping';

/**
 * G-code Lexer
 *
 * Tokenizes G-code input using GCodeScanner (hand-written character scanner).
 * Emits legacy Token objects for backward compatibility with the parser.
 *
 * Whitespace tokens are filtered out (matching previous Moo behavior)
 * and the MINUS+NUMBER combining is removed (parser handles unary minus).
 */
export class GCodeLexer {
  private scanner: GCodeScanner;

  constructor() {
    this.scanner = new GCodeScanner();
  }

  /**
   * Tokenize G-code input, filtering out whitespace but keeping newlines
   */
  tokenize(input: string): Token[] {
    const lexerTokens = this.scanner.tokenize(input);

    // Filter out whitespace tokens to match the existing parser expectation
    // (the parser currently does not expect WS tokens in the stream)
    const filteredTokens: Token[] = [];
    for (const lexerToken of lexerTokens) {
      if (lexerToken.category !== TokenCategory.WS) {
        filteredTokens.push(toLegacyToken(lexerToken));
      }
    }

    return filteredTokens;
  }
}
