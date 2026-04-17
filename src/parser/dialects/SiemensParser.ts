import { KeywordType, TokenCategory } from '../../lexer/types';
import { ParserDiagnosticCode, StatementNode } from '../nodes';
import { createParseError } from '../../errors/createParseError';
import { BaseParser } from '../BaseParser';

/**
 * Siemens dialect parser.
 *
 * Handles Siemens/Sinumerik G-code syntax: motion commands, variables,
 * comments, parameters, IF/WHILE (no O-block labels), and
 * PROC/RET/CALL subroutine support.
 */
export class SiemensParser extends BaseParser {
  protected parseStatement(): StatementNode | null {
    const token = this.tokens.peek();
    if (!token) return null;

    // Check keywords for control flow and subroutine constructs
    if (token.keyword !== null) {
      switch (token.keyword) {
        case KeywordType.IF:
          return this.parseIf();
        case KeywordType.WHILE:
          return this.parseWhile();
        case KeywordType.PROC:
          return this.parseProcedure();
        case KeywordType.CALL:
          return this.parseSiemensCall();
        case KeywordType.RET:
        case KeywordType.RETURN:
          return this.parseSiemensReturn();
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
        this.tokens.next();
        return null;

      case TokenCategory.LINE_NUMBER:
        return this.parseLineNumber();

      default:
        throw createParseError({
          message: `Unexpected token ${token.category}`,
          token,
          code: ParserDiagnosticCode.UNEXPECTED_TOKEN,
        });
    }
  }

  private parseProcedure(): StatementNode {
    const procToken = this.tokens.expectKeyword(KeywordType.PROC);

    // Expect an IDENTIFIER for the procedure name
    const nameToken = this.tokens.expectCategory(TokenCategory.IDENTIFIER);
    const body: StatementNode[] = [];

    // Parse body until RET or RETURN keyword is encountered (or EOF)
    while (!this.tokens.eof()) {
      if (this.tokens.matchKeyword(KeywordType.RET, KeywordType.RETURN)) {
        break;
      }
      const stmt = this.parseStatementSafe();
      if (stmt) {
        body.push(stmt);
      }
    }

    // Consume the terminating RET or RETURN
    if (!this.tokens.matchKeyword(KeywordType.RET, KeywordType.RETURN)) {
      throw createParseError({
        message: 'Expected RET or RETURN to terminate PROC',
        token: procToken,
        code: ParserDiagnosticCode.EXPECTED_RET,
      });
    }
    const retToken = this.tokens.expectKeyword(KeywordType.RET, KeywordType.RETURN);

    return this.factory.subroutineDefinition({
      label: nameToken,
      subToken: procToken,
      body,
      endToken: retToken,
    });
  }

  private parseSiemensCall(): StatementNode {
    const callToken = this.tokens.expectKeyword(KeywordType.CALL);

    // Expect an IDENTIFIER for the procedure name
    const nameToken = this.tokens.expectCategory(TokenCategory.IDENTIFIER);

    return this.factory.subroutineCall({
      callToken,
      target: nameToken.value,
      callArguments: [],
      lastToken: nameToken,
    });
  }

  private parseSiemensReturn(): StatementNode {
    const returnToken = this.tokens.expectKeyword(KeywordType.RET, KeywordType.RETURN);
    return this.factory.returnStatement({ returnToken });
  }
}
