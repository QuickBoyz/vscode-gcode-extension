import moo from "moo";

export const lexer = moo.compile({
  // Skip whitespace and comments
  ws: { match: /\s+/, lineBreaks: true },
  comment: /;.*/,
  lineNumber: /N[0-9]+/,

  // Keywords
  IF: "IF",
  THEN: "THEN",
  ENDIF: "ENDIF",
  ELSE: "ELSE",
  ELSIF: ["ELSIF", "ELSEIF"],
  WHILE: "WHILE",
  DO: "DO",
  ENDWHILE: "ENDWHILE",
  GOTO: "GOTO",
  END: "END",

  // Special codes
  OSUB: /O[0-9]+/,
  MCALL: "M98",
  MRET: "M99",
  GCODE: /G[0-9]+(?:\.[0-9]+)?/,
  MCODE: /M[0-9]+/,

  // Operators
  RELOP: ["GT", "LT", "EQ", "NE", "LE", "GE"],
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
    "MOD",
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
  VAR: [/#[0-9]+/, /#<[a-zA-Z0-9]+>/],

  // Numbers
  NUMBER: /[0-9]+(?:\.[0-9]+)?/,

  // Parameters (single letter)
  PARAM: /[A-Z]/,

  // Words (letter followed by digits)
  WORD: /[A-Z][0-9]+/,
});
