import moo from "moo";

/**
 * Token type exported from moo
 */
export type Token = moo.Token;

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
  private lexer: moo.Lexer;

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
      RELOP: ["GT", "LT", "EQ", "NE", "LE", "GE"],
      MOD: "MOD",

      // Built-in functions
      FUNC: [
        "SIN",
        "COS",
        "TAN",
        "ASIN",
        "ACOS",
        "ATAN",
        "FIX",
        "FUP",
        "LN",
        "ROUND",
        "SQRT",
        "ABS",
        "MIN",
        "MAX",
      ],

      // Punctuation and operators
      comma: ",",
      equals: "=",
      plus: "+",
      minus: "-",
      star: "*",
      slash: "/",
      lBracket: "[",
      rBracket: "]",

      // Variables (#123 or #<name>)
      VAR: [/#[0-9]+/, /#<[a-zA-Z_][a-zA-Z0-9_]*>/],
      hash: "#",

      // Numbers (integers, decimals, leading decimal)
      NUMBER: /[0-9]+\.?[0-9]*|\.[0-9]+/,

      // Dot (for E.#234 style parameter values)
      dot: ".",

      // Parameters (single uppercase letter like X, Y, Z, F, S, etc.)
      PARAM: /[A-Z]/,
    });
  }

  /**
   * Tokenize G-code input, filtering out whitespace but keeping newlines
   */
  tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    this.lexer.reset(input);

    let token: Token | undefined;
    while ((token = this.lexer.next())) {
      // Skip whitespace but keep newlines as line separators
      if (token.type !== "ws") {
        tokens.push(token);
      }
    }

    return tokens;
  }
}

/**
 * G-code lexer instance
 */
export const gcodeLexer = new GCodeLexer();
