import { KeywordType, TokenCategory } from '../../lexer/types';
import { StatementNode } from '../nodes';
import { ParseError } from '../TokenStream';
import { BaseParser } from '../BaseParser';

/**
 * LinuxCNC dialect parser.
 *
 * Handles the full LinuxCNC G-code syntax including O-block labeled
 * control flow (O100 IF, O100 WHILE, O100 SUB/ENDSUB, etc.) and
 * standalone IF/WHILE without labels.
 */
export class LinuxCNCParser extends BaseParser {
  protected parseStatement(): StatementNode | null {
    const token = this.tokens.peek();
    if (!token) return null;

    // First check keywords (these are IDENTIFIER category with a keyword set)
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

      case TokenCategory.OSUB:
        return this.parseOBlock();

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

  private parseOBlock(): StatementNode {
    const label = this.tokens.expectCategory(TokenCategory.OSUB);
    const token = this.tokens.peek();

    if (token?.isKeyword(KeywordType.WHILE)) {
      return this.parseWhile(label);
    }
    if (token?.isKeyword(KeywordType.IF)) {
      return this.parseIf(label);
    }
    // Standalone O-block label (e.g., O01234 for subroutine marker)
    return this.factory.subroutineLabel(label);
  }
}
