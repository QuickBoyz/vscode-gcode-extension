import { Token, TokenType } from '../parser/nodes/tokens';
import { KeywordType } from './KeywordType';
import { LexerToken } from './LexerToken';
import { TokenCategory } from './TokenCategory';

/**
 * Maps a TokenCategory + KeywordType to the legacy TokenType.
 *
 * This adapter exists only during the migration period. Once all consumers
 * use LexerToken directly, this file is deleted.
 */
export function toLegacyTokenType(category: TokenCategory, keyword: KeywordType | null): TokenType {
  // Keywords that map to their own TokenType
  if (keyword !== null) {
    switch (keyword) {
      case KeywordType.IF:
        return TokenType.IF;
      case KeywordType.ELSE:
        return TokenType.ELSE;
      case KeywordType.ELSEIF:
        return TokenType.ELSEIF;
      case KeywordType.ENDIF:
        return TokenType.ENDIF;
      case KeywordType.THEN:
        return TokenType.THEN;
      case KeywordType.WHILE:
        return TokenType.WHILE;
      case KeywordType.ENDWHILE:
        return TokenType.ENDWHILE;
      case KeywordType.DO:
        return TokenType.DO;
      case KeywordType.END:
        return TokenType.END;
      case KeywordType.GOTO:
        return TokenType.GOTO;
      case KeywordType.MOD:
        return TokenType.MOD;
      // Relational operators -> RELOP
      case KeywordType.EQ:
      case KeywordType.NE:
      case KeywordType.LT:
      case KeywordType.GT:
      case KeywordType.LE:
      case KeywordType.GE:
      case KeywordType.AND:
      case KeywordType.OR:
      case KeywordType.XOR:
        return TokenType.RELOP;
      // Functions -> FUNC
      case KeywordType.SIN:
      case KeywordType.COS:
      case KeywordType.TAN:
      case KeywordType.ASIN:
      case KeywordType.ACOS:
      case KeywordType.ATAN:
      case KeywordType.SQRT:
      case KeywordType.ABS:
      case KeywordType.ROUND:
      case KeywordType.FIX:
      case KeywordType.FUP:
      case KeywordType.LN:
      case KeywordType.EXP:
      case KeywordType.EXISTS:
        return TokenType.FUNC;
      // SUB, ENDSUB, CALL, RETURN - not in current TokenType; map to PARAM as fallback
      case KeywordType.SUB:
      case KeywordType.ENDSUB:
      case KeywordType.CALL:
      case KeywordType.RETURN:
        return TokenType.PARAM;
    }
  }

  // Category-based mapping
  switch (category) {
    case TokenCategory.NUMBER:
      return TokenType.NUMBER;
    case TokenCategory.IDENTIFIER:
      return TokenType.PARAM;
    case TokenCategory.GCODE:
      return TokenType.GCODE;
    case TokenCategory.MCODE:
      return TokenType.MCODE;
    case TokenCategory.OSUB:
      return TokenType.OSUB;
    case TokenCategory.VARIABLE:
      return TokenType.VAR;
    case TokenCategory.PARAM:
      return TokenType.PARAM;
    case TokenCategory.COMMENT:
      return TokenType.COMMENT;
    case TokenCategory.PAREN_COMMENT:
      return TokenType.PARENCOMMENT;
    case TokenCategory.LINE_NUMBER:
      return TokenType.LineNumber;
    case TokenCategory.PLUS:
      return TokenType.PLUS;
    case TokenCategory.MINUS:
      return TokenType.MINUS;
    case TokenCategory.STAR:
      return TokenType.STAR;
    case TokenCategory.SLASH:
      return TokenType.SLASH;
    case TokenCategory.EQUALS:
      return TokenType.EQUALS;
    case TokenCategory.COMMA:
      return TokenType.COMMA;
    case TokenCategory.DOT:
      return TokenType.DOT;
    case TokenCategory.LBRACKET:
      return TokenType.LBRACKET;
    case TokenCategory.RBRACKET:
      return TokenType.RBRACKET;
    case TokenCategory.HASH:
      return TokenType.HASH;
    case TokenCategory.PERCENT:
      return TokenType.PERCENT;
    case TokenCategory.WS:
      return TokenType.WS;
    case TokenCategory.NL:
      return TokenType.NL;
  }
}

/**
 * Convert a LexerToken to a legacy Token.
 *
 * This enables the new scanner to be plugged in while the parser still
 * uses the old Token class. Once the parser is migrated, this function
 * is deleted along with tokenMapping.ts.
 */
export function toLegacyToken(lexerToken: LexerToken): Token {
  const legacyType = toLegacyTokenType(lexerToken.category, lexerToken.keyword);
  return new Token(
    legacyType,
    lexerToken.value,
    lexerToken.offset,
    lexerToken.value,
    lexerToken.lineBreaks,
    lexerToken.line,
    lexerToken.col
  );
}
