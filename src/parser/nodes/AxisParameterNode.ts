import { AstVisitor } from '../AstVisitor';
import { AstNode } from './AstNode';
import { ExpressionNode } from './expressions';
import { Range } from './Range';
import { StatementNode } from './StatementNode';

export class AxisParameterNode extends StatementNode {
  constructor(
    range: Range,
    readonly axis: string,
    readonly value: ExpressionNode,
    parent?: AstNode
  ) {
    super(range, parent);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitAxisParameter(this);
  }
}
