import { AstVisitor } from '../AstVisitor';
import { AstNode } from './AstNode';
import { Range } from './Range';
import { StatementNode } from './StatementNode';

export enum DiagnosticCategory {
  Error = 'error',
  Warning = 'warning',
  Information = 'information',
  Hint = 'hint',
}

/**
 * Diagnostic codes for parser errors.
 * Each code identifies a specific class of parse failure.
 */
export enum ParserDiagnosticCode {
  EXPECTED_ENDIF = 'expected-endif',
  EXPECTED_ENDIF_WITH_LABEL = 'expected-endif-with-label',
  EXPECTED_END_OR_ENDWHILE = 'expected-end-or-endwhile',
  EXPECTED_ENDSUB = 'expected-endsub',
  EXPECTED_MATCHING_LABEL_ENDSUB = 'expected-matching-label-endsub',
  EXPECTED_RET = 'expected-ret',
  M98_MISSING_P = 'm98-missing-p',
  UNEXPECTED_EOF = 'unexpected-eof',
  UNEXPECTED_TOKEN = 'unexpected-token',
  EXPECTED_TOKEN = 'expected-token',
  EXPECTED_FUNCTION_NAME = 'expected-function-name',
  UNTERMINATED_COMMENT = 'unterminated-comment',
  UNTERMINATED_VARIABLE = 'unterminated-variable',
  MISMATCHED_DO_END_SUFFIX = 'mismatched-do-end-suffix',
  INVALID_DO_END_SUFFIX = 'invalid-do-end-suffix',
  UNSUPPORTED_NUMBERED_DO_END = 'unsupported-numbered-do-end',
}

export class ErrorNode extends StatementNode {
  constructor(
    range: Range,
    readonly message: string,
    readonly originalText?: string,
    parent?: AstNode,
    readonly category: DiagnosticCategory = DiagnosticCategory.Error,
    readonly code?: ParserDiagnosticCode
  ) {
    super(range, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitError(this);
  }
}
