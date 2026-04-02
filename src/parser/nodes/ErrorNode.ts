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

export class ErrorNode extends StatementNode {
  constructor(
    range: Range,
    readonly message: string,
    readonly originalText?: string,
    parent?: AstNode,
    readonly category: DiagnosticCategory = DiagnosticCategory.Error
  ) {
    super(range, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitError(this);
  }
}
