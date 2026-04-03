import { KeywordType, TokenCategory } from '../../lexer/types';
import { LexerToken } from '../../lexer/LexerToken';
import { ExpressionNode, ParserDiagnosticCode, StatementNode } from '../nodes';
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
        throw new ParseError(
          `Unexpected token ${token.category}`,
          token,
          ParserDiagnosticCode.UNEXPECTED_TOKEN
        );
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
    if (token?.isKeyword(KeywordType.SUB)) {
      return this.parseSubroutineDefinition(label);
    }
    if (token?.isKeyword(KeywordType.CALL)) {
      return this.parseSubroutineCall(label);
    }
    if (token?.isKeyword(KeywordType.RETURN)) {
      return this.parseReturn(label);
    }
    // Standalone O-block label (e.g., O01234 for subroutine marker)
    return this.factory.subroutineLabel(label);
  }

  private parseSubroutineDefinition(label: LexerToken): StatementNode {
    const subToken = this.tokens.expectKeyword(KeywordType.SUB);
    const body: StatementNode[] = [];

    while (!this.tokens.eof()) {
      // Check for matching OSUB label followed by ENDSUB
      if (
        this.tokens.matchCategory(TokenCategory.OSUB) &&
        this.tokens.peek()?.value === label.value &&
        this.tokens.peek(1)?.hasKeyword(KeywordType.ENDSUB)
      ) {
        break;
      }

      const stmt = this.parseStatementSafe();
      if (stmt) {
        body.push(stmt);
      }
    }

    // Consume the matching OSUB label
    if (!this.tokens.matchCategory(TokenCategory.OSUB)) {
      throw new ParseError(
        'Expected matching label before ENDSUB',
        subToken,
        ParserDiagnosticCode.EXPECTED_MATCHING_LABEL_ENDSUB
      );
    }
    this.tokens.expectCategory(TokenCategory.OSUB);

    // Consume the ENDSUB keyword
    if (!this.tokens.matchKeyword(KeywordType.ENDSUB)) {
      throw new ParseError('Expected ENDSUB', subToken, ParserDiagnosticCode.EXPECTED_ENDSUB);
    }
    const endToken = this.tokens.expectKeyword(KeywordType.ENDSUB);

    return this.factory.subroutineDefinition({ label, subToken, body, endToken });
  }

  private parseSubroutineCall(label: LexerToken): StatementNode {
    const callToken = this.tokens.expectKeyword(KeywordType.CALL);
    const callArguments: ExpressionNode[] = [];
    let lastToken: LexerToken = callToken;

    // Parse bracket-delimited arguments: [expr1] [expr2] ...
    while (this.tokens.matchCategory(TokenCategory.LBRACKET)) {
      this.tokens.next(); // consume LBRACKET
      callArguments.push(this.parseExpression());
      lastToken = this.tokens.expectCategory(TokenCategory.RBRACKET);
    }

    return this.factory.subroutineCall({
      callToken: label,
      target: label.value,
      callArguments,
      lastToken,
    });
  }

  private parseReturn(label: LexerToken): StatementNode {
    const returnToken = this.tokens.expectKeyword(KeywordType.RETURN);
    return this.factory.returnStatement({ returnToken, label });
  }
}
