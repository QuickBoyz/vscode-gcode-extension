import { LexerToken } from '../../lexer/LexerToken';
import { KeywordType, TokenCategory } from '../../lexer/types';
import {
  AxisParameterNode,
  DiagnosticCategory,
  ExpressionNode,
  LiteralExpressionNode,
  ParserDiagnosticCode,
  StatementNode,
} from '../nodes';
import { createParseError } from '../../errors/createParseError';
import { BaseParser } from '../BaseParser';

/**
 * M-code values that trigger subroutine call/return parsing.
 */
const MCODE_SUBROUTINE_CALL = 'M98';
const MCODE_SUBROUTINE_RETURN = 'M99';
const UNKNOWN_SUBROUTINE_TARGET = 'unknown';

/**
 * Fanuc dialect parser.
 *
 * Handles Fanuc G-code syntax: motion commands, variables, comments,
 * parameters, line numbers, basic IF/WHILE (no O-block labels), and
 * M98/M99 subroutine call/return.
 */
/** Maximum nesting level for Fanuc/Haas Macro B WHILE DO/END loops. */
const MAX_DO_END_NESTING_LEVEL = 3;

export class FanucParser extends BaseParser {
  protected override validateDoEndSuffixes(doToken?: LexerToken, endToken?: LexerToken): void {
    this.validateSuffix(doToken, 'DO');
    this.validateSuffix(endToken, 'END');

    // Check DO/END suffix mismatch
    if (
      doToken?.keywordSuffix !== undefined &&
      endToken?.keywordSuffix !== undefined &&
      doToken.keywordSuffix !== endToken.keywordSuffix
    ) {
      this.addPendingError(
        `END${endToken.keywordSuffix} does not match DO${doToken.keywordSuffix}`,
        endToken,
        ParserDiagnosticCode.MISMATCHED_DO_END_SUFFIX
      );
    }
  }

  private validateSuffix(token: LexerToken | undefined, keyword: string): void {
    if (!token || token.keywordSuffix === undefined) return;
    if (token.keywordSuffix < 1 || token.keywordSuffix > MAX_DO_END_NESTING_LEVEL) {
      this.addPendingError(
        `Invalid ${keyword} suffix ${token.keywordSuffix} — must be 1 through ${MAX_DO_END_NESTING_LEVEL}`,
        token,
        ParserDiagnosticCode.INVALID_DO_END_SUFFIX
      );
    }
  }

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
        return this.parseMotionCommand();

      case TokenCategory.MCODE: {
        const mcodeValue = token.value.toUpperCase();
        if (mcodeValue === MCODE_SUBROUTINE_CALL) {
          return this.parseFanucSubroutineCall();
        }
        if (mcodeValue === MCODE_SUBROUTINE_RETURN) {
          return this.parseFanucReturn();
        }
        return this.parseMotionCommand();
      }

      case TokenCategory.OSUB:
        return this.factory.subroutineLabel(this.tokens.expectCategory(TokenCategory.OSUB));

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

  private parseFanucSubroutineCall(): StatementNode {
    const m98Token = this.tokens.expectCategory(TokenCategory.MCODE);
    const params: AxisParameterNode[] = [];

    // Parse remaining parameters on the line (P and L values)
    while (
      !this.tokens.matchCategory(
        TokenCategory.NL,
        TokenCategory.GCODE,
        TokenCategory.MCODE,
        TokenCategory.PERCENT,
        TokenCategory.COMMENT,
        TokenCategory.PAREN_COMMENT
      ) &&
      !this.tokens.eof()
    ) {
      params.push(this.parseAxisParam());
    }

    // Extract P parameter for target
    const pParam = params.find((p) => p.axis.toUpperCase() === 'P');
    if (!pParam) {
      return this.factory.error(
        'M98 requires P parameter for subroutine number',
        m98Token,
        undefined,
        undefined,
        DiagnosticCategory.Warning,
        ParserDiagnosticCode.M98_MISSING_P
      );
    }

    const target =
      pParam.value instanceof LiteralExpressionNode
        ? String(pParam.value.value)
        : UNKNOWN_SUBROUTINE_TARGET;

    // Extract L parameter for repeat count (optional)
    const lParam = params.find((p) => p.axis.toUpperCase() === 'L');
    let repeatCount: ExpressionNode | undefined;
    if (lParam) {
      repeatCount = lParam.value;
    }

    const lastParam = params[params.length - 1];

    return this.factory.subroutineCall({
      callToken: m98Token,
      target,
      callArguments: [],
      lastToken: lastParam,
      repeatCount,
    });
  }

  private parseFanucReturn(): StatementNode {
    const m99Token = this.tokens.expectCategory(TokenCategory.MCODE);
    return this.factory.returnStatement({ returnToken: m99Token });
  }
}
