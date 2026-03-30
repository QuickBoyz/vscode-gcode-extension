import { KeywordType, TokenCategory } from '../../lexer/types';
import { StatementNode } from '../nodes';
import { ParseError } from '../TokenStream';
import { BaseParser } from '../BaseParser';

/**
 * Fanuc dialect parser.
 *
 * Handles Fanuc G-code syntax: motion commands, variables, comments,
 * parameters, line numbers, and basic IF/WHILE (no O-block labels).
 * Fanuc does not support SUB/ENDSUB; subroutines are separate programs
 * called via M98/M99 (to be added in a future PR).
 */
export class FanucParser extends BaseParser {
  protected parseStatement(): StatementNode | null {
    const token = this.tokens.peek();
    if (!token) return null;

    // Check keywords for control flow
    if (token.keyword !== null) {
      switch (token.keyword) {
        case KeywordType.IF:
          return this.parseIf();
        case KeywordType.WHILE:
          return this.parseWhile();
      }
    }

    // Then check categories
    switch (token.category) {
      case TokenCategory.VARIABLE:
        return this.parseVariableAssignment();

      case TokenCategory.GCODE:
      case TokenCategory.MCODE:
        return this.parseMotionCommand();

      case TokenCategory.COMMENT:
      case TokenCategory.PAREN_COMMENT:
        return this.parseComment();

      case TokenCategory.PARAM:
        return this.parseAxisParam();

      case TokenCategory.NL:
      case TokenCategory.PERCENT:
        this.tokens.next();
        return null;

      case TokenCategory.LINE_NUMBER:
        return this.parseLineNumber();

      default:
        throw new ParseError(`Unexpected token ${token.category}`, token);
    }
  }
}
