import moo, { Lexer, Token as MooToken } from "moo";
import { Token, TokenType } from "../entities/tokens";
import {
  BinaryOperatorType,
  FunctionName,
  RelationalOperatorType,
  UnaryOperatorType,
} from "../entities/expressions/types";

/**
 * Token type exported from moo
 */

/**
 * G-code Lexer
 *
 * Tokenizes G-code input using Moo lexer.
 * Handles all G-code tokens including:
 * - G/M codes
 * - Parameters
 * - Comments
 * - Control flow keywords
 * - Expressions
 * - Variables
 */
class GCodeLexer {
  private lexer: Lexer;

  constructor() {
    this.lexer = moo.compile({
      // Whitespace
      ws: { match: /[ \t]+/ },
      nl: { match: /\r?\n/, lineBreaks: true },

      // Comments
      comment: /;.*/,
      parenComment: /\([^)]*\)/,

      // Line numbers (N-blocks)
      lineNumber: /[Nn][0-9]+/,

      // Program delimiter
      percent: "%",

      // Control flow keywords (case-insensitive)
      // Order matters: more specific patterns first
      ELSEIF: /[Ee][Ll][Ss][Ee][Ii][Ff]|[Ee][Ll][Ss][Ii][Ff]/,
      ENDIF: /[Ee][Nn][Dd][Ii][Ff]/,
      ENDWHILE: /[Ee][Nn][Dd][Ww][Hh][Ii][Ll][Ee]/,
      ELSE: /[Ee][Ll][Ss][Ee]/,
      THEN: /[Tt][Hh][Ee][Nn]/,
      IF: /[Ii][Ff]/,
      WHILE: /[Ww][Hh][Ii][Ll][Ee]/,
      DO: /[Dd][Oo][0-9]*/,
      END: /[Ee][Nn][Dd][0-9]*/,
      GOTO: /[Gg][Oo][Tt][Oo]/,

      // O-block labels (subroutine markers)
      OSUB: /[Oo][0-9]+/,

      // G and M codes (case-insensitive)
      GCODE: /[Gg][0-9]+(?:\.[0-9]+)?/,
      MCODE: /[Mm][0-9]+/,

      // Relational operators
      RELOP: Object.values(RelationalOperatorType),
      MOD: BinaryOperatorType.Mod,

      // Built-in functions
      FUNC: Object.values(FunctionName),

      // Punctuation and operators
      comma: ",",
      equals: "=",
      plus: BinaryOperatorType.Add,
      star: BinaryOperatorType.Multiply,
      slash: BinaryOperatorType.Divide,
      lBracket: "[",
      rBracket: "]",

      // Variables (#123 or #<name>)
      VAR: [/#[0-9]+/, /#<[a-zA-Z_][a-zA-Z0-9_]*>/],
      hash: "#",

      // Numbers (integers, decimals, leading decimal)
      NUMBER: /[0-9]+\.?[0-9]*|\.[0-9]+/,

      // Minus operator
      minus: UnaryOperatorType.Minus,

      // Dot (for E.#234 style parameter values)
      dot: ".",

      // Parameters (single uppercase letter like X, Y, Z, F, S, etc.)
      PARAM: /[A-Z]/,
    }) as Lexer;
  }

  /**
   * Tokenize G-code input, filtering out whitespace but keeping newlines
   */
  tokenize(input: string): Token[] {
    const tokens: MooToken[] = [];
    this.lexer.reset(input);

    let token: MooToken | undefined;
    while ((token = this.lexer.next())) {
      // Skip whitespace but keep newlines as line separators
      if (token.type !== TokenType.WS) {
        tokens.push(token);
      }
    }

    // Post-process: combine MINUS + NUMBER into a single NUMBER token for negative numbers
    const processedTokens: Token[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const currentToken = tokens[i];
      const nextToken = tokens[i + 1];

      // Check if this is MINUS followed by NUMBER (negative number)
      if (
        currentToken.type === TokenType.MINUS &&
        nextToken?.type === TokenType.NUMBER
      ) {
        const prevToken = tokens[i - 1];

        // It's subtraction (not negative number) if previous token is:
        // - A number
        // - A variable
        // - A closing bracket
        const isSubtraction =
          prevToken &&
          (prevToken.type === TokenType.NUMBER ||
            prevToken.type === TokenType.VAR ||
            prevToken.type === TokenType.RBRACKET);

        if (!isSubtraction) {
          // Combine MINUS + NUMBER into a single NUMBER token
          processedTokens.push(
            new Token(
              nextToken.type,
              `-${nextToken.value}`,
              nextToken.offset,
              nextToken.text,
              nextToken.lineBreaks,
              nextToken.line,
              nextToken.col
            )
          );
          i++; // Skip the next token (NUMBER) since we've combined it
          continue;
        }
      }

      processedTokens.push(
        new Token(
          currentToken.type as TokenType,
          currentToken.value,
          currentToken.offset,
          currentToken.text,
          currentToken.lineBreaks,
          currentToken.line,
          currentToken.col
        )
      );
    }

    return processedTokens;
  }
}

/**
 * G-code lexer instance
 */
export const gcodeLexer = new GCodeLexer();
