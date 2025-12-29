import moo from "moo";

export const lexer = moo.compile({
  // Skip whitespace and comments
  ws: { match: /\s+/, lineBreaks: true },
  comment: /;.*/,
  parenComment: /\([^)]*\)/,
  lineNumber: /N[0-9]+/,
  percent: "%",

  // Keywords
  IF: "IF",
  THEN: "THEN",
  ENDIF: "ENDIF",
  ELSE: "ELSE",
  ELSIF: ["ELSIF", "ELSEIF"],
  WHILE: "WHILE",
  DO: /DO[0-9]*/,
  ENDWHILE: /END(?:WHILE)?[0-9]*/,
  GOTO: "GOTO",
  END: "END",

  // Special codes
  OSUB: /[Oo][0-9]+/,
  MCALL: "M98",
  MRET: "M99",
  GCODE: /G[0-9]+(?:\.[0-9]+)?/,
  MCODE: /M[0-9]+/,

  // Operators
  RELOP: ["GT", "LT", "EQ", "NE", "LE", "GE"],
  MOD: "MOD",
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

  // Punctuation
  comma: ",",
  equals: "=",
  plus: "+",
  minus: "-",
  star: "*",
  slash: "/",
  lBracket: "[",
  rBracket: "]",

  // Variables
  VAR: [/#[0-9]+/, /#<[a-zA-Z_][a-zA-Z0-9_]*>/],
  hash: "#",

  // Numbers (including starting with decimal, negatives handled in grammar)
  NUMBER: /[0-9]+\.?[0-9]*|\.[0-9]+/,
  dot: ".",

  // Parameters (single letter)
  PARAM: /[A-Z]/,

  // Words (letter followed by digits)
  WORD: /[A-Z][0-9]+/,
});
