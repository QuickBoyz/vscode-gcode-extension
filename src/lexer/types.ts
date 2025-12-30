import moo, { LexerState } from "moo";

export interface Token extends moo.Token {
  type: TokenType;
}

export interface Lexer extends moo.Lexer {
  next(): Token | undefined;
  reset(chunk?: string, state?: LexerState): this;
  save(): LexerState;
  pushState(state: string): void;
  popState(): void;
  setState(state: string): void;
  [Symbol.iterator](): Iterator<Token>;
}

export enum TokenType {
  WS = "ws",
  NL = "nl",
  COMMENT = "comment",
  PARENCOMMENT = "parenComment",
  LineNumber = "lineNumber",
  PERCENT = "percent",
  ELSEIF = "ELSEIF",
  ENDIF = "ENDIF",
  ENDWHILE = "ENDWHILE",
  ELSE = "ELSE",
  THEN = "THEN",
  IF = "IF",
  WHILE = "WHILE",
  DO = "DO",
  END = "END",
  GOTO = "GOTO",
  OSUB = "OSUB",
  GCODE = "GCODE",
  MCODE = "MCODE",
  RELOP = "RELOP",
  MOD = "MOD",
  FUNC = "FUNC",
  COMMA = "comma",
  EQUALS = "equals",
  PLUS = "plus",
  MINUS = "minus",
  STAR = "star",
  SLASH = "slash",
  LBRACKET = "lBracket",
  RBRACKET = "rBracket",
  VAR = "VAR",
  HASH = "hash",
  NUMBER = "NUMBER",
  DOT = "dot",
  PARAM = "PARAM",
}
